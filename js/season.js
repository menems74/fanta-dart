const KEY = 'fd.season';

const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

export function getSelectedSeason(seasons) {
  const id = read();
  return seasons.find((s) => s.id === id) || seasons[0];
}

export function setSelectedSeason(id) {
  try { localStorage.setItem(KEY, id); } catch { /* storage non disponibile */ }
}
