// Auditoria BEM sobre los selectores que emite Sass. Complementa a sass-lint
// (que solo revisa nombres de clase) con las reglas estructurales de BEM:
// sin IDs, sin clases encadenadas y sin selectores descendientes entre clases.
import postcss from 'postcss';

const PART = '[a-z0-9]+(?:-[a-z0-9]+)*';
// bloque[__elemento][_modificador[_valor]]
const BEM_NAME = new RegExp(`^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:__${PART})?(?:_${PART}(?:_${PART})?)?$`);

// Separa por los caracteres dados ignorando lo que esta entre parentesis.
function splitTopLevel(text, separators) {
  const parts = [''];
  let depth = 0;
  for (const char of text) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (depth === 0 && separators.includes(char)) parts.push('');
    else parts[parts.length - 1] += char;
  }
  return parts.map((part) => part.trim()).filter(Boolean);
}

function problemsOf(selector) {
  const problems = [];
  let compoundsWithClass = 0;
  for (const compound of splitTopLevel(selector, ' >+~')) {
    // Los argumentos de :where(), :not(), etc. se auditan por separado.
    const inner = [];
    const outer = compound.replace(/\((.*)\)/s, (_all, args) => {
      inner.push(args);
      return '';
    });
    if (outer.includes('#')) problems.push('usa un ID');
    const classes = [...outer.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((match) => match[1]);
    if (classes.length > 1) problems.push('encadena clases');
    for (const name of classes) {
      if (!BEM_NAME.test(name)) problems.push(`el nombre "${name}" no es BEM`);
    }
    if (classes.length > 0) compoundsWithClass += 1;
    for (const args of inner) {
      for (const item of splitTopLevel(args, ',')) problems.push(...problemsOf(item));
    }
  }
  if (compoundsWithClass > 1) problems.push('selector descendiente entre clases');
  return problems;
}

export function auditBem(css) {
  const found = [];
  postcss.parse(css).walkRules((rule) => {
    if (rule.parent.type === 'atrule' && rule.parent.name.endsWith('keyframes')) return;
    for (const selector of splitTopLevel(rule.selector, ',')) {
      for (const reason of problemsOf(selector)) {
        found.push({ selector, line: rule.source.start.line, reason });
      }
    }
  });
  return found;
}
