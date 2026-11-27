// Configuracion editable desde el constructor. Todo termina siendo SCSS:
// readSettings() lee los valores efectivos compilando el propio DSL,
// validateSettings() solo deja pasar valores de una lista o un rango, y
// toScssVariables() los serializa para @use "config" with (...).
// Ningun texto del usuario llega sin validar al codigo SCSS.
import { compileString } from 'sass';
import postcss from 'postcss';

export const limits = Object.freeze({
  gutter: [0, 3],
  tablet: [480, 900],
  desktop: [901, 1600],
  titleSize: [12, 160],
  duration: [0, 3000],
  cards: [1, 6],
});

const COLOR = /^#[0-9a-f]{6}$/i;

// ---------------------------------------------------------------- lectura

// Sass puede reescribir #rrggbbaa como rgba(); el editor trabaja siempre en hex.
function toHex(value) {
  const match = value.match(/^rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\s*\)$/);
  if (!match) return value;
  const [, r, g, b, alpha] = match;
  const channels = [r, g, b, ...(alpha === undefined ? [] : [Number(alpha) * 255])];
  return `#${channels.map((c) => Math.round(Number(c)).toString(16).padStart(2, '0')).join('')}`;
}

// header: la linea @use "config" (con o sin "with") que se usara para compilar.
export function readSettings(loadPath, header = '@use "config";') {
  const probe = `@use "sass:map";
${header}
.probe {
  --columns: #{config.$grid-columns};
  --gutter: #{config.$gutter};
  --duration: #{config.$motion-duration};
  --font-heading: #{config.$font-heading};
  --font-body: #{config.$font-body};
  @each $name, $stack in config.$font-stacks { --stack-#{$name}: 1; }
  @each $name, $value in config.$breakpoints { --breakpoint-#{$name}: #{$value}; }
  @each $name, $scale in config.$type-scale { --type-#{$name}: #{map.get($scale, min)} #{map.get($scale, max)}; }
  @each $name, $value in config.$palette { --color-#{$name}: #{$value}; }
  @each $name, $value in config.$card-colors { --catalog-#{$name}: #{$value}; }
  @each $name, $value in config.$default-motion { --motion-#{$name}: #{$value}; }
  @each $name, $value in config.$benefit-variants {
    $animation: config.$benefit-motion-fallback;
    @if map.has-key(config.$benefit-motion, $name) {
      $animation: map.get(config.$benefit-motion, $name);
    }
    --card-#{$name}: #{$value}|#{$animation};
  }
  @each $name, $glow in config.$cta-glows {
    --glow-#{"" + $name}: #{map.get($glow, x)}|#{map.get($glow, y)}|#{map.get($glow, size)}|#{map.get($glow, color)};
  }
  @each $name, $frames in config.$animations { --animation-#{$name}: 1; }
}`;
  const { css } = compileString(probe, { loadPaths: [loadPath] });
  const settings = {
    colors: {}, cards: [], glows: {}, glowShapes: {}, breakpoints: {}, type: {}, animations: [],
    fonts: {}, fontOptions: [], cardColors: {}, motion: { cards: {} },
  };
  postcss.parse(css).walkDecls((decl) => {
    const [, group, name] = decl.prop.match(/^--(color|card|catalog|motion|glow|breakpoint|type|animation|font|stack)-(.+)$/) ?? [];
    const value = decl.value.trim();
    if (decl.prop === '--columns') settings.columns = Number(value);
    else if (decl.prop === '--gutter') settings.gutter = parseFloat(value) / (value.endsWith('px') ? 16 : 1);
    else if (decl.prop === '--duration') settings.duration = parseFloat(value) * (value.endsWith('ms') ? 1 : 1000);
    else if (group === 'color') settings.colors[name] = toHex(value);
    else if (group === 'catalog') settings.cardColors[name] = toHex(value);
    else if (group === 'motion') settings.motion[name] = value;
    else if (group === 'breakpoint') settings.breakpoints[name] = parseFloat(value);
    else if (group === 'animation') settings.animations.push(name);
    else if (group === 'font') settings.fonts[name] = value;
    else if (group === 'stack') settings.fontOptions.push(name);
    else if (group === 'card') {
      const [color, animation] = value.split('|');
      settings.cards.push({ id: name, color: toHex(color) });
      settings.motion.cards[name] = animation;
    } else if (group === 'type') {
      const [min, max] = value.split(' ').map(parseFloat);
      settings.type[name] = { min, max };
    } else if (group === 'glow') {
      const [x, y, size, color] = value.split('|');
      settings.glows[name] = toHex(color);
      settings.glowShapes[name] = { x, y, size };
    }
  });
  settings.cardColors = {
    ...settings.cardColors,
    ...Object.fromEntries(settings.cards.map(({ id, color }) => [id, color])),
  };
  return settings;
}

// ---------------------------------------------------------------- validacion

function fail(message) {
  throw new TypeError(message);
}

function plainObject(value, label, allowed) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(`${label} debe ser un objeto.`);
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(`${label}: "${key}" no se puede configurar.`);
  }
  return value;
}

function number(value, label, [min, max], { integer = true } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    fail(`${label} debe ser un número${integer ? ' entero' : ''} entre ${min} y ${max}.`);
  }
  return value;
}

function color(value, label) {
  if (typeof value !== 'string' || !COLOR.test(value)) fail(`${label} debe ser un color como #1a2b3c.`);
  return value.toLowerCase();
}

// Conserva la transparencia que tenia el color original (#rrggbbaa).
const withAlpha = (chosen, original) => (/^#[0-9a-f]{8}$/i.test(original) ? `${chosen}${original.slice(7)}` : chosen);

export function validateSettings(input, defaults) {
  const settings = plainObject(input, 'La configuración',
    ['colors', 'glows', 'gutter', 'breakpoints', 'type', 'duration', 'cards', 'motion', 'fonts']);
  const clean = {};

  for (const group of ['colors', 'glows']) {
    if (settings[group] === undefined) continue;
    const values = plainObject(settings[group], group, Object.keys(defaults[group]));
    clean[group] = Object.fromEntries(Object.entries(values)
      .map(([name, value]) => [name, withAlpha(color(value, `El color ${name}`), defaults[group][name])]));
  }
  if (settings.fonts !== undefined) {
    const fonts = plainObject(settings.fonts, 'fonts', ['heading', 'body']);
    for (const value of Object.values(fonts)) {
      if (!defaults.fontOptions.includes(value)) fail('Hay una tipografía desconocida.');
    }
    clean.fonts = { ...fonts };
  }
  if (settings.gutter !== undefined) clean.gutter = number(settings.gutter, 'El espacio entre columnas', limits.gutter, { integer: false });
  if (settings.duration !== undefined) clean.duration = number(settings.duration, 'La duración', limits.duration);

  if (settings.breakpoints !== undefined) {
    const values = plainObject(settings.breakpoints, 'breakpoints', ['tablet', 'desktop']);
    for (const [name, value] of Object.entries(values)) number(value, `El breakpoint ${name}`, limits[name]);
    const merged = { ...defaults.breakpoints, ...values };
    const widths = Object.values(merged);
    if (widths.some((width, i) => i > 0 && width <= widths[i - 1])) fail('Los breakpoints deben ir en orden ascendente.');
    clean.breakpoints = merged;
  }

  if (settings.type !== undefined) {
    const values = plainObject(settings.type, 'type', Object.keys(defaults.type));
    clean.type = Object.fromEntries(Object.entries(defaults.type).map(([name, original]) => {
      const sizes = plainObject(values[name] ?? {}, `El título ${name}`, ['min', 'max']);
      const merged = { ...original, ...sizes };
      for (const size of Object.values(sizes)) number(size, `El tamaño de ${name}`, limits.titleSize);
      if (merged.max < merged.min) fail(`En ${name}, el tamaño máximo no puede ser menor que el mínimo.`);
      return [name, merged];
    }));
  }

  const knownCards = Object.keys(defaults.cardColors);
  if (settings.cards !== undefined) {
    if (!Array.isArray(settings.cards)) fail('cards debe ser una lista.');
    number(settings.cards.length, 'La cantidad de tarjetas', limits.cards);
    clean.cards = settings.cards.map((card) => {
      plainObject(card, 'Cada tarjeta', ['id', 'color']);
      if (!knownCards.includes(card.id)) fail('Hay una tarjeta desconocida.');
      return { id: card.id, color: color(card.color, `El color de la tarjeta ${card.id}`) };
    });
    if (new Set(clean.cards.map((card) => card.id)).size !== clean.cards.length) fail('Hay tarjetas repetidas.');
  }

  if (settings.motion !== undefined) {
    const motion = plainObject(settings.motion, 'motion', ['heroContent', 'heroArt', 'ctaLink', 'cards']);
    const name = (value) => {
      if (value !== 'none' && !defaults.animations.includes(value)) fail('Hay una animación desconocida.');
      return value;
    };
    clean.motion = Object.fromEntries(Object.entries(motion).map(([key, value]) => [key, key === 'cards'
      ? Object.fromEntries(Object.entries(plainObject(value, 'motion.cards', knownCards)).map(([id, v]) => [id, name(v)]))
      : name(value)]));
  }
  return clean;
}

// ---------------------------------------------------------------- serializacion

const sassMap = (entries) => `(${entries.map(([key, value]) => `${key}: ${value}`).join(', ')})`;

// Recibe valores ya validados. Un mapa se escribe completo (with lo reemplaza
// entero), partiendo de los valores del archivo.
export function toScssVariables(clean, defaults) {
  const variables = [];
  for (const [place, name] of Object.entries(clean.fonts ?? {})) variables.push(`$font-${place}: ${name}`);
  if (clean.gutter !== undefined) variables.push(`$gutter: ${clean.gutter}rem`);
  if (clean.duration !== undefined) variables.push(`$motion-duration: ${clean.duration}ms`);
  if (clean.breakpoints) variables.push(`$breakpoints: ${sassMap(Object.entries(clean.breakpoints).map(([k, v]) => [k, `${v}px`]))}`);
  if (clean.type) variables.push(`$type-scale: ${sassMap(Object.entries(clean.type).map(([k, v]) => [k, `(min: ${v.min}px, max: ${v.max}px)`]))}`);
  if (clean.colors) variables.push(`$palette: ${sassMap(Object.entries({ ...defaults.colors, ...clean.colors }))}`);
  if (clean.cards) variables.push(`$benefit-variants: ${sassMap(clean.cards.map((card) => [card.id, card.color]))}`);
  if (clean.glows) {
    const glows = Object.entries({ ...defaults.glows, ...clean.glows }).map(([name, value]) => {
      const { x, y, size } = defaults.glowShapes[name];
      return [`'${name}'`, `(x: ${x}, y: ${y}, size: ${size}, color: ${value})`];
    });
    variables.push(`$cta-glows: ${sassMap(glows)}`);
  }
  return variables;
}
