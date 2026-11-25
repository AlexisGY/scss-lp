import { applyContent, exportHtml, imageProblem, isSafeHref, readLinks } from '/content.js';
import { nextCard, syncCards, syncColors, syncFields, syncLinks } from '/controls.js';
import { applyTexts, collectTexts, readTexts } from '/texts.js';

const $ = (selector) => document.querySelector(selector);
const form = $('#composer');
const sectionList = $('#section-list');
const generateButton = $('#generate');
const resetAllButton = $('#reset-all');
const downloadButton = $('#download');
const status = $('#status');
const tabs = { preview: $('#show-preview'), css: $('#show-code'), scss: $('#show-scss') };
const preview = $('#preview');
const code = $('#code');
const stylesheet = $('#stylesheet');
const frame = $('#frame');
const stage = $('.preview__stage');
const desktop = $('#desktop');
const mobile = $('#mobile');
const editButton = $('#edit-text');
const resetButton = $('#reset-text');
const colorsPanel = $('#colors-panel');
const cardsPanel = $('#cards-panel');
const addCardButton = $('#add-card');
const linksPanel = $('#links-panel');
const imageInput = $('#image-file');
const imageAlt = $('#image-alt');
const removeImageButton = $('#image-remove');
const columnInputs = [...form.querySelectorAll('input[name="columns"]')];
const columns = $('#columns');
const size = $('#css-size');
const duplicates = $('#duplicates');
const number = new Intl.NumberFormat('es-PE');
const initialSections = [...sectionList.children];

let lastResult;
let compiledSelection;
let busy = false;
let pending = false;
let view = 'preview';
// Estilo: lo que se envia a Sass. Solo contiene lo que se cambio en pantalla.
let chosenColumns = null;
let style = {};
let compiledStyle = {};
// Contenido: vive en el navegador y viaja en la descarga.
let defaults = {};
let edits = {};
let originalLinks = {};
let content = { links: {}, image: null };
let editing = false;
// Documento de la vista previa ya cargado (null mientras se reemplaza).
let page = null;

function selectedSections() {
  return new FormData(form).getAll('section').join(',');
}

function currentSelection() {
  return JSON.stringify([selectedSections(), chosenColumns, style]);
}

function hasChanges() {
  return Object.keys(edits).length > 0;
}

function updateControls() {
  generateButton.disabled = busy || !selectedSections();
  downloadButton.disabled = busy || !lastResult || currentSelection() !== compiledSelection;
  editButton.disabled = !lastResult;
  resetButton.disabled = !editing && !hasChanges();
  removeImageButton.disabled = !content.image;
  for (const [index, row] of [...sectionList.children].entries()) {
    row.querySelector('[data-move="up"]').disabled = index === 0;
    row.querySelector('[data-move="down"]').disabled = index === sectionList.children.length - 1;
  }
}

// ---------------------------------------------------------------- vista previa

// Lee lo que se escribió en la vista previa antes de usarlo o reemplazarla.
function saveEdits() {
  if (!page) return;
  edits = collectTexts(page, defaults, edits);
  applyTexts(page, { ...defaults, ...edits });
}

function showContent() {
  if (page) applyContent(page, content, originalLinks);
}

// La vista previa no ejecuta scripts: el constructor activa la edición desde fuera.
function setEditable(active) {
  if (!page) return;
  for (const element of page.querySelectorAll('[data-edit]')) {
    if (!active) {
      element.removeAttribute('contenteditable');
      continue;
    }
    try {
      element.contentEditable = 'plaintext-only';
    } catch {
      element.contentEditable = 'true';
    }
    element.spellcheck = false;
  }
  page.querySelector('#editor-style')?.remove();
  if (active) {
    const editorStyle = page.createElement('style');
    editorStyle.id = 'editor-style';
    editorStyle.textContent = '[contenteditable]{outline:1px dashed #ffc6a8aa;outline-offset:3px;cursor:text}'
      + '[contenteditable]:focus{outline:2px solid #ffc6a8}';
    page.head.append(editorStyle);
  }
}

// Cada texto es una sola línea: Enter termina la edición en vez de insertar un salto.
function finishOnEnter(event) {
  if (event.key !== 'Enter' || !event.target.isContentEditable) return;
  event.preventDefault();
  event.target.blur();
}

// Al editar, un clic en un enlace sirve para escribir. Fuera de la edición solo
// se siguen las anclas: un sitio externo reemplazaría la vista previa.
function holdLinks(event) {
  const link = event.target.closest('a');
  if (!link) return;
  const href = link.getAttribute('href');
  if (editing) event.preventDefault();
  else if (!href.startsWith('#')) {
    event.preventDefault();
    status.textContent = `Enlace externo (${href}): se abre desde el HTML descargado.`;
  }
}

frame.addEventListener('load', () => {
  const loaded = frame.contentDocument;
  if (!loaded?.querySelector('[data-edit]')) return;
  page = loaded;
  page.addEventListener('keydown', finishOnEnter);
  page.addEventListener('click', holdLinks);
  applyTexts(page, edits);
  showContent();
  setEditable(editing);
});

// ---------------------------------------------------------------- compilacion

function syncPanels() {
  const { settings } = lastResult;
  syncColors(colorsPanel, settings);
  syncCards(cardsPanel, addCardButton, settings, changeCards);
  syncFields(form, settings);
  syncLinks(linksPanel, originalLinks, content, changeLink);
  for (const input of columnInputs) input.checked = Number(input.value) === lastResult.report.gridColumns;
}

// Si ya hay una compilacion en curso, se repite al terminar con lo ultimo pedido.
function requestGeneration() {
  updateControls();
  if (busy) pending = true;
  else generate();
}

async function generate() {
  const sections = selectedSections();
  if (busy) return;
  if (!sections) {
    status.textContent = 'Selecciona al menos una sección.';
    return;
  }

  const requested = currentSelection();
  const requestedStyle = structuredClone(style);
  const query = new URLSearchParams({ sections });
  if (chosenColumns) query.set('columns', chosenColumns);
  if (Object.keys(style).length > 0) query.set('settings', JSON.stringify(style));
  busy = true;
  updateControls();
  status.textContent = 'Compilando SCSS…';

  try {
    const response = await fetch(`/api/landing?${query}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    saveEdits();
    page = null;
    lastResult = result;
    compiledSelection = requested;
    compiledStyle = requestedStyle;
    const original = new DOMParser().parseFromString(result.html, 'text/html');
    defaults = readTexts(original);
    originalLinks = readLinks(original);
    // Sin <base>, en un iframe srcdoc "#contacto" se resuelve contra la URL del
    // constructor y lo carga dentro de la vista previa. La descarga no lo lleva.
    frame.srcdoc = result.html.replace('<head>', '<head><base href="about:srcdoc">');
    showCode(view);
    columns.textContent = result.report.gridColumns;
    size.textContent = `${number.format(result.report.bytes)} bytes`;
    duplicates.textContent = result.report.duplicateRules;
    syncPanels();
    status.textContent = currentSelection() === requested ? 'Página generada.' : 'Aplicando los últimos cambios…';
  } catch (error) {
    // El cambio no es valido: se vuelve a lo ultimo que si compilo.
    style = structuredClone(compiledStyle);
    pending = false;
    if (lastResult) {
      document.activeElement?.blur();
      syncPanels();
    }
    status.textContent = error.message || 'La compilación falló. Vuelve a intentarlo.';
  } finally {
    busy = false;
    updateControls();
    if (pending) {
      pending = false;
      generate();
    }
  }
}

// ---------------------------------------------------------------- cambios de estilo

function changeCards(mutate) {
  const effective = lastResult.settings;
  const before = style.cards ?? effective.cards.map((card) => ({ id: card.id, color: card.color.slice(0, 7) }));
  const cards = structuredClone(before);
  const motion = { ...style.motion?.cards };
  mutate(cards, motion);
  if (JSON.stringify(cards) !== JSON.stringify(before)) style.cards = cards;
  if (Object.keys(motion).length > 0) style.motion = { ...style.motion, cards: motion };
  requestGeneration();
}

addCardButton.addEventListener('click', () => changeCards((cards) => {
  if (cards.length < 6) cards.push(nextCard(lastResult.settings, cards));
}));

function changeSetting(input) {
  const [group, name, property] = input.dataset.setting.split('.');
  const value = input.value === '' ? null : Number(input.value);
  if (property) style[group] = { ...style[group], [name]: { ...style[group]?.[name], [property]: value } };
  else if (name) style[group] = { ...style[group], [name]: value };
  else style[group] = value;
}

// ---------------------------------------------------------------- enlaces e imagen

function changeLink(key, change, input) {
  const entry = { ...content.links[key], ...change };
  if (change.href !== undefined) {
    if (change.href === '' || change.href === originalLinks[key]) delete entry.href;
    else if (!isSafeHref(change.href)) {
      input.setAttribute('aria-invalid', 'true');
      status.textContent = 'Destino no válido. Usa #seccion, https://, mailto: o tel:.';
      return;
    }
    input.removeAttribute('aria-invalid');
  }
  if (!entry.hidden) delete entry.hidden;
  if (Object.keys(entry).length > 0) content.links[key] = entry;
  else delete content.links[key];
  showContent();
  syncLinks(linksPanel, originalLinks, content, changeLink);
  status.textContent = 'Enlace actualizado.';
}

imageInput.addEventListener('change', () => {
  const [file] = imageInput.files;
  if (!file) return;
  const problem = imageProblem(file);
  if (problem) {
    imageInput.value = '';
    status.textContent = problem;
    return;
  }
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    content.image = { src: reader.result, alt: imageAlt.value.trim() };
    showContent();
    updateControls();
    status.textContent = 'Imagen aplicada. Reemplaza la ilustración del Hero.';
  });
  reader.readAsDataURL(file);
});

imageAlt.addEventListener('change', () => {
  if (!content.image) return;
  content.image.alt = imageAlt.value.trim();
  showContent();
});

function clearImage() {
  content.image = null;
  imageInput.value = '';
  showContent();
}

removeImageButton.addEventListener('click', () => {
  clearImage();
  updateControls();
  status.textContent = 'Se restauró la ilustración original.';
});

// ---------------------------------------------------------------- formulario

form.addEventListener('change', (event) => {
  const { target } = event;
  if (target.name === 'columns') chosenColumns = target.value;
  else if (target.dataset.setting) changeSetting(target);
  else if (target.dataset.motion) style.motion = { ...style.motion, [target.dataset.motion]: target.value };
  else if (target.dataset.color) {
    const group = target.dataset.colorGroup;
    style[group] = { ...style[group], [target.dataset.color]: target.value };
  } else if (target.name !== 'section') return;
  requestGeneration();
});

form.addEventListener('input', (event) => {
  if (event.target.id === 'gutter') $('output[for="gutter"]').textContent = `${event.target.value} rem`;
});

sectionList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-move]');
  if (!button) return;
  const row = button.closest('.section-row');
  if (button.dataset.move === 'up') row.previousElementSibling?.before(row);
  else row.nextElementSibling?.after(row);
  requestGeneration();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  requestGeneration();
});

resetAllButton.addEventListener('click', () => {
  // Sin vista previa cargada no se vuelven a recoger los textos anteriores.
  page = null;
  style = {};
  chosenColumns = null;
  edits = {};
  content = { links: {}, image: null };
  editing = false;
  editButton.setAttribute('aria-pressed', 'false');
  imageInput.value = '';
  imageAlt.value = '';
  sectionList.append(...initialSections);
  for (const input of form.querySelectorAll('input[name="section"]')) input.checked = true;
  requestGeneration();
});

// ---------------------------------------------------------------- vistas y descarga

// El SCSS que produjo la landing: la pantalla solo configura el DSL.
const formatScss = (entry) => entry.replace('with (', 'with (\n  ').replaceAll(', $', ',\n  $').replace('\n@use "landing"', '\n\n@use "landing"');

function showCode(next) {
  view = next;
  if (view !== 'preview') saveEdits();
  preview.hidden = view !== 'preview';
  code.hidden = view === 'preview';
  if (lastResult) stylesheet.textContent = view === 'scss' ? formatScss(lastResult.scss) : lastResult.css;
  for (const [name, tab] of Object.entries(tabs)) tab.setAttribute('aria-pressed', String(name === view));
}

for (const [name, tab] of Object.entries(tabs)) tab.addEventListener('click', () => showCode(name));

editButton.addEventListener('click', () => {
  saveEdits();
  editing = !editing;
  editButton.setAttribute('aria-pressed', String(editing));
  if (editing) showCode('preview');
  setEditable(editing);
  status.textContent = editing
    ? 'Haz clic en cualquier texto de la vista previa para cambiarlo.'
    : 'Edición terminada. La descarga incluye tus textos.';
  updateControls();
});

resetButton.addEventListener('click', () => {
  edits = {};
  if (page) applyTexts(page, defaults);
  status.textContent = 'Textos originales restablecidos.';
  updateControls();
});

function showMobile(active) {
  frame.classList.toggle('preview__frame_mobile', active);
  desktop.setAttribute('aria-pressed', String(!active));
  mobile.setAttribute('aria-pressed', String(active));
}

desktop.addEventListener('click', () => showMobile(false));
mobile.addEventListener('click', () => showMobile(true));

showMobile(matchMedia('(max-width: 760px)').matches);
new ResizeObserver(([entry]) => {
  const available = entry.contentRect.width;
  if (!available) return;
  const width = Math.max(1000, available);
  frame.style.setProperty('--frame-width', `${width}px`);
  frame.style.setProperty('--frame-scale', String(available / width));
}).observe(stage);

downloadButton.addEventListener('click', () => {
  if (!lastResult || currentSelection() !== compiledSelection) return;
  saveEdits();
  const url = URL.createObjectURL(new Blob([exportHtml(lastResult.html, edits, content)], { type: 'text/html;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'landing.html';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

generate();
