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
npm run dev
```

Die Firebase-Konfiguration liegt bereits in `.env` im Repo (siehe Hinweis
unten, warum das hier unbedenklich ist). Öffne die angezeigte URL auf dem
Handy (im selben WLAN) oder im Browser.

> **Warum eine `.env` mit echten Werten im Repo liegt:** Der Firebase
> „apiKey“ ist – anders als der Name suggeriert – kein Geheimnis. Er landet
> bei jedem Firebase-Webprojekt sowieso sichtbar im ausgelieferten
> JavaScript-Bundle, das jede:r Website-Besucher:in im Browser einsehen kann.
> Die eigentliche Zugriffskontrolle passiert über die Firestore-/Storage-
> Regeln oben (nur `request.auth != null`, also nur anonym eingeloggte
> Teilnehmer:innen mit Event-Code). Ihn im Repo zu committen ist deshalb
> Standard-Vorgehen für Firebase-Webapps, keine Sicherheitslücke.

---

## 3. Deployment auf GitHub Pages

Das Repo enthält bereits einen GitHub-Actions-Workflow
(`.github/workflows/deploy.yml`), der bei jedem Push auf `main` automatisch
baut (inkl. der committeten `.env`) und auf GitHub Pages veröffentlicht.

1. **Pages aktivieren**: Repo → **Settings → Pages** → bei „Build and
   deployment“ als **Source** „**GitHub Actions**“ auswählen.
2. Diesen Branch nach `main` mergen (oder direkt auf `main` pushen) – der
   Workflow baut die App automatisch und veröffentlicht sie unter:

   `https://<dein-github-name>.github.io/Pragbingo-/`

   (Der Pfad `/Pragbingo-/` ist in `vite.config.ts` als `base` hinterlegt und
   muss zum Repo-Namen passen – falls du das Repo umbenennst, dort anpassen.)

> **Wichtig bei privatem Repo:** GitHub Pages lässt sich auf einem
> kostenlosen GitHub-Account nur aus **öffentlichen** Repos veröffentlichen
> (private Repos + Pages brauchen GitHub Pro/Team). Da der Firebase-Key wie
> oben beschrieben ohnehin nicht geheim ist, kannst du das Repo vor dem
> Deployment gefahrlos wieder auf „Public“ stellen – dadurch wird nichts
> preisgegeben, was nicht sowieso im ausgelieferten Bundle stünde. Der
> eigentliche Schutz eures Spielstands sind die Firestore-/Storage-Regeln.

Den Link könnt ihr direkt in die WhatsApp-Gruppe für den JGA teilen.

---

## Ablauf am Abend

1. Gastgeber:in öffnet die App → **„Neues Event erstellen“** → Bräutigam-Name
   eintragen, optional Bingo/Missionen/Chaos-Aufgaben anpassen → bekommt einen
   **Event-Code**.
2. Alle anderen öffnen den Link → **„Event beitreten“** → Code, eigenen Namen
   und ein selbst gewähltes Passwort eingeben (Bräutigam markiert sich per
   Checkbox). Das Passwort wird nur beim allerersten Beitritt mit diesem
   Namen vergeben.
3. Über den Abend: Missionen erledigen & Beweis hochladen, Bingo-Felder
   abhaken, den Chaos-Knopf drücken, Fotos im Feed teilen, abstimmen.
4. Am Ende: **Abschlussbericht**-Tab zeigt automatisch Sieger:innen,
   Foto-Highlights und Kuriositäten-Statistiken.
5. Am nächsten Morgen: **Kater**-Tab öffnen und anonym bewerten.

### App geschlossen / anderes Handy?

Auf demselben Gerät merkt sich die App den Login automatisch (Landing-Seite
zeigt „Weiter zu deinem Event“). Falls der Browser-Speicher geleert wurde
oder du ein anderes Handy nutzt: einfach nochmal **„Event beitreten“** mit
**demselben Namen und Passwort** wie beim ersten Mal – die App erkennt den
Namen wieder und meldet dich mit deinem bisherigen Fortschritt (Punkte,
Missionen, Bingo-Feld) an, statt ein neues Profil anzulegen.

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
