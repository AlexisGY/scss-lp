import assert from 'node:assert/strict';
import { once } from 'node:events';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import sassLint from 'sass-lint';
import { auditBem } from '../scripts/bem.mjs';
import { defaultSections, generateLanding } from '../src/generator.mjs';
import { createAppServer } from '../src/server.mjs';

// Copia scss/ a un directorio temporal y reemplaza un fragmento de _config.scss.
async function compileWith(t, search, replacement) {
  const directory = await mkdtemp(join(tmpdir(), 'scss-lp-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp(fileURLToPath(new URL('../scss/', import.meta.url)), directory, { recursive: true });
  const config = join(directory, '_config.scss');
  const original = (await readFile(config, 'utf8')).replace(/\r\n/g, '\n');
  const found = typeof search === 'string' ? original.includes(search) : search.test(original);
  assert.ok(found, `No se encontró ${search} en _config.scss`);
  await writeFile(config, original.replace(search, replacement));
  return generateLanding(defaultSections, directory);
}

function rules(css, selector) {
  const found = [];
  postcss.parse(css).walkRules((rule) => {
    if (rule.selector === selector) {
      found.push({
        context: rule.parent.type === 'atrule' ? rule.parent.params : '',
        declarations: Object.fromEntries(rule.nodes.filter((n) => n.type === 'decl').map((n) => [n.prop, n.value])),
      });
    }
  });
  return found;
}

function declaration(css, selector, property) {
  const values = rules(css, selector).map((r) => r.declarations[property]).filter((v) => v !== undefined);
  assert.equal(values.length, 1, `Se esperaba un único ${property} en ${selector}; hay ${values.length}`);
  return values[0];
}

// Columnas que ocupa en tablet el elemento con esa clase, segun su utilidad
// .col-tablet-N en el HTML (y comprobando que esa utilidad exista en el CSS).
function spanOf(css, html, name) {
  const element = html.match(new RegExp(`class="([^"]*\\b${name}(?![\\w-])[^"]*)"`));
  assert.ok(element, `No hay ningún elemento con la clase ${name}`);
  const utility = element[1].match(/\bcol-tablet-(\d+)\b/);
  assert.ok(utility, `${name} no usa una utilidad col-tablet-N: "${element[1]}"`);
  assert.equal(declaration(css, `.col-tablet-${utility[1]}`, '--grid-span'), utility[1]);
  return Number(utility[1]);
}

// ---------------------------------------------------------------- grid

test('grid: la landing se maqueta con sus propias utilidades .col-*', () => {
  const { css, html } = generateLanding(defaultSections);
  assert.deepEqual(['hero__content', 'hero__art'].map((n) => spanOf(css, html, n)), [7, 5]);
  assert.deepEqual(['layout', 'speed', 'scale'].map((v) => spanOf(css, html, `benefits__card_${v}`)), [4, 4, 4]);
});

test('grid: si falta el breakpoint que usa el HTML, la compilación lo dice', async (t) => {
  await assert.rejects(compileWith(t, 'tablet: 640px', 'medium: 640px'), /breakpoint "tablet"/);
});

test('grid: un hijo no hereda el span, offset ni relleno de un ancestro (grids anidados)', () => {
  const { css } = generateLanding(defaultSections);
  const [reset] = rules(css, ':where(.grid > *)');
  assert.ok(reset, 'Falta la regla de especificidad cero que reinicia las variables del hijo directo');
  assert.deepEqual(reset.declarations, { '--grid-span': 'initial', '--grid-start': 'initial' });
});

test('grid: un offset sin .col- ocupa solo las columnas restantes (no crea columnas implícitas)', () => {
  const { css } = generateLanding(defaultSections);
  for (let offset = 0; offset < 12; offset += 1) {
    const [base] = rules(css, `.offset-${offset}`).filter((r) => r.context === '');
    assert.deepEqual(base.declarations, { '--grid-start': String(offset + 1) });
  }
  // El ancho por defecto son las columnas que quedan a partir del inicio, calculadas en una sola regla.
  assert.equal(declaration(css, '.grid > *', 'grid-column'),
    'var(--grid-start, auto)/span var(--grid-span, calc(var(--grid-columns) - var(--grid-start, 1) + 1))');
});

test('criterio de éxito: con cualquier número de columnas las tarjetas llenan la fila completa', async (t) => {
  for (const columns of [3, 4, 5, 7, 12, 14, 16, 17, 24]) {
    const { css, html } = await compileWith(t, '$grid-columns: 12;', `$grid-columns: ${columns};`);
    const spans = ['layout', 'speed', 'scale'].map((v) => spanOf(css, html, `benefits__card_${v}`));
    assert.equal(spans.reduce((a, b) => a + b, 0), columns, `${columns} columnas: spans ${spans}`);
    assert.ok(Math.max(...spans) - Math.min(...spans) <= 1, `${columns} columnas: reparto desigual ${spans}`);
    const hero = ['hero__content', 'hero__art'].map((name) => spanOf(css, html, name));
    assert.equal(hero[0] + hero[1], columns);
  }
});

test('breakpoints: un mapa desordenado se rechaza porque rompería la cascada', async (t) => {
  await assert.rejects(
    compileWith(t, /\$breakpoints: \([^)]*\);/, '$breakpoints: (desktop: 960px, tablet: 640px);'),
    /orden ascendente/,
  );
});

test('breakpoints: agregar una entrada al mapa genera sola su media query y sus utilidades', async (t) => {
  const { css, report } = await compileWith(t, 'desktop: 960px', 'desktop: 960px,\n  wide: 1280px');
  const [wide] = rules(css, '.col-wide-12');
  assert.equal(wide.context, '(min-width: 1280px)');
  assert.equal(report.duplicateRules, 0);
});

// ---------------------------------------------------------------- tipografía

test('fluid-type: el clamp() da el mínimo en el viewport mínimo y el máximo en el máximo', () => {
  const { css } = generateLanding(defaultSections);
  const value = declaration(css, '.hero__title', 'font-size');
  const match = value.match(/^clamp\(([\d.]+)rem, (-?[\d.]+)rem \+ ([\d.]+)vw, ([\d.]+)rem\)$/);
  assert.ok(match, value);
  const [min, intercept, slope, max] = match.slice(1).map(Number);
  const at = (viewport) => intercept * 16 + (slope / 100) * viewport;
  assert.ok(Math.abs(at(360) - 44) < 0.01, `a 360px da ${at(360)}`);
  assert.ok(Math.abs(at(1200) - 94) < 0.01, `a 1200px da ${at(1200)}`);
  assert.equal(min * 16, 44);
  assert.equal(max * 16, 94);
});

// ---------------------------------------------------------------- animaciones

test('animaciones: es una librería generada con @each (keyframes + clase BEM por entrada)', () => {
  const { css, html } = generateLanding(defaultSections);
  const names = [...css.matchAll(/@keyframes ([\w-]+)/g)].map((m) => m[1]);
  assert.ok(names.length >= 5, `Solo hay ${names.length} animaciones: ${names}`);
  for (const name of names) {
    assert.equal(declaration(css, `.motion_${name}`, 'animation').split(' ')[0], name);
  }
  const used = [...html.matchAll(/motion_([\w-]+)/g)].map((m) => m[1]);
  assert.ok(new Set(used).size >= 3, `La landing debería usar la librería; usa: ${used}`);
  for (const name of used) assert.ok(names.includes(name), `motion_${name} no existe`);
});

test('animaciones: agregar una entrada al mapa crea su keyframe y su clase, sin tocar otro archivo', async (t) => {
  const { css } = await compileWith(t, '$animations: (', '$animations: (\n  blink: (from: (opacity: 0), to: (opacity: 1)),');
  assert.match(css, /@keyframes blink/);
  assert.equal(rules(css, '.motion_blink').length, 1);
});

test('animaciones: la librería va en un solo bloque @media (sin repetirlo por clase)', () => {
  const { css } = generateLanding(defaultSections);
  assert.equal(css.split('@media (prefers-reduced-motion: no-preference)').length - 1, 1);
});

test('animaciones: todas respetan prefers-reduced-motion', () => {
  const { css } = generateLanding(defaultSections);
  postcss.parse(css).walkDecls('animation', (decl) => {
    assert.equal(decl.parent.parent.params, '(prefers-reduced-motion: no-preference)', decl.parent.selector);
  });
});

// ---------------------------------------------------------------- cada sección con loops y funciones

test('cta: su fondo se genera proceduralmente desde un mapa de configuración', async (t) => {
  const layers = (css) => declaration(css, '.cta', 'background-image').split('radial-gradient(').length - 1;
  const base = layers(generateLanding(defaultSections).css);
  assert.ok(base >= 2);
  const { css } = await compileWith(t, '$cta-glows: (', '$cta-glows: (\n  extra: (x: 50%, y: 50%, size: 30%, color: #ffffff22),');
  assert.equal(layers(css), base + 1);
});

// ---------------------------------------------------------------- BEM estricto

test('auditoría BEM: sass-lint sigue funcionando y rechaza nombres que no son BEM', () => {
  const config = fileURLToPath(new URL('../.sass-lint.yml', import.meta.url));
  const lint = (text) => sassLint.lintText({ text, format: 'scss', filename: 'x.scss' }, {}, config).errorCount;
  assert.equal(lint('.hero__title {}\n.grid_wide {}\n'), 0);
  for (const bad of ['.Hero', '.heroTitle', '.hero__title__text', '.hero--big', '.hero_a_b_c']) {
    assert.ok(lint(`${bad} {}\n`) > 0, `sass-lint debía rechazar ${bad}`);
  }
});

test('auditoría BEM: acepta el CSS generado', () => {
  assert.deepEqual(auditBem(generateLanding(defaultSections).css), []);
});

test('auditoría BEM: rechaza nombres y selectores que rompen la metodología', () => {
  const bad = [
    '.Hero', '.heroTitle', '.hero__title__text', '.hero--big', '.hero_a_b_c',
    '.hero__title.is-active', '.hero .hero__title', '.hero > .hero__title', '#hero', '.card #x',
  ];
  for (const selector of bad) {
    assert.ok(auditBem(`${selector} { color: red; }`).length > 0, `debía rechazar ${selector}`);
  }
});

test('auditoría BEM: permite pseudo-clases, el comodín del grid y los keyframes', () => {
  const ok = `.a__b:hover { color: red; } .grid > * { min-width: 0; } :where(.grid > *) { --x: initial; }
    .a__ring:nth-child(2) { color: red; } * { box-sizing: border-box; }
    @keyframes rise { from { opacity: 0; } 50% { opacity: 1; } }`;
  assert.deepEqual(auditBem(ok), []);
});

// ---------------------------------------------------------------- servidor y vista previa

test('servidor: una petición con URL mal formada responde 400 y no tumba el proceso', async (t) => {
  const server = createAppServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();

  const status = await new Promise((resolve, reject) => {
    const socket = connect(port, '127.0.0.1', () => socket.write('GET //[ HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'));
    let data = '';
    socket.on('data', (chunk) => { data += chunk; });
    socket.on('end', () => resolve(data.split('\r\n')[0]));
    socket.on('error', reject);
    socket.setTimeout(3000, () => { socket.destroy(); resolve('sin respuesta'); });
  });
  assert.match(status, /^HTTP\/1\.1 400/);
  assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status, 200);
});

test('vista previa: los enlaces internos se resuelven dentro del iframe; la descarga no se altera', async () => {
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(script, /frame\.srcdoc = .*<base href="about:srcdoc">/);
  assert.ok(!generateLanding(defaultSections).html.includes('<base'), 'el HTML descargable no debe llevar <base>');
});
