import { db } from './firebase.js';
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, writeBatch,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const list = async (q) => (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }));
const one = async (ref) => {
  try {
    const s = await getDoc(ref);
    return s.exists() ? { id: s.id, ...s.data() } : null;
  } catch (e) {
    if (e.code === 'permission-denied') return null; // es. partita non pubblicata vista da un Player
    throw e;
  }
};

// ---------- account e giocatori ----------
export const getAccount = (uid) => one(doc(db, 'accounts', uid));
export const setAccount = (uid, data) => setDoc(doc(db, 'accounts', uid), data);
export const delAccount = (uid) => deleteDoc(doc(db, 'accounts', uid));

export const getPlayer = (id) => one(doc(db, 'players', id));
export const listPlayers = async () =>
  (await list(collection(db, 'players'))).sort(
    (a, b) => a.cognome.localeCompare(b.cognome, 'it') || a.nome.localeCompare(b.nome, 'it'));
export const savePlayer = (id, data) => setDoc(doc(db, 'players', id), data, { merge: true });

// ---------- stagioni ----------
export const listSeasons = async () =>
  (await list(collection(db, 'seasons'))).sort((a, b) => b.creataIl - a.creataIl);
export const getSeason = (id) => one(doc(db, 'seasons', id));
export async function saveSeason(id, data) {
  const ref = id ? doc(db, 'seasons', id) : doc(collection(db, 'seasons'));
  await setDoc(ref, id ? data : { ...data, creataIl: Date.now() }, { merge: true });
  return ref.id;
}

// ---------- partite ----------
const byDateDesc = (a, b) => b.data.localeCompare(a.data) || b.creataIl - a.creataIl;

/** seasonId null = tutte le stagioni. Con onlyPublished solo le serate pubblicate. */
export async function listMatches(seasonId, { onlyPublished }) {
  const c = [];
  if (seasonId) c.push(where('seasonId', '==', seasonId));
  if (onlyPublished) c.push(where('pubblicata', '==', true));
  return (await list(query(collection(db, 'matches'), ...c))).sort(byDateDesc);
}
export const getMatch = (id) => one(doc(db, 'matches', id));
export async function saveMatch(id, data) {
  const ref = id ? doc(db, 'matches', id) : doc(collection(db, 'matches'));
  await setDoc(ref, id ? data : { ...data, creataIl: Date.now(), pubblicata: false, mvpPlayerId: null }, { merge: true });
  return ref.id;
}
/** Sposta la partita in un'altra stagione, insieme ai suoi pagellini (che ne portano una copia). */
export async function changeMatchSeason(matchId, seasonId) {
  const cards = await listCards({ matchId }, { onlyPublished: false });
  const batch = writeBatch(db);
  batch.set(doc(db, 'matches', matchId), { seasonId }, { merge: true });
  for (const c of cards) batch.set(doc(db, 'reportCards', c.id), { seasonId }, { merge: true });
  await batch.commit();
}
export const setMvp =(matchId, playerId) =>
  setDoc(doc(db, 'matches', matchId), { mvpPlayerId: playerId }, { merge: true });

export async function setMatchPublished(matchId, value) {
  const cards = await listCards({ matchId }, { onlyPublished: false });
  const batch = writeBatch(db);
  batch.set(doc(db, 'matches', matchId), { pubblicata: value }, { merge: true });
  for (const c of cards) batch.set(doc(db, 'reportCards', c.id), { pubblicata: value }, { merge: true });
  await batch.commit();
}

export async function deleteMatch(matchId) {
  const cards = await listCards({ matchId }, { onlyPublished: false });
  const batch = writeBatch(db);
  for (const c of cards) batch.delete(doc(db, 'reportCards', c.id));
  batch.delete(doc(db, 'matches', matchId));
  await batch.commit();
}

// ---------- pagellini ----------
export const cardId = (matchId, playerId) => `${matchId}_${playerId}`;

/** filter: { matchId?, seasonId?, playerId? } */
export async function listCards(filter, { onlyPublished }) {
  const c = Object.entries(filter).map(([k, v]) => where(k, '==', v));
  if (onlyPublished) c.push(where('pubblicata', '==', true));
  return list(query(collection(db, 'reportCards'), ...c));
}
export const getCard = (matchId, playerId) => one(doc(db, 'reportCards', cardId(matchId, playerId)));
export const saveCard = (card) =>
  setDoc(doc(db, 'reportCards', cardId(card.matchId, card.playerId)), card);
export const deleteCard = (matchId, playerId) =>
  deleteDoc(doc(db, 'reportCards', cardId(matchId, playerId)));
