import { fileURLToPath } from 'node:url';
import { compileString } from 'sass';
import postcss from 'postcss';
import { readSettings, toScssVariables, validateSettings } from './settings.mjs';

const scssDirectory = fileURLToPath(new URL('../scss/', import.meta.url));

// Lee el reparto de columnas que Sass calculo para una seccion (--layout-tablet)
// y lo convierte en las utilidades .col-tablet-N que genera el propio grid.
function tabletColumns(css, selector) {
  let spans = [];
  postcss.parse(css).walkRules((rule) => {
    if (rule.selector !== selector || rule.parent.type !== 'root') return;
    rule.walkDecls('--layout-tablet', ({ value }) => { spans = value.split(/\s+/); });
  });
  return spans.map((span) => `col-tablet-${span}`);
}

// Una variante sin contenido propio usa el texto genérico.
const cardTexts = {
  layout: ['Layout flexible', 'Cada sección se ajusta al espacio disponible.'],
  speed: ['Composición rápida', 'Combina secciones a partir de una estructura común.'],
  scale: ['Tipografía fluida', 'Los títulos ajustan su tamaño con el ancho de pantalla.'],
};
const genericCard = ['Nueva ventaja', 'Describe aquí lo que hace especial a tu propuesta.'];

const motionClasses = (animation) => (animation === 'none' ? '' : ` motion motion_${animation}`);

function resolveMotion(defaults, chosen = {}) {
  return {
    ...defaults,
    ...chosen,
    cards: Object.fromEntries(Object.entries(defaults.cards)
      .map(([id, animation]) => [id, chosen.cards?.[id] ?? animation])),
  };
}

const sections = {
  hero: ({ benefits, cta, heroRings, motion }, index, [contentColumns, artColumns]) => {
    const heading = index === 0 ? 'h1' : 'h2';
    const rings = '\n        <span class="hero__ring"></span>'.repeat(heroRings);
    return `
    <section class="hero grid" aria-labelledby="hero-title">
      <div class="hero__content ${contentColumns}${motionClasses(motion.heroContent)}">
        <p class="landing__eyebrow" data-edit="hero.eyebrow">Proyecto de ejemplo</p>
        <${heading} class="hero__title" id="hero-title" data-edit="hero.title">Ideas que toman forma.</${heading}>
        <p class="landing__copy" data-edit="hero.copy">Una página flexible para presentar lo que haces y dar el siguiente paso.</p>
        ${cta ? '<a class="landing__button" href="#contacto" data-edit="hero.button.contact">Empezar</a>' :
          benefits ? '<a class="landing__button" href="#beneficios" data-edit="hero.button.benefits">Ver beneficios</a>' : ''}
      </div>
      <figure class="hero__art ${artColumns}${motionClasses(motion.heroArt)}" aria-hidden="true">
        <span class="hero__orb"></span>${rings}
      </figure>
    </section>`;
  },
  benefits: ({ cards, motion }, index, columns) => {
    const heading = index === 0 ? 'h1' : 'h2';
    const cardHeading = index === 0 ? 'h2' : 'h3';
    const articles = cards.map(({ id }, position) => {
      const [title, text] = cardTexts[id] ?? genericCard;
      return `
        <article class="benefits__card benefits__card_${id} ${columns[position]}${motionClasses(motion.cards[id])}">
          <${cardHeading} class="benefits__heading" data-edit="benefits.${id}.title">${title}</${cardHeading}>
          <p class="landing__copy" data-edit="benefits.${id}.text">${text}</p>
        </article>`;
    }).join('');
    return `
    <section class="benefits" id="beneficios" aria-labelledby="benefits-title">
      <p class="landing__eyebrow" data-edit="benefits.eyebrow">Beneficios</p>
      <${heading} class="benefits__title" id="benefits-title" data-edit="benefits.title">Un diseño que se adapta.</${heading}>
      <div class="grid">${articles}
      </div>
    </section>`;
  },
  cta: ({ motion }, index) => {
    const heading = index === 0 ? 'h1' : 'h2';
    return `
    <section class="cta" id="contacto" aria-labelledby="cta-title">
      <${heading} class="cta__title" id="cta-title" data-edit="cta.title">¿Listo para comenzar?</${heading}>
      <p class="landing__copy" data-edit="cta.copy">Esta landing es una muestra del constructor SCSS-LP.</p>
      <a class="landing__button cta__link${motionClasses(motion.ctaLink)}" href="#inicio" data-edit="cta.link">Volver al inicio</a>
    </section>`;
  },
};

export const defaultSections = Object.freeze(Object.keys(sections));

// Valores que ofrece el selector del constructor.
export const columnOptions = Object.freeze([12, 16]);

export function validateColumns(columns) {
  if (columns !== undefined && !columnOptions.includes(columns)) {
    throw new TypeError(`El número de columnas debe ser ${columnOptions.join(' o ')}.`);
  }
}

export function validateSelection(selection) {
  if (!Array.isArray(selection) || selection.length === 0 || selection.length > defaultSections.length) {
    throw new TypeError('Elige entre una y tres secciones.');
  }
  if (selection.some((name) => typeof name !== 'string' || !Object.hasOwn(sections, name))) {
    throw new TypeError('La selección incluye una sección desconocida.');
  }
  if (new Set(selection).size !== selection.length) {
    throw new TypeError('Cada sección se puede agregar una sola vez.');
  }
}

export function inspectCss(css, compressedCss = css) {
  const root = postcss.parse(css);
  const fingerprints = new Set();
  const duplicates = [];
  let gridColumns;
  root.walkRules((rule) => {
    const scope = [];
    for (let parent = rule.parent; parent.type !== 'root'; parent = parent.parent) {
      scope.unshift(parent.type === 'atrule' ? [parent.name, parent.params] : [parent.selector]);
    }
    const declarations = rule.nodes
      .filter((node) => node.type === 'decl')
      .map(({ prop, value, important }) => [prop, value, Boolean(important)]);
    const fingerprint = JSON.stringify([scope, rule.selector, declarations]);
    if (fingerprints.has(fingerprint)) {
      duplicates.push({ selector: rule.selector, line: rule.source.start.line });
    }
    fingerprints.add(fingerprint);

    if (rule.selector === '.grid' && scope.length === 0) {
      const columns = declarations.find(([prop]) => prop === '--grid-columns');
      gridColumns = Number(columns?.[1]);
    }
  });

  return {
    bytes: Buffer.byteLength(compressedCss),
    expandedBytes: Buffer.byteLength(css),
    duplicateRules: duplicates.length,
    duplicates,
    gridColumns,
  };
}

function renderLanding(selection, stylesheet, css, { cards, heroRings, motion }) {
  const included = { ...Object.fromEntries(selection.map((section) => [section, true])), cards, heroRings, motion };
  const body = selection
    .map((section, index) => sections[section](included, index, tabletColumns(css, `.${section}`)))
    .join('');
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Órbita · Landing de ejemplo</title>
  <style>${stylesheet}</style>
</head>
<body class="landing" id="inicio">
  <div class="landing__inner">
    <header class="landing__header">
      <a class="landing__brand" href="#inicio" data-edit="brand">Órbita</a>
      <nav class="landing__nav" aria-label="Navegación">
        ${included.benefits ? '<a class="landing__nav-link" href="#beneficios" data-edit="nav.benefits">Beneficios</a>' : ''}
        ${included.cta ? '<a class="landing__nav-link" href="#contacto" data-edit="nav.cta">Contacto</a>' : ''}
      </nav>
    </header>
    <main aria-label="Landing de ejemplo">${body}
    </main>
    <footer class="landing__footer" data-edit="footer.text">Órbita · Demo de SCSS-LP</footer>
  </div>
</body>
</html>
`;
}

export function generateLanding(selection, loadPath = scssDirectory, { columns, settings } = {}) {
  validateSelection(selection);
  validateColumns(columns);
  // Lo que dice _config.scss, sin cambios de pantalla.
  const defaults = readSettings(loadPath);
  const clean = validateSettings(settings === undefined ? {} : settings, defaults);
  const variables = toScssVariables(clean, defaults);
  // El selector de columnas configura la misma $grid-columns.
  if (columns !== undefined) variables.unshift(`$grid-columns: ${columns}`);

  const header = variables.length > 0 ? `@use "config" with (${variables.join(', ')});` : '@use "config";';
  const list = selection.map((section) => JSON.stringify(section)).join(', ');
  const use = `@use "landing" with ($section-order: (${list},));`;
  const entry = variables.length > 0 ? `${header}
${use}` : use;
  const options = { loadPaths: [loadPath] };
  const { css } = compileString(entry, options);
  const { css: compressedCss } = compileString(entry, { ...options, style: 'compressed' });
  const report = inspectCss(css, compressedCss);

  const { glowShapes, ...effective } = readSettings(loadPath, header);
  effective.motion = resolveMotion(effective.motion, clean.motion);
  effective.cardColors = defaults.cardColors;
  effective.availableCards = Object.keys(defaults.cardColors);
  const html = renderLanding(selection, compressedCss, css, effective);

  return { css, compressedCss, html, report, settings: effective, scss: entry };
}
