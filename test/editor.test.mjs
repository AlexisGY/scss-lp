import assert from 'node:assert/strict';
import { once } from 'node:events';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import { auditBem } from '../scripts/bem.mjs';
import { isSafeHref, imageProblem } from '../public/content.js';
import { defaultSections, generateLanding } from '../src/generator.mjs';
import { createAppServer } from '../src/server.mjs';

const build = (settings, options = {}) => generateLanding(defaultSections, undefined, { ...options, settings });

async function scssWith(t, search, replacement) {
  const directory = await mkdtemp(join(tmpdir(), 'scss-lp-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp(fileURLToPath(new URL('../scss/', import.meta.url)), directory, { recursive: true });
  const config = join(directory, '_config.scss');
  const original = (await readFile(config, 'utf8')).replace(/\r\n/g, '\n');
  assert.ok(original.includes(search), `no está "${search}" en _config.scss`);
  await writeFile(config, original.replace(search, replacement));
  return directory;
}

// Declaraciones de un selector fuera de las media queries.
function base(css, selector) {
  const found = {};
  postcss.parse(css).walkRules((rule) => {
    if (rule.selector === selector && rule.parent.type === 'root') {
      rule.walkDecls((d) => { found[d.prop] = d.value; });
    }
  });
  return found;
}

const cardSpans = (html) => [...html.matchAll(/benefits__card_[\w-]+ col-tablet-(\d+)/g)].map((m) => Number(m[1]));
const cardIds = (html) => [...html.matchAll(/class="benefits__card benefits__card_([\w-]+)/g)].map((m) => m[1]);
const cardsOf = (...ids) => ids.map((id) => ({ id, color: '#ffffff' }));

// ---------------------------------------------------------------- valores efectivos

test('editor: el resultado informa los valores efectivos leídos de _config.scss', () => {
  const { settings, scss } = generateLanding(defaultSections);
  assert.equal(settings.colors.background, '#1c1a2c');
  assert.equal(settings.colors.accent, '#ffc6a8');
  assert.equal(settings.gutter, 1);
  assert.equal(settings.duration, 420);
  assert.deepEqual(settings.breakpoints, { tablet: 640, desktop: 960 });
  assert.deepEqual(settings.type.hero, { min: 44, max: 94 });
  assert.deepEqual(settings.cards.map((c) => c.id), ['layout', 'speed', 'scale']);
  assert.equal(settings.glows.peach, '#ffc6a81f');
  assert.deepEqual(settings.animations, ['appear', 'rise', 'slide-left', 'slide-right', 'zoom-in']);
  assert.ok(!scss.includes('@use "config" with'), 'sin cambios no se configura nada');
});

// ---------------------------------------------------------------- colores

test('editor: cada color de la paleta se aplica al CSS compilado', () => {
  const { settings } = generateLanding(defaultSections);
  const keys = Object.keys(settings.colors);
  assert.ok(keys.length >= 12, `solo ${keys.length} colores`);
  const colors = Object.fromEntries(keys.map((key, i) => [key, `#0a0b${(16 + i).toString(16)}`]));
  const { css, scss } = build({ colors });
  // Los colores con transparencia salen como rgba() con los mismos canales.
  const asRgb = (hex) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')}, `;
  for (const [key, color] of Object.entries(colors)) {
    assert.ok(css.includes(color) || css.includes(asRgb(color)), `el color ${key} no se usa`);
  }
  assert.match(scss, /@use "config" with \(\$palette: \(/);
});

test('editor: cambiar un color no pisa lo editado a mano en _config.scss', async (t) => {
  const directory = await scssWith(t, '$gutter: 1rem !default;', '$gutter: 2rem !default;');
  const { css } = generateLanding(defaultSections, directory, { settings: { colors: { background: '#000000' } } });
  assert.equal(base(css, '.landing').background, '#000000');
  assert.equal(base(css, '.landing').color, '#faf8f2');
  assert.equal(base(css, '.grid').gap, 'var(--grid-gutter, 2rem)');
});

test('editor: los brillos cambian de color y conservan posición y transparencia', () => {
  const { css } = build({ glows: { peach: '#00ff00' } });
  assert.match(base(css, '.cta')['background-image'], /circle at 12% 0%, rgba\(0, 255, 0, 0\.12\d*\), transparent 55%/);
});

// ---------------------------------------------------------------- grid, letra y animaciones

test('editor: gutter, breakpoints, escala tipográfica y duración recompilan el CSS', () => {
  const { css, settings } = build({
    gutter: 2.5, breakpoints: { tablet: 700, desktop: 1100 }, type: { hero: { min: 30, max: 120 } }, duration: 900,
  });
  assert.equal(base(css, '.grid').gap, 'var(--grid-gutter, 2.5rem)');
  assert.match(css, /@media \(min-width: 700px\)/);
  assert.match(css, /@media \(min-width: 1100px\)/);
  assert.ok(!css.includes('640px'));
  assert.match(base(css, '.hero__title')['font-size'], /^clamp\(1\.875rem, .*, 7\.5rem\)$/);
  assert.match(css, /animation: rise 900ms ease-out both/);
  assert.deepEqual(settings.type.cta, { min: 27, max: 58 });
});

test('editor: se puede elegir o quitar la animación de cada elemento', () => {
  const { html } = build({ motion: { heroContent: 'none', heroArt: 'zoom-in', ctaLink: 'appear', cards: { speed: 'none', scale: 'zoom-in' } } });
  assert.match(html, /class="hero__content col-tablet-7"/);
  assert.match(html, /class="hero__art col-tablet-5 motion motion_zoom-in"/);
  assert.match(html, /class="landing__button cta__link motion motion_appear"/);
  assert.match(html, /benefits__card_layout col-tablet-4 motion motion_slide-right"/);
  assert.match(html, /benefits__card_speed col-tablet-4"/);
  assert.match(html, /benefits__card_scale col-tablet-4 motion motion_zoom-in"/);
});

// ---------------------------------------------------------------- tarjetas

test('editor: de 1 a 6 tarjetas, en filas de hasta 3 que siempre llenan la fila', () => {
  const ids = ['layout', 'speed', 'scale', 'extra1', 'extra2', 'extra3'];
  const expected = { 1: [12], 2: [6, 6], 3: [4, 4, 4], 4: [6, 6, 6, 6], 5: [4, 4, 4, 6, 6], 6: [4, 4, 4, 4, 4, 4] };
  for (let count = 1; count <= 6; count += 1) {
    const { html, css, report } = build({ cards: cardsOf(...ids.slice(0, count)) });
    assert.deepEqual(cardSpans(html), expected[count], `${count} tarjetas`);
    assert.equal(report.duplicateRules, 0);
    assert.deepEqual(auditBem(css), []);
  }
  assert.deepEqual(cardSpans(build({ cards: cardsOf(...ids.slice(0, 5)) }, { columns: 16 }).html), [6, 5, 5, 8, 8]);
});

test('editor: las tarjetas respetan el orden y los colores pedidos; las quitadas desaparecen', () => {
  const { html, css } = build({ cards: [{ id: 'scale', color: '#111111' }, { id: 'extra1', color: '#222222' }] });
  assert.deepEqual(cardIds(html), ['scale', 'extra1']);
  assert.equal(base(css, '.benefits__card_scale')['border-top-color'], '#111111');
  assert.equal(base(css, '.benefits__card_extra1')['border-top-color'], '#222222');
  assert.ok(!css.includes('benefits__card_layout'));
  assert.match(html, /data-edit="benefits\.extra1\.title"/);
});

test('editor: agregar una variante al mapa del archivo basta para que aparezca su tarjeta', async (t) => {
  const directory = await scssWith(t, '  scale: #b6e6d4', '  scale: #b6e6d4,\n  nueva: #123456');
  const { html } = generateLanding(defaultSections, directory);
  assert.deepEqual(cardIds(html), ['layout', 'speed', 'scale', 'nueva']);
  assert.match(html, /data-edit="benefits\.nueva\.title"/);
});

// ---------------------------------------------------------------- validación

test('editor: se rechaza todo valor fuera de lista o rango (nada se inyecta en SCSS)', () => {
  const bad = [
    'texto', 7, [], null,
    { desconocido: 1 },
    { colors: { background: 'red' } }, { colors: { background: '#fff' } },
    { colors: { background: '#000000); @import "x"; (' } }, { colors: { inventado: '#000000' } },
    { gutter: -1 }, { gutter: 3.5 }, { gutter: '1' }, { gutter: Number.NaN },
    { breakpoints: { tablet: 200 } }, { breakpoints: { tablet: '700' } }, { breakpoints: { movil: 700 } },
    { type: { hero: { min: 90, max: 40 } } }, { type: { hero: { min: 5 } } }, { type: { pie: { min: 20 } } },
    { duration: 99999 }, { duration: 1.5 },
    { glows: { peach: 'x' } }, { glows: { otro: '#000000' } },
    { cards: [] }, { cards: cardsOf('layout', 'layout') }, { cards: cardsOf('__proto__') },
    { cards: cardsOf('x) {} body { color: red') }, { cards: cardsOf('layout', 'speed', 'scale', 'extra1', 'extra2', 'extra3', 'extra4') },
    { cards: [{ id: 'layout', color: 'blue' }] }, { cards: [{ id: 'layout', color: '#000000', css: 'x' }] },
    { motion: { heroArt: 'nope' } }, { motion: { heroArt: 'rise" onload="x' } }, { motion: { otro: 'rise' } },
    JSON.parse('{"colors":{"__proto__":"#000000"}}'),
  ];
  for (const settings of bad) {
    assert.throws(() => build(settings), TypeError, JSON.stringify(settings));
  }
});

test('editor: la API recibe la configuración y responde 400 si no es válida', async (t) => {
  const server = createAppServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const site = `http://127.0.0.1:${server.address().port}`;
  const call = (settings) => fetch(`${site}/api/landing?${new URLSearchParams({ sections: 'cta,benefits', settings })}`);

  const good = await (await call(JSON.stringify({ colors: { cta: '#102030' }, cards: cardsOf('speed') }))).json();
  assert.ok(good.css.includes('#102030'));
  assert.ok(good.html.indexOf('id="contacto"') < good.html.indexOf('id="beneficios"'), 'respeta el orden pedido');
  for (const settings of ['{mal', '"hola"', '{"gutter":99}', `{"colors":{${' '.repeat(9000)}}}`]) {
    const response = await call(settings);
    assert.equal(response.status, 400, settings.slice(0, 40));
    assert.ok((await response.json()).error);
  }
  for (const file of ['content.js', 'controls.js']) {
    assert.equal((await fetch(`${site}/${file}`)).status, 200, file);
  }
});

// ---------------------------------------------------------------- enlaces e imagen

test('contenido: solo se aceptan enlaces seguros', () => {
  for (const href of ['#contacto', '#', 'https://example.com/x?y=1', 'http://example.com', 'mailto:a@b.pe', 'tel:+51999999999']) {
    assert.ok(isSafeHref(href), href);
  }
  for (const href of ['', 'javascript:alert(1)', ' JavaScript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,x', 'vbscript:x', '//evil.com', 'pagina.html', 'file:///c:/x', '#"><script>']) {
    assert.ok(!isSafeHref(href), href);
  }
});

test('contenido: la imagen propia se limita a formatos rasterizados y 1,5 MB', () => {
  for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/gif']) assert.equal(imageProblem({ type, size: 1000 }), null);
  assert.match(imageProblem({ type: 'image/svg+xml', size: 10 }), /PNG, JPG/);
  assert.match(imageProblem({ type: 'text/html', size: 10 }), /PNG, JPG/);
  assert.match(imageProblem({ type: 'image/png', size: 2_000_000 }), /1,5 MB/);
});
