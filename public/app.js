import { applyTexts, collectTexts, exportHtml, readTexts } from '/texts.js';

const form = document.querySelector('#composer');
const generateButton = document.querySelector('#generate');
const downloadButton = document.querySelector('#download');
const status = document.querySelector('#status');
const previewTab = document.querySelector('#show-preview');
const codeTab = document.querySelector('#show-code');
const preview = document.querySelector('#preview');
const code = document.querySelector('#code');
const stylesheet = document.querySelector('#stylesheet');
const frame = document.querySelector('#frame');
const stage = document.querySelector('.preview__stage');
const desktop = document.querySelector('#desktop');
const mobile = document.querySelector('#mobile');
const editButton = document.querySelector('#edit-text');
const resetButton = document.querySelector('#reset-text');
const columnInputs = [...form.querySelectorAll('input[name="columns"]')];
const columns = document.querySelector('#columns');
const size = document.querySelector('#css-size');
const duplicates = document.querySelector('#duplicates');
const number = new Intl.NumberFormat('es-PE');
let lastResult;
let compiledSelection;
let busy = false;
// Columnas elegidas en pantalla. Sin elegir, manda el valor de _config.scss.
let chosenColumns = null;
// Textos originales de la landing compilada y cambios hechos por el usuario.
let defaults = {};
let edits = {};
let editing = false;
// Documento de la vista previa ya cargado (null mientras se reemplaza).
let page = null;

function selectedSections() {
  return new FormData(form).getAll('section').join(',');
}

function currentSelection() {
  return `${selectedSections()}|${chosenColumns ?? ''}`;
}

function updateControls() {
  generateButton.disabled = busy || !selectedSections();
  downloadButton.disabled = busy || !lastResult || currentSelection() !== compiledSelection;
  editButton.disabled = busy || !lastResult;
  resetButton.disabled = busy || (!editing && Object.keys(edits).length === 0);
  for (const input of columnInputs) input.disabled = busy;
}

// Lee lo que se escribió en la vista previa antes de usarlo o reemplazarla.
function saveEdits() {
  if (!page) return;
  edits = collectTexts(page, defaults, edits);
  applyTexts(page, { ...defaults, ...edits });
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
    const style = page.createElement('style');
    style.id = 'editor-style';
    style.textContent = '[contenteditable]{outline:1px dashed #ffc6a8aa;outline-offset:3px;cursor:text}'
      + '[contenteditable]:focus{outline:2px solid #ffc6a8}';
    page.head.append(style);
  }
}

// Cada texto es una sola línea: Enter termina la edición en vez de insertar un salto.
function finishOnEnter(event) {
  if (event.key !== 'Enter' || !event.target.isContentEditable) return;
  event.preventDefault();
  event.target.blur();
}

// Mientras se edita, un clic en un enlace sirve para escribir, no para navegar.
function holdLinksWhileEditing(event) {
  if (editing && event.target.closest('a')) event.preventDefault();
}

frame.addEventListener('load', () => {
  const loaded = frame.contentDocument;
  if (!loaded?.querySelector('[data-edit]')) return;
  page = loaded;
  page.addEventListener('keydown', finishOnEnter);
  page.addEventListener('click', holdLinksWhileEditing);
  applyTexts(page, edits);
  setEditable(editing);
});

form.addEventListener('change', (event) => {
  if (event.target.name === 'columns') {
    chosenColumns = event.target.value;
    updateControls();
    generate();
    return;
  }
  updateControls();
  if (!busy) {
    if (!selectedSections()) status.textContent = 'Selecciona al menos una sección.';
    else if (currentSelection() !== compiledSelection) status.textContent = 'Selección actualizada. Genera la página para aplicar los cambios.';
    else status.textContent = 'Página generada.';
  }
});

async function generate() {
  const sections = selectedSections();
  if (busy) return;
  if (!sections) {
    status.textContent = 'Selecciona al menos una sección.';
    return;
  }

  const requested = currentSelection();
  const query = new URLSearchParams({ sections });
  if (chosenColumns) query.set('columns', chosenColumns);
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
    defaults = readTexts(new DOMParser().parseFromString(result.html, 'text/html'));
    // Sin <base>, en un iframe srcdoc "#contacto" se resuelve contra la URL del
    // constructor y lo carga dentro de la vista previa. La descarga no lo lleva.
    frame.srcdoc = result.html.replace('<head>', '<head><base href="about:srcdoc">');
    stylesheet.textContent = result.css;
    columns.textContent = result.report.gridColumns;
    for (const input of columnInputs) input.checked = Number(input.value) === result.report.gridColumns;
    size.textContent = `${number.format(result.report.bytes)} bytes`;
    duplicates.textContent = result.report.duplicateRules;
    status.textContent = currentSelection() === requested
      ? 'Página generada.'
      : 'Genera de nuevo para aplicar la selección actual.';
  } catch (error) {
    status.textContent = error.message || 'La compilación falló. Vuelve a intentarlo.';
  } finally {
    busy = false;
    updateControls();
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  generate();
});

function showCode(active) {
  if (active) saveEdits();
  preview.hidden = active;
  code.hidden = !active;
  previewTab.setAttribute('aria-pressed', String(!active));
  codeTab.setAttribute('aria-pressed', String(active));
}

previewTab.addEventListener('click', () => showCode(false));
codeTab.addEventListener('click', () => showCode(true));

editButton.addEventListener('click', () => {
  saveEdits();
  editing = !editing;
  editButton.setAttribute('aria-pressed', String(editing));
  if (editing) showCode(false);
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
  const url = URL.createObjectURL(new Blob([exportHtml(lastResult.html, edits)], { type: 'text/html;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'landing.html';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

generate();
