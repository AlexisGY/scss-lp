import assert from 'node:assert/strict';
import { once } from 'node:events';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import { auditBem } from '../scripts/bem.mjs';
import { defaultSections, generateLanding } from '../src/generator.mjs';
import { createAppServer } from '../src/server.mjs';

const TITLES = ['.landing__brand', '.hero__title', '.benefits__title', '.benefits__heading', '.cta__title'];
const build = (settings) => generateLanding(defaultSections, undefined, { settings });

function family(css, selector) {
  const found = [];
  postcss.parse(css).walkRules((rule) => {
    if (rule.selector === selector && rule.parent.type === 'root') {
      rule.walkDecls('font-family', (decl) => found.push(decl.value));
    }
  });
  assert.equal(found.length, 1, `${selector} debe declarar una sola font-family; tiene ${found.length}`);
  return found[0];
}

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

test('tipografía: hay una lista de fuentes y por defecto se usa la del sistema', () => {
  const { settings, css } = generateLanding(defaultSections);
  assert.deepEqual(settings.fonts, { heading: 'system', body: 'system' });
  assert.deepEqual(settings.fontOptions,
    ['system', 'geometric', 'humanist', 'serif', 'elegant', 'slab', 'condensed', 'mono', 'handwritten']);
  assert.equal(family(css, '.landing'), 'system-ui, sans-serif');
  for (const selector of TITLES) assert.equal(family(css, selector), 'system-ui, sans-serif');
});

test('tipografía: la del texto y la de los títulos se eligen por separado', () => {
  const body = build({ fonts: { body: 'serif' } }).css;
  assert.equal(family(body, '.landing'), 'Georgia, "Times New Roman", serif');
  for (const selector of TITLES) assert.equal(family(body, selector), 'system-ui, sans-serif');

  const heading = build({ fonts: { heading: 'mono' } }).css;
  assert.equal(family(heading, '.landing'), 'system-ui, sans-serif');
  for (const selector of TITLES) assert.match(family(heading, selector), /^Consolas, .*monospace$/);
});

test('tipografía: todas las opciones compilan, son distintas y terminan en una familia genérica', () => {
  const { fontOptions } = generateLanding(defaultSections).settings;
  const stacks = fontOptions.map((name) => {
    const { css, report, scss } = build({ fonts: { heading: name, body: name } });
    assert.equal(report.duplicateRules, 0, name);
    assert.deepEqual(auditBem(css), [], name);
    assert.match(scss, new RegExp(`\\$font-heading: ${name}, \\$font-body: ${name}`));
    // Sin descargas: el HTML sigue siendo autónomo.
    assert.ok(!/@import|@font-face|url\(|https?:/.test(css), name);
    const stack = family(css, '.landing');
    assert.match(stack, /(sans-serif|serif|monospace|cursive)$/, name);
    return stack;
  });
  assert.equal(new Set(stacks).size, fontOptions.length);
});

test('tipografía: editar _config.scss funciona sin tocar la pantalla', async (t) => {
  const directory = await scssWith(t, '$font-heading: system !default;', '$font-heading: slab !default;');
  const { css, settings } = generateLanding(defaultSections, directory);
  assert.equal(settings.fonts.heading, 'slab');
  assert.match(family(css, '.hero__title'), /^Rockwell, /);
});

test('tipografía: agregar una fuente al mapa la suma a la lista', async (t) => {
  const directory = await scssWith(t, '$font-stacks: (\n', "$font-stacks: (\n  verdana: (Verdana, sans-serif),\n");
  const { settings, css } = generateLanding(defaultSections, directory, { settings: { fonts: { body: 'verdana' } } });
  assert.ok(settings.fontOptions.includes('verdana'));
  assert.equal(family(css, '.landing'), 'Verdana, sans-serif');
});

test('tipografía: solo se aceptan nombres de la lista', () => {
  const bad = [
    'serif', [], { heading: 'comic' }, { heading: 'Georgia' }, { body: 5 }, { body: null },
    { titulo: 'serif' }, { body: 'serif); @import "x"; (' }, { heading: '__proto__' },
  ];
  for (const fonts of bad) assert.throws(() => build({ fonts }), TypeError, JSON.stringify(fonts));
});

test('tipografía: la API la recibe y rechaza fuentes desconocidas', async (t) => {
  const server = createAppServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const call = (fonts) => fetch(`http://127.0.0.1:${server.address().port}/api/landing?${new URLSearchParams({
    sections: 'hero', settings: JSON.stringify({ fonts }),
  })}`);
  const good = await call({ heading: 'elegant' });
  assert.equal(good.status, 200);
  assert.match((await good.json()).css, /Palatino Linotype/);
  assert.equal((await call({ heading: 'nada' })).status, 400);
});
