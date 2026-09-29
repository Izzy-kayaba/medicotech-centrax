import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserSessionPersistence
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

import { getFirebase } from './firebase-client.js';
import { listArticles, formatDate } from './news-data.js';
import { appendImages, clearImages, validateImage, saveOptionalImages, cleanupImages, appendVideo, clearVideo, validateVideo, saveOptionalVideo } from './article-images.js';

const $ = id => document.getElementById(id);
const page = document.body.dataset.adminPage;

let services;
let editing = null;
let busy = false;
let dirty = false;
const previewUrls = new Map();
let videoPreviewUrl;

function message(text, tone = 'info') {
  $('message').textContent = text;
  $('message').dataset.tone = tone;
  if (tone !== 'info') $('message').scrollIntoView({ block: 'nearest' });
}

function errorMessage(error) {
  if (error.code === 'permission-denied') {
    return 'Your account does not have permission. Please sign in again or contact the site administrator.';
  }

  if (error.code?.startsWith('auth/')) {
    return 'Unable to log in. Check your email and password, or contact the site administrator.';
  }

  return error.message || 'The operation failed. Please try again.';
}

function setBusy(value) {
  busy = value;

  document
    .querySelectorAll('#dashboard button')
    .forEach(button => {
      button.disabled = value;
    });

  $('editor-fields').disabled = value;
  $('save-label').textContent = value ? 'Saving...' : 'Save / Publish';
}

function dateValue(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function discard() {
  return !dirty || confirm('Discard your unsaved article changes?');
}

function openEditor(article = null) {
  if (busy || !discard()) return;

  editing = article;
  dirty = false;

  $('article-form').reset();
  resetImagePreviews();

  $('editor-heading').textContent = article
    ? 'Edit article'
    : 'New article';

  $('title').value = article?.title || '';
  $('content').value = article?.content || '';

  $('publishedAt').max = dateValue();

  $('publishedAt').value = article
    ? dateValue(article.publishedAt.toDate())
    : dateValue();

  $('editor').hidden = false;
  $('article-library').hidden = true;
  $('add-article').hidden = true;
  $('workspace-label').textContent = article ? 'Edit article' : 'New article';
  for (const slot of [1, 2]) {
    $('remove' + slot).disabled = !article?.['image' + slot];
    if (article?.['image' + slot]) {
      void appendImages($('preview' + slot), { title: article.title, image1: article['image' + slot] }, { showUnavailable: true });
    }
    $('image-status' + slot).textContent = article?.['image' + slot] ? 'Current image' : 'No image selected';
  }
  $('remove-video').disabled = !article?.video;
  $('video-status').textContent = article?.video ? 'Current video' : 'No video selected';
  if (article?.video) void appendVideo($('video-preview'), article.video, { showUnavailable: true });
  $('title').focus();
}

function closeEditor() {
  resetImagePreviews();
  editing = null;
  dirty = false;
  $('editor').hidden = true;
  $('article-library').hidden = false;
  $('add-article').hidden = false;
  $('workspace-label').textContent = 'News articles';
}

function resetImagePreviews() {
  for (const url of previewUrls.values()) URL.revokeObjectURL(url);
  previewUrls.clear();
  for (const slot of [1, 2]) clearImages($('preview' + slot));
  if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
  videoPreviewUrl = null;
  clearVideo($('video-preview'));
}

async function refresh() {
  $('list-status').textContent = 'Loading articles…';

  const articles = await listArticles();

  $('articles').replaceChildren();

  for (const article of articles) {
    const row = document.createElement('article');
    row.className = 'admin-article';

    const title = document.createElement('h3');
    title.textContent = article.title;

    const meta = document.createElement('p');
    meta.textContent = `Published · ${formatDate(article.publishedAt)}`;

    const images = document.createElement('div');
    images.className = 'admin-thumbnails';
    const details = document.createElement('div');
    details.className = 'admin-article-details';
    const imageCount = [article.image1, article.image2].filter(Boolean).length;
    const imageNote = document.createElement('span');
    imageNote.className = 'admin-image-count';
    const mediaNotes = [imageCount ? `${imageCount} image${imageCount === 1 ? '' : 's'}` : '', article.video ? 'video' : ''].filter(Boolean);
    imageNote.textContent = mediaNotes.join(' + ') || 'Text only';
    details.append(title, meta, imageNote, images);

    const actions = document.createElement('div');
    actions.className = 'button-row';

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.className = 'admin-secondary';
    edit.onclick = () => openEditor(article);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Delete';
    remove.className = 'admin-delete';
    remove.onclick = () => deleteArticle(article);

    actions.append(edit, remove);

    row.append(details, actions);

    $('articles').append(row);

    void appendImages(images, article);
  }

  $('list-status').textContent = articles.length
    ? ''
    : 'No articles yet. Select Add New Article to get started.';
  $('article-count').textContent = `${articles.length} published`;
}

async function refreshAfterWrite() {
  try {
    await refresh();
  } catch {
    $('list-status').textContent =
      'The change was saved, but the list could not refresh. Reload this page.';
  }
}

async function deleteArticle(article) {
  if (
    busy ||
    !discard() ||
    !confirm(`Delete “${article.title}”? This cannot be undone.`)
  ) {
    return;
  }

  setBusy(true);

  try {
    const reference = doc(services.db, 'articles', article.id);

    await runTransaction(services.db, async transaction => {
      const current = await transaction.get(reference);

      if (
        !current.exists() ||
        !current.data().updatedAt.isEqual(article.updatedAt)
      ) {
        throw new Error(
          'This article changed in another session. Reload before deleting.'
        );
      }

      transaction.delete(reference);
    });

    closeEditor();

    message('Article deleted successfully.');
    // Image cleanup is independent of the completed deletion.
    void cleanupImages([article.image1, article.image2, article.video]);

    await refreshAfterWrite();
  } catch (error) {
    message(errorMessage(error));
  } finally {
    setBusy(false);
  }
}

async function save(event) {
  event.preventDefault();

  if (busy) return;

  setBusy(true);
  message('Saving article…');
  let imageResult;
  let videoResult;
  let committed = false;

  try {
    const title = $('title').value.trim();
    const content = $('content').value.trim();

    const date = new Date(
      `${$('publishedAt').value}T00:00:00Z`
    );

    if (!title || !content) {
      throw new Error('Title and content are required.');
    }

    if (!Number.isFinite(date.getTime()) || date > new Date()) {
      throw new Error(
        'Choose today or a past publication date.'
      );
    }

    const reference = editing
      ? doc(services.db, 'articles', editing.id)
      : doc(collection(services.db, 'articles'));

    const data = {
      title,
      content,
      status: 'published',
      publishedAt: Timestamp.fromDate(date),

      image1: editing?.image1 || null,
      image2: editing?.image2 || null,
      video: editing?.video || null,

      createdAt: editing?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    for (const key of ['category', 'action']) {
      if (editing?.[key]) {
        data[key] = editing[key];
      }
    }

    // Keep the original summary unless the body has changed.
    if (
      editing?.excerpt &&
      content === editing.content
    ) {
      data.excerpt = editing.excerpt;
    }

    const selections = [1, 2].map(slot => ({
      file: $('image' + slot).files[0], remove: $('remove' + slot).checked,
    }));
    if (selections.some(selection => selection.file)) message('Saving article and trying the optional images. Your text can still be saved if an image fails.');
    imageResult = await saveOptionalImages(reference.id, editing, selections);
    Object.assign(data, imageResult.images);
    videoResult = await saveOptionalVideo(reference.id, editing, { file: $('video').files[0], remove: $('remove-video').checked });
    data.video = videoResult.video;

    await runTransaction(services.db, async transaction => {
      const current = await transaction.get(reference);

      if (
        editing &&
        (
          !current.exists() ||
          !current.data().updatedAt.isEqual(editing.updatedAt)
        )
      ) {
        throw new Error(
          'This article changed in another session. Copy your changes, then reload before saving.'
        );
      }

      if (!editing && current.exists()) {
        throw new Error(
          'This article already exists. Please reload.'
        );
      }

      transaction.set(reference, data);
    });
    committed = true;
    const oldPaths = [editing?.image1, editing?.image2, editing?.video].filter(path => path && path !== data.image1 && path !== data.image2 && path !== data.video);
    closeEditor();
    const warning = [...imageResult.warnings, ...videoResult.warnings].join(' ');
    message('Article published successfully. ' + (warning || 'It is now available on the News page.'), warning ? 'warning' : 'success');
    // No waiting for image deletion before showing the saved article.
    void cleanupImages([...oldPaths, ...imageResult.abandoned, ...videoResult.abandoned]);

    await refreshAfterWrite();
  } catch (error) {
    if (!committed && imageResult?.uploaded.length) void cleanupImages(imageResult.uploaded);
    if (!committed && videoResult?.uploaded.length) void cleanupImages(videoResult.uploaded);
    message(errorMessage(error), 'error');
  } finally {
    setBusy(false);
  }
}

function wireDashboard() {
  $('add-article').onclick = () => openEditor();

  $('cancel').onclick = () => {
    if (discard()) {
      closeEditor();
    }
  };

  $('logout').onclick = async () => {
    if (!discard()) return;

    try {
      dirty = false;
      await signOut(services.auth);
    } catch (error) {
      message(errorMessage(error));
    }
  };

  $('article-form').onsubmit = save;

  $('article-form').oninput = () => {
    dirty = true;
  };

  for (const slot of [1, 2]) {
    $('image' + slot).onchange = () => {
      dirty = true;
      const file = $('image' + slot).files[0];
      if (!file) return;
      clearImages($('preview' + slot));
      if (previewUrls.has(slot)) URL.revokeObjectURL(previewUrls.get(slot));
      try {
        validateImage(file);
        const url = URL.createObjectURL(file);
        previewUrls.set(slot, url);
        const image = document.createElement('img');
        image.alt = `Selected image ${slot}`;
        image.onload = () => { if (previewUrls.get(slot) === url) $('preview' + slot).hidden = false; };
        image.onerror = () => {
          if (previewUrls.get(slot) === url) {
            clearImages($('preview' + slot));
            $('image-status' + slot).textContent = 'This image cannot be read. Your article can still be saved.';
          }
        };
        image.src = url;
        $('preview' + slot).append(image);
        $('remove' + slot).checked = false;
        $('image-status' + slot).textContent = `${file.name} — ready to upload when you save`;
      } catch (error) {
        $('image-status' + slot).textContent = error.message + ' Your article can still be saved; this image will be skipped.';
      }
    };
    $('remove' + slot).onchange = () => {
      dirty = true;
      $('image' + slot).value = '';
      clearImages($('preview' + slot));
      const existing = editing?.['image' + slot];
      $('image-status' + slot).textContent = $('remove' + slot).checked ? 'Image will be removed when you save.' : (existing ? 'Current image' : 'No image selected');
      if (!$('remove' + slot).checked && existing) void appendImages($('preview' + slot), { title: editing.title, image1: existing }, { showUnavailable: true });
    };
  }

  $('video').onchange = () => {
    dirty = true;
    const file = $('video').files[0];
    if (!file) return;
    clearVideo($('video-preview'));
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    try {
      validateVideo(file);
      videoPreviewUrl = URL.createObjectURL(file);
      const player = document.createElement('video');
      player.controls = true;
      player.playsInline = true;
      player.preload = 'metadata';
      player.src = videoPreviewUrl;
      $('video-preview').append(player);
      $('video-preview').hidden = false;
      $('remove-video').checked = false;
      $('video-status').textContent = file.name + ' — ready to upload when you save';
    } catch (error) {
      $('video-status').textContent = error.message + ' Your article can still be saved; this video will be skipped.';
    }
  };
  $('remove-video').onchange = () => {
    dirty = true;
    $('video').value = '';
    clearVideo($('video-preview'));
    $('video-status').textContent = $('remove-video').checked ? 'Video will be removed when you save.' : (editing?.video ? 'Current video' : 'No video selected');
    if (!$('remove-video').checked && editing?.video) void appendVideo($('video-preview'), editing.video, { showUnavailable: true });
  };

  window.addEventListener('beforeunload', event => {
    if (dirty || busy) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}

try {
  services = getFirebase();

  await setPersistence(
    services.auth,
    browserSessionPersistence
  );

  if (page === 'dashboard') {
    wireDashboard();
  }

  if (page === 'login') {
    $('login-form').onsubmit = async event => {
      event.preventDefault();

      const button = event.currentTarget.querySelector('button');

      button.disabled = true;

      message('Signing in…');

      try {
        await signInWithEmailAndPassword(
          services.auth,
          $('email').value.trim(),
          $('password').value
        );
      } catch (error) {
        message(errorMessage(error));
      } finally {
        button.disabled = false;
      }
    };
  }

  onIdTokenChanged(services.auth, async user => {
    if (page === 'dashboard') {
      $('dashboard').hidden = true;
    }

    try {
      if (!user) {
        if (page !== 'login') {
          location.replace('/admin/login');
          return;
        }

        $('login-form').hidden = false;

        if (!$('message').textContent.includes('permission')) {
          message('');
        }

        return;
      }

      const token = await user.getIdTokenResult();

      if (token.claims.newsAdmin !== true) {
        message(
          'Your account does not have News editing permission. Contact the site administrator.'
        );

        await signOut(services.auth);
        return;
      }

      if (page !== 'dashboard') {
        location.replace('/admin/dashboard');
        return;
      }

      $('dashboard').hidden = false;
      $('account').textContent = user.email;

      message('');

      await refresh();
    } catch (error) {
      message(errorMessage(error));
    }
  });
} catch (error) {
  message(errorMessage(error));
}
