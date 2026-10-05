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

export async function login(tessera, pin) {
  session.error = null;
  let lastError;
  for (let v = 0; v < MAX_VERSIONS; v++) {
    try {
      await signInWithEmailAndPassword(auth, emailFor(tessera, v), passwordFor(pin));
      return;
    } catch (e) {
      lastError = e;
      const retry = ['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'];
      if (!retry.includes(e.code)) throw e;
    }
  }
  throw lastError;
}

export const logout = () => signOut(auth);

export async function changeOwnPin(newPin) {
  await updatePassword(auth.currentUser, passwordFor(newPin));
}

let secondaryAuth;
/** Crea l'account di un giocatore senza disconnettere l'admin (app Firebase secondaria). */
export async function createAccount(tessera, pin, version = 0) {
  secondaryAuth ??= getAuth(initializeApp(firebaseConfig, 'secondary'));
  const cred = await createUserWithEmailAndPassword(secondaryAuth, emailFor(tessera, version), passwordFor(pin));
  await signOut(secondaryAuth);
  return cred.user.uid;
}

export function watchSession(onChange) {
  onAuthStateChanged(auth, async (user) => {
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
        session.error ??= 'Account non configurato: chiedi a un admin.';
        await signOut(auth);
        session.user = null;
      }
    }
    onChange(session);
  });
}
