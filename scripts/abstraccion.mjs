import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { defaultSections, generateLanding } from '../src/generator.mjs';

const modules = ['animations', 'config', 'grid', 'landing', 'sections', 'tools'];
const sources = await Promise.all(modules.map((name) =>
  readFile(new URL(`../scss/_${name}.scss`, import.meta.url), 'utf8')));

function countLines(source) {
  return source.split(/\r?\n/).filter((line) => line.trim() && !line.trimStart().startsWith('//')).length;
}

const measurements = [];
for (const columns of [12, 16]) {
  const { css, html, scss } = generateLanding(defaultSections, undefined, { columns });
  const directory = new URL(`../dist/abstraccion/${columns}/`, import.meta.url);
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(new URL('landing.css', directory), `${css.trimEnd()}\n`),
    writeFile(new URL('index.html', directory),
      html.replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="landing.css">')),
  ]);
  measurements.push({
    Columnas: columns,
    SCSS: countLines(scss) + sources.reduce((total, source) => total + countLines(source), 0),
    CSS: countLines(css),
  });
}

console.table(measurements);
