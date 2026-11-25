import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { columnOptions, defaultSections, generateLanding } from './generator.mjs';

const staticFiles = new Map([
  ['/', ['index.html', 'text/html']],
  ['/app.css', ['app.css', 'text/css']],
  ['/app.js', ['app.js', 'text/javascript']],
  ['/texts.js', ['texts.js', 'text/javascript']],
]);

function reply(response, status, type, body) {
  response.writeHead(status, {
    'Content-Type': `${type}; charset=utf-8`,
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

function json(response, status, body) {
  reply(response, status, 'application/json', JSON.stringify(body));
}

export function createAppServer() {
  return createServer(async (request, response) => {
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      json(response, 405, { error: 'Método no permitido.' });
      return;
    }

    // Fuera de este try, una ruta como "//[" lanzaba y tumbaba el proceso.
    let url;
    try {
      url = new URL(request.url, 'http://localhost');
    } catch {
      json(response, 400, { error: 'URL no válida.' });
      return;
    }

    try {
      if (url.pathname === '/api/landing') {
        const requested = url.searchParams.get('sections');
        const selection = requested === null ? defaultSections : requested ? requested.split(',') : [];
        // Solo se aceptan los valores exactos de la lista; el texto no llega a Sass.
        const asked = url.searchParams.get('columns');
        const columns = columnOptions.find((option) => String(option) === asked);
        if (asked !== null && columns === undefined) {
          throw new TypeError(`El número de columnas debe ser ${columnOptions.join(' o ')}.`);
        }
        response.setHeader('Cache-Control', 'no-store');
        json(response, 200, generateLanding(selection, undefined, { columns }));
        return;
      }

      const file = staticFiles.get(url.pathname);
      if (!file) {
        json(response, 404, { error: 'Ruta no encontrada.' });
        return;
      }
      const [filename, type] = file;
      const body = await readFile(new URL(`../public/${filename}`, import.meta.url));
      reply(response, 200, type, body);
    } catch (error) {
      if (error instanceof TypeError) {
        json(response, 400, { error: error.message });
        return;
      }
      console.error(error);
      json(response, 500, { error: 'Ocurrió un error al generar la landing. Revisa la configuración SCSS.' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '127.0.0.1';
  createAppServer().listen(port, host, () => {
    console.log(`SCSS-LP · http://${host}:${port}`);
  });
}
