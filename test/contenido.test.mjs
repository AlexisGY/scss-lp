import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { applyContent, exportHtml, readLinks } from '../public/content.js';
import { defaultSections, generateLanding } from '../src/generator.mjs';

// content.js usa el DOM del navegador; jsdom le da uno a Node.
const { window } = new JSDOM('');
globalThis.DOMParser = window.DOMParser;

const { html } = generateLanding(defaultSections);
const parse = (source = html) => new window.DOMParser().parseFromString(source, 'text/html');
const link = (page, key) => page.querySelector(`a[data-edit="${key}"]`);
const IMAGE = { src: 'data:image/png;base64,iVBORw0KGgo=', alt: 'Equipo trabajando' };

test('contenido: readLinks lee el destino de cada enlace editable', () => {
  const links = readLinks(parse());
  assert.deepEqual(Object.keys(links), ['brand', 'nav.benefits', 'nav.cta', 'hero.button.contact', 'cta.link']);
  assert.equal(links['nav.benefits'], '#beneficios');
});

test('contenido: un enlace inseguro vuelve a su destino original', () => {
  for (const href of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'https://a b', '']) {
    const page = parse();
    const original = readLinks(page);
    applyContent(page, { links: { 'cta.link': { href } }, image: null }, original);
    assert.equal(link(page, 'cta.link').getAttribute('href'), original['cta.link'], href);
  }
});

test('contenido: un enlace seguro reemplaza el destino', () => {
  for (const href of ['#contacto', 'https://example.com/', 'mailto:hola@example.com', 'tel:+51999999999']) {
    const page = parse();
    applyContent(page, { links: { 'cta.link': { href } }, image: null }, readLinks(page));
    assert.equal(link(page, 'cta.link').getAttribute('href'), href);
  }
});

test('contenido: un enlace oculto no sale en el HTML descargado', () => {
  const download = parse(exportHtml(html, {}, { links: { 'nav.cta': { hidden: true } }, image: null }));
  assert.equal(download.querySelectorAll('a').length, parse().querySelectorAll('a').length - 1);
  assert.equal(download.querySelector('.landing__nav a[href="#contacto"]'), null);
  assert.ok(download.querySelector('.landing__nav a[href="#beneficios"]'), 'los demás enlaces siguen');
});

test('contenido: una imagen propia reemplaza la ilustración y conserva su alt', () => {
  const page = parse();
  const figure = page.querySelector('.hero__art');
  applyContent(page, { links: {}, image: IMAGE }, readLinks(page));
  const image = figure.querySelector('.hero__image');
  assert.equal(image.getAttribute('src'), IMAGE.src);
  assert.equal(image.getAttribute('alt'), IMAGE.alt);
  assert.equal(figure.hasAttribute('aria-hidden'), false, 'con descripción la ve un lector de pantalla');
  for (const child of figure.children) {
    if (child !== image) assert.equal(child.style.display, 'none');
  }

  // En el HTML descargado solo queda la imagen.
  const download = parse(exportHtml(html, {}, { links: {}, image: IMAGE }));
  const art = download.querySelector('.hero__art');
  assert.equal(art.children.length, 1);
  assert.equal(art.querySelector('img.hero__image').getAttribute('alt'), IMAGE.alt);
});

test('contenido: quitar la imagen propia devuelve la ilustración', () => {
  const page = parse();
  const figure = page.querySelector('.hero__art');
  applyContent(page, { links: {}, image: IMAGE }, readLinks(page));
  applyContent(page, { links: {}, image: null }, readLinks(page));
  assert.equal(figure.querySelector('.hero__image'), null);
  assert.ok([...figure.children].every((child) => child.style.display === ''));
  assert.equal(figure.getAttribute('aria-hidden'), 'true');
});

test('contenido: el HTML descargado no lleva atributos data-edit', () => {
  const content = { links: { 'cta.link': { href: 'https://example.com/' } }, image: IMAGE };
  const output = exportHtml(html, { 'hero.title': 'Mi título', brand: 'Mi marca' }, content);
  assert.ok(html.includes('data-edit'), 'el HTML de partida sí los tiene');
  assert.ok(output.startsWith('<!doctype html>\n'));
  assert.doesNotMatch(output, /data-edit/);
  const download = parse(output);
  assert.equal(download.querySelector('.hero__title').textContent, 'Mi título');
  assert.equal(download.title, 'Mi marca · Landing de ejemplo');
});
