import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createAppServer } from '../src/server.mjs';

test('la interfaz y API funcionan de extremo a extremo', async (t) => {
  const server = createAppServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const site = `http://127.0.0.1:${server.address().port}`;

  const page = await fetch(site);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /id="composer"/);
  const browserScript = await fetch(`${site}/app.js`);
  assert.equal(browserScript.status, 200);
  assert.match(await browserScript.text(), /\/api\/landing/);
  const response = await fetch(`${site}/api/landing?sections=hero,cta`);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.match(result.html, /Ideas que toman forma/);
  assert.ok(!result.html.includes('id="beneficios"'));
  assert.equal(result.report.duplicateRules, 0);

  const invalid = await fetch(`${site}/api/landing?sections=desconocida`);
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).error, /desconocida/);
  assert.equal((await fetch(`${site}/api/landing?sections=`)).status, 400);
  assert.equal((await fetch(`${site}/inexistente`)).status, 404);
  assert.equal((await fetch(`${site}/api/landing`, { method: 'POST' })).status, 405);
});
