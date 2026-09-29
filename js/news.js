import {
  listArticles,
  formatDate,
  summary
} from './news-data.js';
import { appendImages, appendVideo } from './article-images.js';

const grid = document.querySelector('#news-list');
const status = document.querySelector('#news-status');

try {
  const articles = await listArticles();

  for (const article of articles) {
    const card = document.createElement('article');
    card.className = 'card';

    const meta = document.createElement('p');
    meta.className = 'card__meta';
    meta.textContent = [
      article.category,
      formatDate(article.publishedAt)
    ]
      .filter(Boolean)
      .join(' · ');

    const title = document.createElement('h3');
    title.textContent = article.title;

    const excerpt = document.createElement('p');
    excerpt.textContent = summary(article);

    const link = document.createElement('a');
    link.href = `news-article.html?id=${encodeURIComponent(article.id)}`;
    link.textContent = 'Read article →';

    const images = document.createElement('div');
    images.className = 'news-images';
    const video = document.createElement('div');
    video.className = 'news-video';
    card.append(
      meta,
      title,
      excerpt,
      images,
      video,
      link
    );

    grid.append(card);
    void appendImages(images, article);
    void appendVideo(video, article.video);
  }

  status.textContent = articles.length
    ? ''
    : 'There are no news articles yet. Please check back soon.';
} catch (error) {
  console.error('Unable to load news articles:', error);

  status.textContent =
    'News is temporarily unavailable. Please try again later.';
} finally {
  grid.setAttribute('aria-busy', 'false');
}
