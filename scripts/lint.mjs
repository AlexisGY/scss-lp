import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import sassLint from 'sass-lint';
import { defaultSections, generateLanding } from '../src/generator.mjs';
import { auditBem } from './bem.mjs';

const { css } = generateLanding(defaultSections);
const rules = [];
postcss.parse(css).walkRules((rule) => {
  if (rule.selector.includes('.')) rules.push(rule);
});

// The legacy parser cannot read modern Sass modules. Audit their emitted selectors,
// including names produced by interpolation, without passing declarations to it.
const text = rules.map(({ selector }) => `${selector} {}`).join('\n');
const config = fileURLToPath(new URL('../.sass-lint.yml', import.meta.url));
const result = sassLint.lintText({ text, format: 'scss', filename: 'landing.generada.scss' }, {}, config);
const structural = auditBem(css);
for (const { selector, line, reason } of structural) {
  console.error(`CSS línea ${line} · bem · ${reason}: ${selector}`);
}
if (structural.length > 0) process.exitCode = 1;

if (result.errorCount > 0) {
  for (const message of result.messages) {
    const rule = rules[message.line - 1];
    console.error(`CSS línea ${rule?.source.start.line ?? '?'} · ${message.ruleId} · ${message.message}`);
  }
  process.exitCode = 1;
} else if (structural.length === 0) {
  console.log(`sass-lint: ${rules.length} selectores auditados con la convención BEM estricta.`);
  console.log('estructura BEM: sin IDs, sin clases encadenadas ni selectores descendientes entre clases.');
}
