import { fileURLToPath } from 'node:url';
import { compileString } from 'sass';
import postcss from 'postcss';

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

const sections = {
  hero: ({ benefits, cta }, index, [contentColumns, artColumns]) => {
    const heading = index === 0 ? 'h1' : 'h2';
    return `
    <section class="hero grid" aria-labelledby="hero-title">
      <div class="hero__content ${contentColumns} motion motion_rise">
        <p class="landing__eyebrow" data-edit="hero.eyebrow">Proyecto de ejemplo</p>
        <${heading} class="hero__title" id="hero-title" data-edit="hero.title">Ideas que toman forma.</${heading}>
        <p class="landing__copy" data-edit="hero.copy">Una página flexible para presentar lo que haces y dar el siguiente paso.</p>
        ${cta ? '<a class="landing__button" href="#contacto" data-edit="hero.button.contact">Empezar</a>' :
          benefits ? '<a class="landing__button" href="#beneficios" data-edit="hero.button.benefits">Ver beneficios</a>' : ''}
      </div>
      <figure class="hero__art ${artColumns} motion motion_appear" aria-hidden="true">
        <span class="hero__orb"></span>
        <span class="hero__ring"></span>
        <span class="hero__ring"></span>
        <span class="hero__ring"></span>
      </figure>
    </section>`;
  },
  benefits: (_included, index, [layoutColumns, speedColumns, scaleColumns]) => {
    const heading = index === 0 ? 'h1' : 'h2';
    const cardHeading = index === 0 ? 'h2' : 'h3';
    return `
    <section class="benefits" id="beneficios" aria-labelledby="benefits-title">
      <p class="landing__eyebrow" data-edit="benefits.eyebrow">Beneficios</p>
      <${heading} class="benefits__title" id="benefits-title" data-edit="benefits.title">Un diseño que se adapta.</${heading}>
      <div class="grid">
        <article class="benefits__card benefits__card_layout ${layoutColumns} motion motion_slide-right">
          <${cardHeading} class="benefits__heading" data-edit="benefits.layout.title">Layout flexible</${cardHeading}>
          <p class="landing__copy" data-edit="benefits.layout.text">Cada sección se ajusta al espacio disponible.</p>
        </article>
        <article class="benefits__card benefits__card_speed ${speedColumns} motion motion_rise">
          <${cardHeading} class="benefits__heading" data-edit="benefits.speed.title">Composición rápida</${cardHeading}>
          <p class="landing__copy" data-edit="benefits.speed.text">Combina secciones a partir de una estructura común.</p>
        </article>
        <article class="benefits__card benefits__card_scale ${scaleColumns} motion motion_slide-left">
          <${cardHeading} class="benefits__heading" data-edit="benefits.scale.title">Tipografía fluida</${cardHeading}>
          <p class="landing__copy" data-edit="benefits.scale.text">Los títulos ajustan su tamaño con el ancho de pantalla.</p>
        </article>
      </div>
    </section>`;
  },
  cta: (_included, index) => {
    const heading = index === 0 ? 'h1' : 'h2';
    return `
    <section class="cta" id="contacto" aria-labelledby="cta-title">
      <${heading} class="cta__title" id="cta-title" data-edit="cta.title">¿Listo para comenzar?</${heading}>
      <p class="landing__copy" data-edit="cta.copy">Esta landing es una muestra del constructor SCSS-LP.</p>
      <a class="landing__button cta__link motion motion_zoom-in" href="#inicio" data-edit="cta.link">Volver al inicio</a>
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

function renderLanding(selection, stylesheet, css) {
  const included = Object.fromEntries(selection.map((section) => [section, true]));
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

export function generateLanding(selection, loadPath = scssDirectory, { columns } = {}) {
  validateSelection(selection);
  validateColumns(columns);
  const list = selection.map((section) => JSON.stringify(section)).join(', ');
  // Con una eleccion, se configura la misma $grid-columns antes de cargar la landing.
  const config = columns === undefined ? '' : `@use "config" with ($grid-columns: ${columns});\n`;
  const entry = `${config}@use "landing" with ($section-order: (${list},));`;
  const options = { loadPaths: [loadPath] };
  const { css } = compileString(entry, options);
  const { css: compressedCss } = compileString(entry, { ...options, style: 'compressed' });
  const report = inspectCss(css, compressedCss);

  return { css, compressedCss, html: renderLanding(selection, compressedCss, css), report };
}
