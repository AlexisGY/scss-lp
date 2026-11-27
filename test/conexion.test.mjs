import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { requestLanding } from '../public/api.js';
import { createAppServer } from '../src/server.mjs';

const MESSAGE = 'No se pudo conectar con el servidor. Vuelve a intentarlo con «Generar página».';

test('conexión: con el servidor caído el mensaje es claro y está en español', async () => {
  const offline = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(requestLanding('/api/landing', offline), { message: MESSAGE });
});

test('conexión: una respuesta cortada o que no es JSON muestra el mismo mensaje', async () => {
  const broken = async () => new Response('<html>Bad Gateway', { status: 502 });
  await assert.rejects(requestLanding('/api/landing', broken), { message: MESSAGE });
});

test('conexión: las respuestas del servidor llegan sin cambios, también los errores de validación', async () => {
  const rejected = async () => new Response('{"error":"Valor fuera de rango."}', { status: 400 });
  const { response, result } = await requestLanding('/api/landing', rejected);
  assert.equal(response.status, 400);
  assert.equal(result.error, 'Valor fuera de rango.');
});

test('conexión: el constructor usa el módulo y el servidor lo entrega', async (t) => {
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(script, /from '\/api\.js'/);
  assert.doesNotMatch(script, /await fetch\(/);
  const server = createAppServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const served = await fetch(`http://127.0.0.1:${server.address().port}/api.js`);
  assert.equal(served.status, 200);
  assert.match(served.headers.get('content-type'), /javascript/);
});
