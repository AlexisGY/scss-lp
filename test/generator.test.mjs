import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import { defaultSections, generateLanding, inspectCss } from '../src/generator.mjs';

test('genera HTML y estilos únicamente para las secciones seleccionadas, en orden', () => {
  const { html, css, compressedCss, report } = generateLanding(['cta', 'hero']);
  assert.match(html, /<h1 class="cta__title"/);
  assert.match(html, /<h2 class="hero__title"/);
  assert.ok(html.indexOf('class="cta"') < html.indexOf('class="hero grid"'));
  assert.ok(!html.includes('id="beneficios"'));
  assert.ok(!css.includes('.benefits'));
  assert.ok(html.includes(compressedCss));
  assert.equal(report.bytes, Buffer.byteLength(compressedCss));
  assert.ok(report.bytes < report.expandedBytes);
  assert.equal(report.duplicateRules, 0);
});

test('compila una sola sección y valida entradas vacías, desconocidas o repetidas', () => {
  assert.match(generateLanding(['benefits']).html, /<h1 class="benefits__title"/);
  assert.throws(() => generateLanding([]), /entre una y tres/);
  assert.throws(() => generateLanding('hero'), /entre una y tres/);
  assert.throws(() => generateLanding(['constructor']), /desconocida/);
  assert.throws(() => generateLanding([null]), /desconocida/);
  assert.throws(() => generateLanding(['hero', 'hero']), /sola vez/);
});

function declarationsFor(css, selector, context = null) {
  const root = postcss.parse(css);
  const rules = [];
  root.walkRules(selector, (rule) => {
    if (context ? rule.parent.params === context : rule.parent.type === 'root') rules.push(rule);
  });
  assert.equal(rules.length, 1, `Debe haber una regla para ${selector} en ${context ?? 'base'}`);
  return Object.fromEntries(rules[0].nodes.map(({ prop, value }) => [prop, value]));
}

test('compila doce columnas, offsets, gutters, breakpoints, tipografía y animaciones', () => {
  const { css, report } = generateLanding(defaultSections);
  assert.equal(report.gridColumns, 12);
  assert.equal(declarationsFor(css, '.grid').gap, 'var(--grid-gutter, 1rem)');
  for (let column = 1; column <= 12; column += 1) {
    assert.equal(declarationsFor(css, `.col-${column}`)['--grid-span'], String(column));
    assert.equal(declarationsFor(css, `.offset-${column - 1}`)['--grid-start'], String(column));
  }
  assert.equal(declarationsFor(css, '.col-tablet-12', '(min-width: 640px)')['--grid-span'], '12');
  assert.equal(declarationsFor(css, '.offset-desktop-11', '(min-width: 960px)')['--grid-start'], '12');
  assert.match(declarationsFor(css, '.hero__title')['font-size'], /^clamp\(/);
  assert.match(css, /@keyframes appear/);
  assert.match(css, /@keyframes rise/);
  assert.match(css, /prefers-reduced-motion: no-preference/);
  assert.equal(report.duplicateRules, 0);
});

test('al cambiar una variable el layout y los utilitarios se regeneran para dieciséis columnas', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'scss-lp-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp(fileURLToPath(new URL('../scss/', import.meta.url)), directory, { recursive: true });
  const config = join(directory, '_config.scss');
  const original = await readFile(config, 'utf8');
  assert.match(original, /\$grid-columns: 12;/);
  await writeFile(config, original.replace('$grid-columns: 12;', '$grid-columns: 16;'));

  const { css, report } = generateLanding(defaultSections, directory);
  assert.equal(report.gridColumns, 16);
  assert.equal(declarationsFor(css, '.col-16')['--grid-span'], '16');
  assert.equal(declarationsFor(css, '.offset-15')['--grid-start'], '16');
  assert.equal(declarationsFor(css, '.col-desktop-16', '(min-width: 960px)')['--grid-span'], '16');
  assert.equal(declarationsFor(css, '.hero__content', '(min-width: 640px)')['--grid-span'], '9');
  assert.equal(declarationsFor(css, '.hero__art', '(min-width: 640px)')['--grid-span'], '7');
  assert.equal(report.duplicateRules, 0);
  assert.doesNotMatch(css, /\.col-17\b/);
});

test('el reporte detecta reglas repetidas dentro de cada contexto', () => {
  const css = `.demo { color: red; }
  @media (min-width: 640px) { .demo { color: red; } }
  .demo { color: blue; }
  .demo { color: red; }
  @media (min-width: 640px) { .demo { color: red; } }`;
  assert.deepEqual(inspectCss(css).duplicates, [
    { selector: '.demo', line: 4 },
    { selector: '.demo', line: 5 },
  ]);
});
