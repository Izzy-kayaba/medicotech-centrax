import { getFirebase } from './firebase-client.js';
import { firebaseConfig, useEmulators } from './firebase-config.js';

const MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TIMEOUT = 15000;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const VIDEO_TIMEOUT = 120000;
let storagePromise;

// Image services are loaded only when needed. Text articles and login do not
// depend on Storage being configured, reachable or allowed by its rules.
function within(promise, milliseconds = IMAGE_TIMEOUT) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Image request timed out.')), milliseconds); }),
  ]).finally(() => clearTimeout(timer));
}

async function imageServices() {
  if (!firebaseConfig.storageBucket) throw new Error('Image storage is not configured.');
  if (!storagePromise) {
    storagePromise = import('https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js').then(sdk => {
      const storage = sdk.getStorage(getFirebase().app);
      storage.maxUploadRetryTime = IMAGE_TIMEOUT;
      storage.maxOperationRetryTime = IMAGE_TIMEOUT;
      if (useEmulators && ['localhost', '127.0.0.1'].includes(location.hostname)) {
        sdk.connectStorageEmulator(storage, '127.0.0.1', 9199);
      }
      return { sdk, storage };
    }).catch(error => { storagePromise = null; throw error; });
  }
  return within(storagePromise);
}

export function validateImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG or WebP image.');
  if (!file.size || file.size > MAX_BYTES) throw new Error('Choose an image smaller than 5 MB.');
}

export function validateVideo(file) {
  if (!['video/mp4', 'video/webm'].includes(file.type)) throw new Error('Choose an MP4 or WebM video.');
  if (!file.size || file.size > MAX_VIDEO_BYTES) throw new Error('Choose a video no larger than 50 MB.');
}

async function uploadImage(path, file) {
  validateImage(file);
  const bitmap = await within(createImageBitmap(file));
  bitmap.close();
  const { sdk, storage } = await imageServices();
  const task = sdk.uploadBytesResumable(sdk.ref(storage, path), file, { contentType: file.type });
  const timer = setTimeout(() => task.cancel(), IMAGE_TIMEOUT);
  try { await task; } finally { clearTimeout(timer); }
}

export async function saveOptionalImages(articleId, previous, selections) {
  const uploaded = [], warnings = [], abandoned = [];
  const results = await Promise.all([1, 2].map(async slot => {
    const key = `image${slot}`, { file, remove } = selections[slot - 1];
    const existing = previous?.[key] || null;
    if (!file) return [key, remove ? null : existing];
    const path = `articles/${articleId}/${key}/${crypto.randomUUID()}`;
    try {
      await uploadImage(path, file);
      uploaded.push(path);
      return [key, path];
    } catch {
      abandoned.push(path);
      warnings.push(`Image ${slot} was not uploaded. ${existing ? 'The previous image has been kept.' : 'This image slot is empty.'} You can edit the article to try again later.`);
      return [key, existing];
    }
  }));
  return { images: Object.fromEntries(results), uploaded, warnings, abandoned };
}

export async function saveOptionalVideo(articleId, previous, { file, remove }) {
  const existing = previous?.video || null;
  if (!file) return { video: remove ? null : existing, uploaded: [], warnings: [], abandoned: [] };
  const path = `articles/${articleId}/video/${crypto.randomUUID()}`;
  try {
    validateVideo(file);
    const { sdk, storage } = await imageServices();
    const task = sdk.uploadBytesResumable(sdk.ref(storage, path), file, { contentType: file.type });
    const timer = setTimeout(() => task.cancel(), VIDEO_TIMEOUT);
    try { await within(task, VIDEO_TIMEOUT); } finally { clearTimeout(timer); }
    return { video: path, uploaded: [path], warnings: [], abandoned: [] };
  } catch (error) {
    return { video: existing, uploaded: [], warnings: [`Video upload failed (${error.message}). ${existing ? 'The previous video was kept.' : 'No video was added.'}`], abandoned: [path] };
  }
}

// Cleanup is always best-effort and never changes the article's save result.
export async function cleanupImages(paths) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return false;
  try {
    const { sdk, storage } = await imageServices();
    const results = await Promise.allSettled(unique.map(path => within(sdk.deleteObject(sdk.ref(storage, path)))));
    return results.some(result => result.status === 'rejected' && result.reason?.code !== 'storage/object-not-found');
  } catch { return true; }
}

export function clearImages(container) {
  container.dataset.imageRequest = crypto.randomUUID();
  container.replaceChildren();
  container.hidden = true;
}

export function clearVideo(container) {
  container.dataset.videoRequest = crypto.randomUUID();
  container.replaceChildren();
  container.hidden = true;
}

export async function appendVideo(container, path, { showUnavailable = false } = {}) {
  clearVideo(container);
  if (!path) return;
  const request = container.dataset.videoRequest;
  try {
    const { sdk, storage } = await imageServices();
    const url = await within(sdk.getDownloadURL(sdk.ref(storage, path)));
    if (container.dataset.videoRequest !== request) return;
    const video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = url;
    video.onerror = () => {
      if (container.dataset.videoRequest !== request) return;
      clearVideo(container);
      if (showUnavailable) {
        const note = document.createElement('p');
        note.className = 'image-unavailable';
        note.textContent = 'Video preview unavailable. You can keep, replace or remove the saved video.';
        container.append(note);
        container.hidden = false;
      }
    };
    container.append(video);
    container.hidden = false;
  } catch {
    if (!showUnavailable || container.dataset.videoRequest !== request) return;
    const note = document.createElement('p');
    note.className = 'image-unavailable';
    note.textContent = 'Video preview unavailable. You can keep, replace or remove the saved video.';
    container.append(note);
    container.hidden = false;
  }
}

// Metadata lookup errors AND browser image load errors are isolated per image.
// Public pages omit unavailable images; the editor explains missing previews.
export async function appendImages(container, article, { showUnavailable = false } = {}) {
  clearImages(container);
  const request = container.dataset.imageRequest;
  const paths = [article.image1, article.image2].filter(Boolean);
  const placeholders = paths.map(() => {
    const holder = document.createElement('span');
    holder.className = 'article-image-slot';
    container.append(holder);
    return holder;
  });
  await Promise.all(paths.map(async (path, index) => {
    try {
      const { sdk, storage } = await imageServices();
      const url = await within(sdk.getDownloadURL(sdk.ref(storage, path)));
      const img = document.createElement('img');
      img.alt = article.title || 'Article image';
      await within(new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Image unavailable.'));
        img.src = url;
      }));
      if (container.dataset.imageRequest !== request) return;
      placeholders[index].replaceWith(img);
      container.hidden = false;
    } catch {
      if (container.dataset.imageRequest !== request) return;
      if (showUnavailable) {
        const note = document.createElement('p');
        note.className = 'image-unavailable';
        note.textContent = 'Image preview unavailable. You can keep, replace or remove the saved image.';
        placeholders[index].replaceWith(note);
        container.hidden = false;
      } else placeholders[index].remove();
    }
  }));
}
