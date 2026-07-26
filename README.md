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
Event-Code bei). Damit **wirklich niemand ohne Bestätigung durch die
Gastgeber:in die Event-Daten sehen kann** (Fotos, Namen, Punktestände –
DSGVO-relevant), reicht "eingeloggt" allein nicht als Regel: Erst nach
Bestätigung landet die eigene anonyme Nutzer-ID in einer
`approvedUids`-Liste, und **nur** wer dort drinsteht, darf den Feed, die
Teilnehmer:innen-Liste, den Chaos-Verlauf usw. lesen. Wer wartet, bekommt
serverseitig (nicht nur in der Oberfläche!) ausschließlich Zugriff auf den
eigenen Warte-Status – der Rest ist für unbestätigte Anfragen technisch
unerreichbar, egal wie sie zugreifen.

Trage in **Firestore → Regeln** ein:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /events/{eventCode} {

      function isApproved() {
        return request.auth != null &&
          exists(/databases/$(database)/documents/events/$(eventCode)/approvedUids/$(request.auth.uid));
      }
      function isHost() {
        return request.auth != null &&
          get(/databases/$(database)/documents/events/$(eventCode)).data.hostAuthUid == request.auth.uid;
      }

      allow get: if request.auth != null;
      allow list: if false;
      allow create: if request.auth != null;
      allow update, delete: if false;

      match /players/{playerId} {
        allow get: if request.auth != null;
        allow list: if isApproved();
        allow create: if request.auth != null &&
          request.resource.data.authUid == request.auth.uid &&
          (
            request.resource.data.approved == false ||
            (isHost() && request.resource.data.approved == true)
          );
        allow update: if isHost() ||
          (
            isApproved() &&
            request.resource.data.approved == resource.data.approved &&
            request.resource.data.passwordHash == resource.data.passwordHash &&
            request.resource.data.authUid == resource.data.authUid
          );
        allow delete: if isHost();
      }

      match /approvedUids/{uidDoc} {
        allow get: if request.auth != null && request.auth.uid == uidDoc;
        allow list: if false;
        allow create: if isHost() ||
          (
            request.auth.uid == uidDoc &&
            request.resource.data.viaPlayerId is string &&
            get(/databases/$(database)/documents/events/$(eventCode)/players/$(request.resource.data.viaPlayerId)).data.approved == true &&
            get(/databases/$(database)/documents/events/$(eventCode)/players/$(request.resource.data.viaPlayerId)).data.passwordHash == request.resource.data.provenHash
          );
        allow update: if false;
        allow delete: if isHost();
      }

      match /feed/{postId} {
        allow read, write: if isApproved();
      }
      match /chaos/{chaosId} {
        allow read, write: if isApproved();
      }
      match /log/{logId} {
        allow read, write: if isApproved();
      }
      match /ballots/{ballotId} {
        allow read, write: if isApproved();
      }
    }
  }
}
```

Kurz erklärt, was die Regeln tun:
- **`events/{eventCode}`**: Der Event-Name selbst ist per Code lesbar (nötig
  für die Warte-Seite und den Beitritts-Check), aber niemand kann alle
  Events auflisten oder das Dokument nachträglich verändern.
- **`players`**: Ein einzelnes Profil per exakter ID lesen (nötig für
  Login/Beitritt) geht immer – aber die komplette Teilnehmer:innen-**Liste**
  gibt es nur für bereits bestätigte Mitglieder. Neue Profile starten
  zwingend mit `approved: false`, das lässt sich nicht durch einen
  manipulierten Schreibzugriff umgehen (die Regel erzwingt es serverseitig).
- **`approvedUids`**: Die eigentliche Freischaltung. Der Gastgeber schreibt
  hier bei Bestätigung die passende Nutzer-ID hinein; ein zurückkehrendes
  Gerät (gleicher Name + Passwort, aber neue anonyme Sitzung) darf sich
  selbst freischalten – aber nur, wenn es das korrekte Passwort-Hash für ein
  bereits bestätigtes Profil vorweisen kann.
- **`feed` / `chaos` / `log` / `ballots`**: Komplett gesperrt, solange man
  nicht in `approvedUids` steht.

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

### CORS für Storage aktivieren (nötig für den PDF-Export)

Fotos anzuzeigen (`<img>`) funktioniert ohne weiteres Setup. Der
**„Feed als PDF exportieren“**-Button lädt die Fotos aber per `fetch()`
herunter, um sie in die PDF einzubetten – das verlangt laut
[Firebase-Doku](https://firebase.google.com/docs/storage/web/download-files#cors_configuration)
eine explizite CORS-Freigabe auf dem Storage-Bucket, sonst kommt die
Meldung „Foto konnte nicht geladen werden“.

Einmalig einrichten (im Browser, keine Installation nötig):

1. [console.cloud.google.com](https://console.cloud.google.com/) öffnen,
   oben das Projekt **pragbingo** auswählen.
2. Rechts oben das **Cloud Shell**-Symbol (`>_`) anklicken – startet ein
   Terminal direkt im Browser.
3. Dort einfügen und ausführen (Origin ggf. anpassen, falls du das Repo
   umbenennst):

   ```bash
   cat > cors.json << 'EOF'
   [
     {
       "origin": ["https://chrbec.github.io", "http://localhost:5173"],
       "method": ["GET"],
       "maxAgeSeconds": 3600,
       "responseHeader": ["Content-Type"]
     }
   ]
   EOF
   gsutil cors set cors.json gs://pragbingo.firebasestorage.app
   ```

4. Zur Kontrolle: `gsutil cors get gs://pragbingo.firebasestorage.app`
   sollte die eben gesetzte Konfiguration zurückgeben.

Danach funktioniert der PDF-Export sofort, ohne dass die App neu deployt
werden muss.

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
