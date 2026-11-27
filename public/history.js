// Historial de deshacer y rehacer. Cada entrada es una foto del estado del
// constructor; quien registra una foto no debe modificarla después.

// La imagen se compara por separado: su data URL puede pesar más de 1 MB.
const withoutImage = ({ image, ...rest }) => JSON.stringify([rest, image?.alt ?? null]);

export function sameState(a, b) {
  return a.image?.src === b.image?.src && withoutImage(a) === withoutImage(b);
}

export function createHistory(initial, limit = 100) {
  const past = [];
  let present = initial;
  let future = [];

  return {
    get present() { return present; },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },

    // Agrega un paso. Un estado igual al actual no cuenta.
    record(state) {
      if (sameState(state, present)) return false;
      past.push(present);
      if (past.length > limit) past.shift();
      present = state;
      future = [];
      return true;
    },

    undo() {
      if (past.length === 0) return null;
      future.push(present);
      present = past.pop();
      return present;
    },

    redo() {
      if (future.length === 0) return null;
      past.push(present);
      present = future.pop();
      return present;
    },

    // Olvida los pasos finales que no compilaron; no quedan para rehacer.
    discard(isInvalid) {
      while (past.length > 0 && isInvalid(present)) present = past.pop();
    },
  };
}
