import assert from 'node:assert/strict';
import { once } from 'node:events';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { applyTexts, collectTexts, normalizeText, readTexts } from '../public/texts.js';
import { columnOptions, defaultSections, generateLanding } from '../src/generator.mjs';
import { createAppServer } from '../src/server.mjs';

async function scssWithColumns(t, columns) {
  const directory = await mkdtemp(join(tmpdir(), 'scss-lp-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp(fileURLToPath(new URL('../scss/', import.meta.url)), directory, { recursive: true });
  const config = join(directory, '_config.scss');
  const original = await readFile(config, 'utf8');
  assert.match(original, /\$grid-columns: 12 !default;/);
  await writeFile(config, original.replace('$grid-columns: 12 !default;', `$grid-columns: ${columns} !default;`));
  return directory;
}

// ---------------------------------------------------------------- selector de columnas

test('columnas: la pantalla ofrece 12 y 16', () => {
  assert.deepEqual([...columnOptions], [12, 16]);
});

test('columnas: la opción sobrescribe la única variable $grid-columns y todo se regenera', () => {
  const { css, html, report } = generateLanding(defaultSections, undefined, { columns: 16 });
  assert.equal(report.gridColumns, 16);
  assert.equal(report.duplicateRules, 0);
  for (const selector of ['.col-16 ', '.offset-15 ', '.col-tablet-16 ', '.col-desktop-16 ']) {
    assert.ok(css.includes(selector), `falta ${selector}`);
  }
  assert.match(html, /class="hero__content col-tablet-9 /);
  assert.match(html, /class="hero__art col-tablet-7 /);
  assert.deepEqual([...html.matchAll(/benefits__card_\w+ col-tablet-(\d+)/g)].map((m) => m[1]), ['6', '5', '5']);
});

test('columnas: sin elegir nada manda _config.scss (la demo de editar el archivo sigue sirviendo)', async (t) => {
  assert.equal(generateLanding(defaultSections).report.gridColumns, 12);
  const edited = await scssWithColumns(t, 14);
  assert.equal(generateLanding(defaultSections, edited).report.gridColumns, 14);
  assert.equal(generateLanding(defaultSections, edited, { columns: 12 }).report.gridColumns, 12);
});

test('columnas: solo se aceptan los valores de la lista (nada llega sin validar al código SCSS)', () => {
  for (const columns of [13, 0, '16', 16.5, '12); @import "x', null]) {
    assert.throws(() => generateLanding(defaultSections, undefined, { columns }), TypeError, String(columns));
  }
});

test('columnas: la API recibe ?columns= y rechaza valores no permitidos', async (t) => {
  const server = createAppServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const api = `http://127.0.0.1:${server.address().port}/api/landing?sections=hero,benefits,cta`;

  assert.equal((await (await fetch(api)).json()).report.gridColumns, 12);
  assert.equal((await (await fetch(`${api}&columns=16`)).json()).report.gridColumns, 16);
  for (const bad of ['13', 'abc', '', '16.0', '0x10', '16;']) {
    const response = await fetch(`${api}&columns=${encodeURIComponent(bad)}`);
    assert.equal(response.status, 400, `columns=${bad}`);
    assert.match((await response.json()).error, /columnas/);
  }
  const module = await fetch(`http://127.0.0.1:${server.address().port}/texts.js`);
  assert.equal(module.status, 200);
  assert.match(module.headers.get('content-type'), /javascript/);
});

// ---------------------------------------------------------------- edición de texto

test('texto: cada texto visible de la landing es editable y tiene una clave única', () => {
  const { html } = generateLanding(defaultSections);
  const keys = [...html.matchAll(/data-edit="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(keys).size, keys.length, 'claves repetidas');
  // Todo nodo de texto del <body> debe estar dentro de un elemento con data-edit.
  const body = html.slice(html.indexOf('<body'), html.indexOf('</body>'));
  const loose = body.replace(/<(\w+)[^>]*\sdata-edit="[^"]+"[^>]*>[^<]*<\/\1>/g, '').replace(/<[^>]+>/g, '\n')
    .split('\n').map((line) => line.trim()).filter(Boolean);
  assert.deepEqual(loose, [], 'textos sin data-edit');
});

test('texto: las claves no cambian al quitar o reordenar secciones', () => {
  const keysOf = (selection) => new Set([...generateLanding(selection).html.matchAll(/data-edit="([^"]+)"/g)].map((m) => m[1]));
  const all = keysOf(defaultSections);
  for (const key of keysOf(['cta', 'hero'])) assert.ok(all.has(key), key);
});

test('texto: se normaliza a una sola línea', () => {
  assert.equal(normalizeText('  Hola \n\n  mundo  cruel  '), 'Hola mundo cruel');
  assert.equal(normalizeText(' \n '), '');
});

// Documento mínimo: solo lo que usan las funciones de texts.js.
function fakeDocument(texts) {
  const elements = Object.entries(texts).map(([key, textContent]) => ({
    textContent,
    getAttribute: (name) => (name === 'data-edit' ? key : null),
  }));
  return { elements, querySelectorAll: () => elements };
}

test('texto: solo se guardan los cambios; borrar o volver al original restaura el texto', () => {
  const defaults = { 'hero.title': 'Original', 'cta.title': 'Cierre', 'footer.text': 'Pie' };
  const page = fakeDocument({ 'hero.title': '  Mi   título ', 'cta.title': 'Cierre', 'footer.text': '   ' });
  const overrides = collectTexts(page, defaults, { 'cta.title': 'Antes lo cambié', 'footer.text': 'Otro pie' });
  assert.deepEqual(overrides, { 'hero.title': 'Mi título' });
});

test('texto: los cambios de una sección oculta se conservan para cuando vuelva', () => {
  const overrides = collectTexts(fakeDocument({ 'cta.title': 'Cierre' }), { 'cta.title': 'Cierre' }, { 'hero.title': 'Guardado' });
  assert.deepEqual(overrides, { 'hero.title': 'Guardado' });
});

test('texto: readTexts y applyTexts leen y escriben solo texto plano', () => {
  const page = fakeDocument({ 'hero.title': 'A', 'cta.title': 'B' });
  assert.deepEqual(readTexts(page), { 'hero.title': 'A', 'cta.title': 'B' });
  applyTexts(page, { 'hero.title': '<img src=x onerror=alert(1)>' });
  assert.equal(page.elements[0].textContent, '<img src=x onerror=alert(1)>'); // se asigna como texto, no como HTML
  assert.equal(page.elements[1].textContent, 'B');
});

test('constructor: la vista previa permite editar sin ejecutar scripts', async () => {
  const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const sandbox = index.match(/<iframe[^>]*sandbox="([^"]*)"/)[1];
  assert.equal(sandbox, 'allow-same-origin', 'sin allow-scripts: la landing no puede ejecutar código');
  assert.match(index, /id="edit-text"/);
  assert.match(index, /name="columns" value="12"/);
  assert.match(index, /name="columns" value="16"/);
});
