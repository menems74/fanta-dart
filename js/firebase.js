import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

// La configurazione web di Firebase non è un segreto: la sicurezza è nelle regole di firestore.rules.
export const firebaseConfig = {
  apiKey: 'AIzaSyANTkyvo5PLI2WBgx_cwpol48SB4BTVHPA',
  authDomain: 'fanta-dart.firebaseapp.com',
  projectId: 'fanta-dart',
  storageBucket: 'fanta-dart.firebasestorage.app',
  messagingSenderId: '677810235509',
  appId: '1:677810235509:web:f0aaea22c63d517c8fb03c',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
