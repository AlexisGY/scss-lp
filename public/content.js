// Contenido editable que no es estilo: destino y visibilidad de enlaces, y una
// imagen propia en lugar de la ilustración. Vive en el navegador y viaja en el
// HTML que se descarga.
import { applyTexts } from './texts.js';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;

// Anclas de la página, web, correo o teléfono. Nunca javascript:, data:, etc.
export function isSafeHref(href) {
  if (typeof href !== 'string' || /[\u0000- "'<>]/.test(href)) return false;
  if (/^#[\w-]*$/.test(href)) return true;
  if (!/^(https?:\/\/|mailto:|tel:)/i.test(href)) return false;
  try {
    new URL(href);
    return true;
  } catch {
    return false;
  }
}

// Devuelve por qué no se puede usar el archivo, o null si sirve.
export function imageProblem({ type, size }) {
  if (!IMAGE_TYPES.includes(type)) return 'Usa una imagen PNG, JPG, WebP o GIF.';
  if (size > MAX_IMAGE_BYTES) return 'La imagen no puede pesar más de 1,5 MB.';
  return null;
}

const links = (root) => [...root.querySelectorAll('a[data-edit]')];

export function readLinks(root) {
  return Object.fromEntries(links(root).map((link) => [link.getAttribute('data-edit'), link.getAttribute('href')]));
}

function show(element, visible) {
  if (visible) element.removeAttribute('style');
  else element.style.display = 'none';
}

// content: { links: { clave: { href, hidden } }, image: { src, alt } | null }
export function applyContent(page, content, originalLinks) {
  for (const link of links(page)) {
    const key = link.getAttribute('data-edit');
    const change = content.links[key] ?? {};
    link.setAttribute('href', change.href && isSafeHref(change.href) ? change.href : originalLinks[key]);
    show(link, !change.hidden);
  }

  const figure = page.querySelector('.hero__art');
  if (!figure) return;
  let image = figure.querySelector('.hero__image');
  if (content.image && !image) {
    image = page.createElement('img');
    image.className = 'hero__image';
    figure.append(image);
  }
  if (content.image) {
    image.src = content.image.src;
    image.alt = content.image.alt ?? '';
  } else {
    image?.remove();
  }
  for (const child of figure.children) {
    if (!child.classList.contains('hero__image')) show(child, !content.image);
  }
  // Con descripción, la imagen deja de ser un adorno oculto a lectores de pantalla.
  if (content.image?.alt) figure.removeAttribute('aria-hidden');
  else figure.setAttribute('aria-hidden', 'true');
}

// HTML que se descarga: con los cambios aplicados, sin lo oculto ni marcas del editor.
export function exportHtml(html, texts, content) {
  const page = new DOMParser().parseFromString(html, 'text/html');
  applyTexts(page, texts);
  applyContent(page, content, readLinks(page));
  for (const element of page.querySelectorAll('[style]')) {
    if (element.style.display === 'none') element.remove();
  }
  if (texts.brand) page.title = `${texts.brand} · Landing de ejemplo`;
  for (const element of page.querySelectorAll('[data-edit]')) element.removeAttribute('data-edit');
  return `<!doctype html>\n${page.documentElement.outerHTML}\n`;
}
