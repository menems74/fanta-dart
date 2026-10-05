import { auth, firebaseConfig } from './firebase.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword,
  createUserWithEmailAndPassword,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getAccount, getPlayer } from './db.js';

export const TESSERA_RE = /^\d{2}\/\d{3,4}$/;
export const PIN_RE = /^\d{4}$/;

// Firebase vuole email e password >= 6 caratteri: tessera e PIN vengono "travestiti".
// Ogni reset del PIN da parte di un admin crea un nuovo account con versione successiva.
export const MAX_VERSIONS = 3;
export const playerIdOf = (tessera) => tessera.replace('/', '-');
export const emailFor = (tessera, version = 0) =>
  `${playerIdOf(tessera)}${version ? `.r${version}` : ''}@fantadart.app`;
const passwordFor = (pin) => `${pin}-fanta`;

export function normalizeTessera(s) {
  return s.trim().replace(/[\s\\-]+/g, '/');
}

export const session = {
  user: null,
  account: null,
  player: null,
  error: null,
  get isAdmin() { return this.account?.ruolo === 'admin'; },
};

let probing = false; // true mentre login() prova le versioni dell'account: gli eventi di auth vanno ignorati
let sessionListener = () => {};

export const orphanMessage = (uid) =>
  `Accesso non riuscito: il PIN potrebbe essere stato reimpostato o l'account non è completo. Chiedi a un admin. (codice ${uid})`;

/**
 * Prova l'accesso con la versione base dell'account e poi con quelle create dai reset del PIN.
 * Un accesso valido ma senza collegamento a un giocatore (vecchia versione) viene saltato.
 */
export async function login(tessera, pin) {
  session.error = null;
  probing = true;
  let lastError;
  let orphanUid = null;
  try {
    for (let v = 0; v < MAX_VERSIONS; v++) {
      try {
        const cred = await signInWithEmailAndPassword(auth, emailFor(tessera, v), passwordFor(pin));
        if (await getAccount(cred.user.uid)) {
          probing = false;
          await applySession(auth.currentUser);
          return;
        }
        orphanUid ??= cred.user.uid;
        await signOut(auth);
      } catch (e) {
        lastError = e;
        const retry = ['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'];
        if (!retry.includes(e.code)) throw e;
      }
    }
  } finally {
    probing = false;
  }
  if (orphanUid) throw Object.assign(new Error('account senza collegamento'), { code: 'app/orphan', uid: orphanUid });
  throw lastError;
}

export const logout = () => signOut(auth);

export async function changeOwnPin(newPin) {
  await updatePassword(auth.currentUser, passwordFor(newPin));
}

let secondaryAuth;
const secondary = () => (secondaryAuth ??= getAuth(initializeApp(firebaseConfig, 'secondary')));

/** Crea l'account di un giocatore senza disconnettere l'admin (app Firebase secondaria). */
export async function createAccount(tessera, pin, version = 0) {
  const a = secondary();
  const cred = await createUserWithEmailAndPassword(a, emailFor(tessera, version), passwordFor(pin));
  await signOut(a);
  return cred.user.uid;
}

/** Verifica che il PIN sia quello attuale dell'account, senza toccare la sessione dell'admin. */
export async function verifyPin(tessera, version, pin) {
  const a = secondary();
  try {
    await signInWithEmailAndPassword(a, emailFor(tessera, version), passwordFor(pin));
    await signOut(a);
    return true;
  } catch (e) {
    if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(e.code)) return false;
    throw e;
  }
}

async function applySession(user) {
  Object.assign(session, { user, account: null, player: null });
  if (user) {
    try {
      session.account = await getAccount(user.uid);
      session.player = session.account ? await getPlayer(session.account.playerId) : null;
    } catch (e) {
      console.error(e);
      session.error = 'Impossibile leggere il profilo. Controlla la connessione.';
    }
    if (!session.account) {
      session.error ??= orphanMessage(user.uid);
      await signOut(auth);
      session.user = null;
    }
  }
  sessionListener(session);
}

export function watchSession(onChange) {
  sessionListener = onChange;
  // Si legge sempre lo stato attuale: eventi in ritardo (es. la disconnessione di una prova) non devono azzerare la sessione.
  onAuthStateChanged(auth, () => {
    if (!probing) applySession(auth.currentUser);
  });
}
