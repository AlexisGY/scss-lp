import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createHistory } from '../public/history.js';
import { createAppServer } from '../src/server.mjs';

// Una foto del estado del constructor.
const state = (changes = {}) => ({ columns: null, style: {}, links: {}, image: null, edits: {}, ...changes });

test('historial: al empezar no hay nada que deshacer ni rehacer', () => {
  const history = createHistory(state());
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, false);
  assert.equal(history.undo(), null);
  assert.equal(history.redo(), null);
});

test('historial: deshacer vuelve atrás paso a paso y rehacer avanza', () => {
  const a = state();
  const b = state({ columns: '16' });
  const c = state({ columns: '16', edits: { brand: 'Acme' } });
  const history = createHistory(a);
  history.record(b);
  history.record(c);
  assert.equal(history.undo(), b);
  assert.equal(history.undo(), a);
  assert.equal(history.canUndo, false);
  assert.equal(history.redo(), b);
  assert.equal(history.redo(), c);
  assert.equal(history.canRedo, false);
});

test('historial: registrar el mismo estado no crea un paso vacío', () => {
  const history = createHistory(state({ style: { gutter: 2 } }));
  assert.equal(history.record(state({ style: { gutter: 2 } })), false);
  assert.equal(history.canUndo, false);
  assert.equal(history.record(state({ style: { gutter: 3 } })), true);
});

test('historial: cambiar la imagen o su descripción cuenta como paso', () => {
  const history = createHistory(state());
  assert.equal(history.record(state({ image: { src: 'data:a', alt: '' } })), true);
  assert.equal(history.record(state({ image: { src: 'data:a', alt: '' } })), false);
  assert.equal(history.record(state({ image: { src: 'data:a', alt: 'Foto' } })), true);
  assert.equal(history.record(state({ image: { src: 'data:b', alt: 'Foto' } })), true);
  assert.equal(history.record(state()), true);
});

test('historial: un cambio nuevo después de deshacer descarta lo que se podía rehacer', () => {
  const history = createHistory(state());
  history.record(state({ columns: '16' }));
  history.undo();
  history.record(state({ columns: '12' }));
  assert.equal(history.canRedo, false);
  assert.equal(history.undo().columns, null);
});

test('historial: guarda como máximo el límite de pasos', () => {
  const history = createHistory(state(), 3);
  for (let gutter = 1; gutter <= 10; gutter += 1) history.record(state({ style: { gutter } }));
  const steps = [];
  while (history.canUndo) steps.push(history.undo().style.gutter);
  assert.deepEqual(steps, [9, 8, 7]);
});

test('historial: descartar quita los pasos que no compilaron, sin dejarlos para rehacer', () => {
  const good = state({ style: { gutter: 2 } });
  const history = createHistory(state());
  history.record(good);
  history.record(state({ style: { gutter: 99 } }));
  history.record(state({ style: { gutter: 99 }, edits: { brand: 'x' } }));
  history.discard((entry) => entry.style.gutter === 99);
  assert.equal(history.present, good);
  assert.equal(history.canRedo, false);
  assert.equal(history.canUndo, true);
});

test('constructor: hay botones de deshacer y rehacer, y el módulo se sirve', async (t) => {
  const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  for (const id of ['undo', 'redo', 'font-heading', 'font-body']) assert.match(index, new RegExp(`id="${id}"`));
  const server = createAppServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/history.js`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /javascript/);
});
