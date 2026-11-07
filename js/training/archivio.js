// Dove finiscono le sessioni di allenamento. Con l'accesso: Firestore (come sempre).
// Senza accesso (ospite): solo su questo dispositivo, in localStorage. Nessuna scrittura verso Firestore.
import { session } from '../auth.js';
import * as db from '../db.js';
import { normalizzaSessione } from './giochi.js';

export const OSPITE_ID = 'ospite-locale';
const KEY = 'fd.train.ospite.sessioni';

/** true se chi gioca non ha fatto l'accesso. */
export const ospite = () => !session.user;
/** Id del giocatore corrente: la tessera, o un id fisso per l'ospite del dispositivo. */
export const pidCorrente = () => session.account?.playerId || OSPITE_ID;

function leggi() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function scrivi(lista) {
  try { localStorage.setItem(KEY, JSON.stringify(lista)); } catch { /* storage non disponibile */ }
}
const perTs = (a, b) => (a.ts || 0) - (b.ts || 0);

export const listSessioni = async (playerId) => (ospite()
  ? leggi().filter((x) => x.playerId === playerId).map(normalizzaSessione).sort(perTs)
  : db.listSessioni(playerId));

export const listTutteSessioni = async () => (ospite() ? leggi().map(normalizzaSessione).sort(perTs) : db.listTutteSessioni());

export function saveSessione(data) {
  if (!ospite()) return db.saveSessione(data);
  const id = `loc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  scrivi([...leggi(), { ...data, id }]);
  return { id, fatto: Promise.resolve() };
}

export const deleteSessione = async (id) => {
  if (!ospite()) return db.deleteSessione(id);
  scrivi(leggi().filter((x) => x.id !== id));
};

/** I compagni di squadra si leggono solo con l'accesso (regole di Firestore). */
export const listPlayers = async () => (ospite() ? [] : db.listPlayers());
