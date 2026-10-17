// Bozza della sessione in corso: resta sul telefono, cosi' non si perde nulla se si chiude l'app.
const key = (pid, tipo) => `fd.train.${pid}.${tipo}`;

export function loadDraft(pid, tipo) {
  try { return JSON.parse(localStorage.getItem(key(pid, tipo))); } catch { return null; }
}
export function saveDraft(pid, tipo, draft) {
  try { localStorage.setItem(key(pid, tipo), JSON.stringify(draft)); } catch { /* storage non disponibile */ }
}
export function clearDraft(pid, tipo) {
  try { localStorage.removeItem(key(pid, tipo)); } catch { /* storage non disponibile */ }
}
