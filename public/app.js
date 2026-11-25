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
const columns = document.querySelector('#columns');
const size = document.querySelector('#css-size');
const duplicates = document.querySelector('#duplicates');
const number = new Intl.NumberFormat('es-PE');
let lastResult;
let compiledSelection;
let busy = false;

function selectedSections() {
  return new FormData(form).getAll('section').join(',');
}

function updateControls() {
  const selection = selectedSections();
  generateButton.disabled = busy || !selection;
  downloadButton.disabled = busy || !lastResult || selection !== compiledSelection;
}

form.addEventListener('change', () => {
  const selection = selectedSections();
  updateControls();
  if (!busy) {
    if (!selection) status.textContent = 'Selecciona al menos una sección.';
    else if (selection !== compiledSelection) status.textContent = 'Selección actualizada. Genera la página para aplicar los cambios.';
    else status.textContent = 'Página generada.';
  }
});

async function generate() {
  const selection = selectedSections();
  if (busy || !selection) return;

  busy = true;
  updateControls();
  status.textContent = 'Compilando SCSS…';

  try {
    const response = await fetch(`/api/landing?${new URLSearchParams({ sections: selection })}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    lastResult = result;
    compiledSelection = selection;
    // Sin <base>, en un iframe srcdoc "#contacto" se resuelve contra la URL del
    // constructor y lo carga dentro de la vista previa. La descarga no lo lleva.
    frame.srcdoc = result.html.replace('<head>', '<head><base href="about:srcdoc">');
    stylesheet.textContent = result.css;
    columns.textContent = result.report.gridColumns;
    size.textContent = `${number.format(result.report.bytes)} bytes`;
    duplicates.textContent = result.report.duplicateRules;
    status.textContent = selectedSections() === selection
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
  preview.hidden = active;
  code.hidden = !active;
  previewTab.setAttribute('aria-pressed', String(!active));
  codeTab.setAttribute('aria-pressed', String(active));
}

previewTab.addEventListener('click', () => showCode(false));
codeTab.addEventListener('click', () => showCode(true));

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
  if (!lastResult || selectedSections() !== compiledSelection) return;
  const url = URL.createObjectURL(new Blob([lastResult.html], { type: 'text/html;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'landing.html';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

generate();
