# Fanta Dart

App web installabile (PWA) per la squadra di freccette: gli admin inseriscono le serate e scrivono i pagellini, i giocatori li leggono dal telefono. Tema scuro, pensata per l'uso al pub.

## Funzioni

- Accesso con **numero tessera** (`08/4272`) e **PIN a 4 cifre**.
- **Stagioni** con nome squadra e roster, da confermare a ogni nuova stagione.
- **Partite** con data, luogo, avversario e risultato.
- **Pagellini**: voto 1–10, partite vinte, commento, flag **MVP** (uno per serata). Restano in bozza finché l'admin non preme **Pubblica serata**.
- **Profilo** con media voto, partite, vinte e MVP (per stagione e carriera) e **classifica**.
- **Esporta il pagellino come immagine** e condividilo su WhatsApp.
- Funziona anche offline in lettura.

## Tecnologie

HTML, CSS e JavaScript (moduli ES) senza build. Firebase Authentication + Cloud Firestore dal browser, nessun server proprio. Ospitabile su GitHub Pages.

```
index.html, manifest.webmanifest, sw.js     PWA
css/app.css                                 stile
js/                                         app, auth, accesso ai dati, statistiche
js/views/                                   una schermata per file
assets/                                     logo e icone
firestore.rules                             regole di sicurezza
tests/                                      test dei calcoli (npm test)
```

## Dati (Firestore)

| Collezione | Contenuto |
|---|---|
| `accounts/{uid}` | ruolo (`admin` / `player`) e giocatore collegato all'account di accesso |
| `players/{tessera}` | nome, cognome, tessera, ruolo, attivo (id = tessera con `-` al posto di `/`) |
| `seasons/{id}` | nome, squadra, roster (`playerIds`) |
| `matches/{id}` | stagione, data, luogo, avversario, punti, `mvpPlayerId`, `pubblicata` |
| `reportCards/{matchId_playerId}` | voto, partite vinte, testo, `pubblicata` |

I Player leggono solo le serate con `pubblicata: true` (vedi `firestore.rules`).

## Configurazione di Firebase (una tantum)

1. Nella console Firebase del progetto `fanta-dart`: **Authentication → Metodo di accesso → Email/Password: abilita**; **Firestore Database** creato.
2. **Firestore → Regole**: incolla il contenuto di `firestore.rules` e pubblica (oppure `npm run rules:deploy` con la Firebase CLI).
3. **Primo admin** (serve una sola volta):
   1. *Authentication → Utenti → Aggiungi utente*: email `NN-NNNN@fantadart.app` (la tessera con `-` al posto di `/`, es. `08-4272@fantadart.app`), password = **PIN + `-fanta`** (es. `1234-fanta`). Copia lo **UID** dell'utente creato.
   2. *Firestore → Avvia raccolta* `accounts`, ID documento = lo UID, campi: `playerId` (stringa, es. `08-4272`), `ruolo` (stringa, `admin`).
   3. Raccolta `players`, ID documento = `08-4272`, campi: `tessera` `08/4272`, `nome`, `cognome`, `ruolo` `admin`, `attivo` `true` (booleano), `uid` = lo UID, `authVersion` `0` (numero).
4. Entra nell'app con tessera e PIN, poi crea la prima stagione da **Gestione**. Gli altri giocatori si creano dall'app.

## Provarla in locale

```bash
npm start
```

Poi apri http://localhost:5173 (serve Python; qualunque server statico va bene).

## Pubblicazione su GitHub Pages

*Settings → Pages → Build and deploy → Deploy from a branch → `main` / `(root)`*. L'indirizzo sarà `https://<utente>.github.io/fanta-dart/`. Per i test su telefono, in Firebase **Authentication → Impostazioni → Domini autorizzati** il dominio `github.io` non serve (si usa solo email/password), ma tienilo a mente se aggiungi altri metodi.

## Note sulla sicurezza

È un'app tra amici: il PIN a 4 cifre (con un suffisso fisso per raggiungere le 6 lettere richieste da Firebase) protegge da curiosi, non da attacchi mirati. La chiave in `js/firebase.js` identifica il progetto e non è un segreto; l'accesso ai dati è regolato da `firestore.rules`. Se un giocatore dimentica il PIN, l'admin lo reimposta dalla sua scheda (massimo 2 reset per tessera).

## Licenza

MIT
