import {
  getArticle,
  formatDate,
  summary,
  renderContent
} from './news-data.js';
import { appendImages, appendVideo } from './article-images.js';

const $ = id => document.getElementById(id);
if (!$('article-video')) {
  const video = document.createElement('figure');
  video.className = 'container article-video';
  video.id = 'article-video';
  video.hidden = true;
  $('article-image').after(video);
}

try {
  const article = await getArticle(
    new URLSearchParams(location.search).get('id')
  );

  if (!article) {
    $('article-title').textContent = 'Article not found';
    $('article-meta').textContent = 'News';
    $('article-excerpt').textContent =
      'Return to the News page to browse the latest updates.';
  } else {
    $('article-title').textContent = article.title;

    $('article-meta').textContent = [
      article.category,
      formatDate(article.publishedAt)
    ]
      .filter(Boolean)
      .join(' · ');

    $('article-excerpt').textContent = summary(article);

    document.title = `${article.title} | MedicoTech`;

    document.querySelector(
      'meta[name="description"]'
    ).content = summary(article);

    renderContent(
      $('article-content'),
      article.content
    );

    // Images load independently; their failure never hides the article text.
    void appendImages($('article-image'), article);
    void appendVideo($('article-video'), article.video);

    if (
      article.action &&
      /^(contact|professional-services|ethics)\.html$/.test(
        article.action.url
      )
    ) {
      for (
        const [id, value] of Object.entries({
          label: article.action.label,
          title: article.action.title,
          text: article.action.description
        })
      ) {
        $(`article-action-${id}`).textContent = value || '';
      }

      $('article-action-link').href =
        article.action.url;

      $('article-action-link').textContent =
        article.action.text;

      $('article-action').hidden = false;
    }
  }
} catch (error) {
  console.error(
    'Unable to load article:',
    error
  );

  $('article-title').textContent =
    'Article unavailable';

  $('article-meta').textContent = 'News';

  $('article-excerpt').textContent =
    'We could not load this article. Please try again or return to the News page.';
} finally {
  $('article').setAttribute(
    'aria-busy',
    'false'
  );
}
