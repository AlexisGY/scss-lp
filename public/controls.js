// Paneles del constructor. Solo dibujan los controles y avisan de los cambios;
// el estado y la compilacion viven en app.js.

const COLOR_LABELS = {
  background: 'Fondo', text: 'Texto principal', muted: 'Texto secundario', nav: 'Menú',
  accent: 'Acento y botones', 'accent-hover': 'Botón al pasar el cursor', 'button-text': 'Texto del botón',
  line: 'Líneas y bordes', card: 'Fondo de tarjetas', cta: 'Fondo del bloque final', 'cta-line': 'Borde del bloque final',
  'orb-light': 'Planeta: luz', 'orb-mid': 'Planeta: medio', 'orb-shade': 'Planeta: sombra', 'orb-dark': 'Planeta: borde',
  'orb-glow': 'Planeta: resplandor', orbit: 'Anillos', 'art-light': 'Ilustración: centro', 'art-mid': 'Ilustración: medio',
  'art-dark': 'Ilustración: fondo',
};
const GLOW_LABELS = { peach: 'Brillo del bloque final 1', violet: 'Brillo del bloque final 2' };
const CARD_LABELS = {
  layout: 'Tarjeta Layout', speed: 'Tarjeta Composición', scale: 'Tarjeta Tipografía',
  extra1: 'Tarjeta extra 1', extra2: 'Tarjeta extra 2', extra3: 'Tarjeta extra 3',
};
const CARD_COLORS = ['#ffc6a8', '#d0bfff', '#b6e6d4', '#ffe08a', '#9ad8ff', '#ffb3c7'];
const ANIMATION_LABELS = {
  none: 'Sin animación', appear: 'Aparecer', rise: 'Subir', 'slide-left': 'Deslizar a la izquierda',
  'slide-right': 'Deslizar a la derecha', 'zoom-in': 'Acercar',
};
const LINK_LABELS = {
  brand: 'Marca', 'nav.benefits': 'Menú: Beneficios', 'nav.cta': 'Menú: Contacto',
  'hero.button.contact': 'Botón principal', 'hero.button.benefits': 'Botón principal', 'cta.link': 'Botón final',
};
const MAX_CARDS = 6;

export const cardLabel = (id) => CARD_LABELS[id] ?? `Tarjeta ${id}`;

// <input type="color"> solo entiende #rrggbb; la transparencia la conserva el servidor.
const opaque = (color) => color.slice(0, 7);

function element(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === true) node.setAttribute(name, '');
    else if (value !== false && value !== undefined) node.setAttribute(name, value);
  }
  node.append(...children);
  return node;
}

// No pisa el control que la persona esta usando.
function setValue(input, value) {
  if (input !== document.activeElement) input.value = String(value);
}

function animationSelect(animations, attributes) {
  return element('select', attributes, ...['none', ...animations]
    .map((name) => element('option', { value: name }, ANIMATION_LABELS[name] ?? name)));
}

// ---------------------------------------------------------------- colores

export function syncColors(panel, settings) {
  const entries = [
    ...Object.entries(settings.colors).map(([name, color]) => ['colors', name, color, COLOR_LABELS[name] ?? name]),
    ...Object.entries(settings.glows).map(([name, color]) => ['glows', name, color, GLOW_LABELS[name] ?? `Brillo ${name}`]),
  ];
  if (panel.children.length !== entries.length) {
    panel.replaceChildren(...entries.map(([group, name, , label]) => element('label', { class: 'swatch' },
      element('input', { type: 'color', 'data-color-group': group, 'data-color': name }),
      element('span', {}, label))));
  }
  const inputs = panel.querySelectorAll('input');
  entries.forEach(([, , color], index) => setValue(inputs[index], opaque(color)));
}

// ---------------------------------------------------------------- tarjetas

// change(mutador) recibe la lista efectiva de tarjetas y la animacion de cada una.
export function syncCards(panel, addButton, settings, change) {
  const ids = settings.cards.map((card) => card.id);
  if (panel.dataset.ids !== ids.join(',')) {
    panel.dataset.ids = ids.join(',');
    panel.replaceChildren(...ids.map((id, index) => {
      const action = (label, symbol, disabled, mutate) => {
        const button = element('button', { type: 'button', class: 'move', 'aria-label': `${label} ${cardLabel(id)}`, title: label, disabled }, symbol);
        button.addEventListener('click', () => change(mutate));
        return button;
      };
      const color = element('input', { type: 'color', 'aria-label': `Color de ${cardLabel(id)}`, 'data-card-color': id });
      color.addEventListener('change', () => change((cards) => {
        const card = cards.find((candidate) => candidate.id === id);
        if (card) card.color = color.value;
      }));
      const motion = animationSelect(settings.animations, { 'aria-label': `Animación de ${cardLabel(id)}`, 'data-card-motion': id });
      motion.addEventListener('change', () => change((_cards, chosen) => { chosen[id] = motion.value; }));
      // Se busca por id: la lista pudo cambiar mientras se recompilaba.
      const at = (cards) => cards.findIndex((card) => card.id === id);
      const swap = (offset) => (cards) => {
        const from = at(cards);
        const to = from + offset;
        if (from >= 0 && to >= 0 && to < cards.length) [cards[from], cards[to]] = [cards[to], cards[from]];
      };
      const remove = (cards) => { if (at(cards) >= 0 && cards.length > 1) cards.splice(at(cards), 1); };
      return element('div', { class: 'card-row' },
        element('div', { class: 'card-row__head' }, color, element('strong', {}, cardLabel(id)),
          action('Subir', '↑', index === 0, swap(-1)),
          action('Bajar', '↓', index === ids.length - 1, swap(1)),
          action('Quitar', '✕', ids.length === 1, remove)),
        motion);
    }));
  }
  for (const card of settings.cards) {
    setValue(panel.querySelector(`[data-card-color="${card.id}"]`), opaque(card.color));
    setValue(panel.querySelector(`[data-card-motion="${card.id}"]`), settings.motion.cards[card.id]);
  }
  addButton.disabled = ids.length >= MAX_CARDS || settings.availableCards.every((id) => ids.includes(id));
}

export function nextCard(settings, cards) {
  const id = settings.availableCards.find((candidate) => !cards.some((card) => card.id === candidate));
  const position = settings.availableCards.indexOf(id);
  return { id, color: CARD_COLORS[position % CARD_COLORS.length] };
}

// ---------------------------------------------------------------- grid, letra y animaciones

// Los inputs fijos declaran su ruta: data-setting="type.hero.min".
const read = (source, path) => path.split('.').reduce((value, key) => value?.[key], source);

export function syncFields(form, settings) {
  for (const input of form.querySelectorAll('[data-setting]')) {
    const value = read(settings, input.dataset.setting);
    if (value !== undefined) setValue(input, value);
    const output = form.querySelector(`output[for="${input.id}"]`);
    if (output) output.textContent = `${input.value} rem`;
  }
  for (const select of form.querySelectorAll('select[data-motion]')) {
    if (select.options.length === 0) {
      select.replaceWith(animationSelect(settings.animations, { id: select.id, 'data-motion': select.dataset.motion }));
    }
  }
  for (const select of form.querySelectorAll('select[data-motion]')) setValue(select, settings.motion[select.dataset.motion]);
}

// ---------------------------------------------------------------- enlaces

export function syncLinks(panel, originalLinks, content, change) {
  const keys = Object.keys(originalLinks);
  if (panel.dataset.keys !== keys.join(',')) {
    panel.dataset.keys = keys.join(',');
    panel.replaceChildren(...keys.map((key) => {
      const label = LINK_LABELS[key] ?? key;
      const href = element('input', {
        type: 'text', 'data-link-href': key, 'aria-label': `Destino de ${label}`, spellcheck: 'false', autocomplete: 'off',
      });
      href.addEventListener('change', () => change(key, { href: href.value.trim() }, href));
      const visible = element('input', { type: 'checkbox', 'data-link-visible': key, 'aria-label': `Mostrar ${label}` });
      visible.addEventListener('change', () => change(key, { hidden: !visible.checked }));
      return element('div', { class: 'link-row' },
        element('label', { class: 'link-row__head' }, visible, element('span', {}, label)),
        href);
    }));
  }
  for (const key of keys) {
    const href = panel.querySelector(`[data-link-href="${key}"]`);
    href.placeholder = originalLinks[key];
    setValue(href, content.links[key]?.href ?? originalLinks[key]);
    panel.querySelector(`[data-link-visible="${key}"]`).checked = !content.links[key]?.hidden;
  }
}
