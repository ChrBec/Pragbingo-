# 🥂 PragBingo – der interaktive JGA-Begleiter

Eine mobile Web-App für den Junggesellenabschied: geheime Missionen, ein
5×5-JGA-Bingo, ein Chaos-Knopf, ein Foto-Feed mit Live-Rangliste, Abstimmungen,
ein automatischer Abschlussbericht und ein anonymer Morgen-danach-Kater-Check.

Alle Handys der Gruppe teilen sich live einen Spielstand über
[Firebase](https://firebase.google.com/) (kostenlos), gehostet wird die App
kostenlos auf **GitHub Pages**.

## Funktionen

- **Geheime Missionen** – jede Person bekommt eigene Aufgaben, die nur sie sieht
- **JGA-Bingo** – persönliches 5×5-Feld, Reihen/Diagonalen bringen Bonuspunkte
- **Chaos-Knopf** – lost zufällig eine Person + eine Spontanaufgabe aus
- **Bräutigam-Joker** – der Bräutigam darf 3× eine Mission weitergeben
- **Live-Rangliste** – Punkte aus Missionen, Bingo, Chaos, Bonus & Strafe
- **Foto-Feed** – gemeinsame Timeline aller Beweisfotos/-videos
- **Abstimmungen** – „Bestes Foto“, „Peinlichster Moment“, „MVP des Abends“ (frei konfigurierbar)
- **Abschlussbericht** – automatische Zusammenfassung mit Gewinnern, Fotos & Kuriositäten-Statistiken
- **Morgen-danach-Modus** – anonyme Kater-Bewertung 1–10 mit Gruppen-Auswertung

Bingo-Felder, Missionen, Chaos-Aufgaben, Moment-Tags und Abstimmungskategorien
sind beim Erstellen eines Events direkt in der App frei editierbar.

---

## 1. Firebase-Projekt einrichten (kostenlos, ca. 5 Minuten)

1. Gehe zu [console.firebase.google.com](https://console.firebase.google.com/)
   und klicke **„Projekt hinzufügen“**. Name frei wählbar, z. B. `pragbingo`.
   Google Analytics kann deaktiviert bleiben.
2. Im Projekt links auf **Build → Firestore Database** → **Datenbank erstellen**
   → Standort wählen → im **Testmodus** starten (Regeln passen wir gleich an).
3. Links auf **Build → Storage** → **Los geht's** → ebenfalls im Testmodus starten
   (für Foto-/Video-Uploads).
4. Links auf **Build → Authentication** → **Los geht's** → Tab **Sign-in method**
   → **Anonym** aktivieren (die App loggt jede:n Teilnehmer:in anonym ein,
   niemand braucht ein Passwort).
5. Zurück zur Projektübersicht (Zahnrad oben links → **Projekteinstellungen**) →
   unten bei **„Meine Apps“** auf das Web-Symbol `</>` klicken → App registrieren
   (Name z. B. „PragBingo Web“, **kein** Hosting nötig).
6. Du bekommst ein `firebaseConfig`-Objekt mit `apiKey`, `authDomain`,
   `projectId`, `storageBucket`, `messagingSenderId`, `appId` – diese 6 Werte
   brauchst du gleich.

### Firestore- & Storage-Regeln

Die App ist bewusst ohne Login-Formular gebaut (jede:r tritt nur mit Namen +
Event-Code bei), daher regeln die Firestore/Storage-Regeln den Zugriff nur
über die anonyme Authentifizierung. Trage in **Firestore → Regeln** ein:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /events/{eventCode}/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Und in **Storage → Regeln**:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /events/{eventCode}/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Das reicht für einen privaten JGA-Abend im Freundeskreis (jede:r mit
Event-Code kann mitspielen, aber niemand von außen ohne Code).

---

## 2. Lokal entwickeln

```bash
npm install
cp .env.example .env
# .env mit den 6 Firebase-Werten aus Schritt 1 befüllen
npm run dev
```

Öffne die angezeigte URL auf dem Handy (im selben WLAN) oder im Browser.

---

## 3. Deployment auf GitHub Pages

Das Repo enthält bereits einen GitHub-Actions-Workflow
(`.github/workflows/deploy.yml`), der bei jedem Push auf `main` automatisch
baut und auf GitHub Pages veröffentlicht.

1. **Secrets hinterlegen**: Repo → **Settings → Secrets and variables →
   Actions → New repository secret**, für jeden der 6 Firebase-Werte einen
   Secret mit exakt diesem Namen anlegen:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
2. **Pages aktivieren**: Repo → **Settings → Pages** → bei „Build and
   deployment“ als **Source** „**GitHub Actions**“ auswählen.
3. Diesen Branch nach `main` mergen (oder direkt auf `main` pushen) – der
   Workflow baut die App automatisch und veröffentlicht sie unter:

   `https://<dein-github-name>.github.io/Pragbingo-/`

   (Der Pfad `/Pragbingo-/` ist in `vite.config.ts` als `base` hinterlegt und
   muss zum Repo-Namen passen – falls du das Repo umbenennst, dort anpassen.)

Den Link könnt ihr direkt in die WhatsApp-Gruppe für den JGA teilen.

---

## Ablauf am Abend

1. Gastgeber:in öffnet die App → **„Neues Event erstellen“** → Bräutigam-Name
   eintragen, optional Bingo/Missionen/Chaos-Aufgaben anpassen → bekommt einen
   **Event-Code**.
2. Alle anderen öffnen den Link → **„Event beitreten“** → Code + eigenen Namen
   eingeben (Bräutigam markiert sich per Checkbox).
3. Über den Abend: Missionen erledigen & Beweis hochladen, Bingo-Felder
   abhaken, den Chaos-Knopf drücken, Fotos im Feed teilen, abstimmen.
4. Am Ende: **Abschlussbericht**-Tab zeigt automatisch Sieger:innen,
   Foto-Highlights und Kuriositäten-Statistiken.
5. Am nächsten Morgen: **Kater**-Tab öffnen und anonym bewerten.

---

## Tech-Stack

- React 19 + TypeScript + Vite
- React Router (Hash-Routing, damit GitHub Pages ohne Server-Rewrites läuft)
- Firebase Firestore (Live-Datenbank), Firebase Storage (Fotos/Videos),
  Firebase Anonymous Auth
- Reines CSS (kein UI-Framework), mobile-first

## Projektstruktur

```
src/
  data/defaults.ts        Standard-Missionen, Bingo-Felder, Chaos-Aufgaben, Punkte
  state/EventContext.tsx  Zentrale Firestore-Anbindung & Spiellogik
  pages/                  Landing, Event erstellen/beitreten, Dashboard-Shell
  components/tabs/        Die 8 Haupt-Tabs der App
  lib/                    Hilfsfunktionen (IDs, Session, Bingo-Linien-Logik)
```
