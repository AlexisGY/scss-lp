// Edición de los textos de la landing. Cada texto editable lleva data-edit="clave".
// Solo se guardan los cambios, y siempre se leen y escriben como texto plano
// (textContent), nunca como HTML.

const editable = (root) => [...root.querySelectorAll('[data-edit]')];

// Una sola línea: sin saltos, tabulaciones ni espacios duros repetidos.
export const normalizeText = (text) => text.replace(/\s+/g, ' ').trim();

export function readTexts(root) {
  return Object.fromEntries(editable(root).map((element) => [element.getAttribute('data-edit'), element.textContent]));
}

// Devuelve los cambios respecto a los textos originales. Un texto vacío o igual
// al original deja de contar como cambio. Las claves que no están en la página
// (secciones ocultas) se conservan para cuando vuelvan.
export function collectTexts(root, defaults, current = {}) {
  const changes = { ...current };
  for (const [key, raw] of Object.entries(readTexts(root))) {
    const text = normalizeText(raw);
    if (!text || text === normalizeText(defaults[key] ?? '')) delete changes[key];
    else changes[key] = text;
  }
  return changes;
}

export function applyTexts(root, texts) {
  for (const element of editable(root)) {
    const key = element.getAttribute('data-edit');
    // Solo se escribe lo que cambia: reescribir un texto igual movería el cursor.
    if (Object.hasOwn(texts, key) && element.textContent !== texts[key]) element.textContent = texts[key];
  }
}
