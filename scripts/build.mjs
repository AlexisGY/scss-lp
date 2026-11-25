import { mkdir, writeFile } from 'node:fs/promises';
import { defaultSections, generateLanding } from '../src/generator.mjs';

const result = generateLanding(defaultSections);
if (result.report.duplicateRules !== 0) {
  console.error('Se detectaron reglas duplicadas:', result.report.duplicates);
  process.exitCode = 1;
} else {
  const directory = new URL('../dist/', import.meta.url);
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(new URL('index.html', directory), result.html),
    writeFile(new URL('landing.css', directory), result.compressedCss),
    writeFile(new URL('reporte-css.json', directory), JSON.stringify(result.report, null, 2) + '\n'),
  ]);
  console.log(JSON.stringify(result.report, null, 2));
}
