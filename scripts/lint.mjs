import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import sassLint from 'sass-lint';
import { defaultSections, generateLanding } from '../src/generator.mjs';

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
if (result.errorCount > 0) {
  for (const message of result.messages) {
    const rule = rules[message.line - 1];
    console.error(`CSS línea ${rule?.source.start.line ?? '?'} · ${message.ruleId} · ${message.message}`);
  }
  process.exitCode = 1;
} else {
  console.log(`sass-lint: ${rules.length} selectores auditados con la convención BEM estricta.`);
}
