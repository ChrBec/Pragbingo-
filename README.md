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
- **Challenge-Auktion** – jede Person schlägt Challenges vor, alle bieten
  verdeckt Prozentpunkte, Höchstbietende müssen liefern und gewinnen/verlieren
  entsprechend Punkte
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
   → dort **vier** Anbieter aktivieren:
   - **Anonym** (Gäste können ohne Konto beitreten)
   - **Google** (Toggle an, Support-E-Mail auswählen, speichern)
   - **E-Mail/Passwort** (Toggle an, speichern)
   - **Apple** – nur nötig, wenn ihr Apple-Anmeldung anbieten wollt. Das
     erfordert zusätzlich ein **kostenpflichtiges Apple Developer Program**
     Konto (99 $/Jahr): In [developer.apple.com](https://developer.apple.com)
     eine „Services ID" + einen „Sign in with Apple"-Key anlegen und die
     Werte (Team-ID, Key-ID, privater Key, Services-ID) hier bei Firebase
     eintragen. Ohne dieses Setup zeigt der „Mit Apple anmelden"-Button
     einfach eine Fehlermeldung – Google und E-Mail funktionieren davon
     unabhängig sofort.

   Danach unter **Authentication → Settings → Authorized domains** auf
   **„Domain hinzufügen"** klicken und `chrbec.github.io` eintragen (sonst
   schlägt die Google/Apple-Anmeldung mit `auth/unauthorized-domain` fehl –
   `localhost` ist für die lokale Entwicklung schon automatisch erlaubt).
5. Zurück zur Projektübersicht (Zahnrad oben links → **Projekteinstellungen**) →
   unten bei **„Meine Apps“** auf das Web-Symbol `</>` klicken → App registrieren
   (Name z. B. „PragBingo Web“, **kein** Hosting nötig).
6. Du bekommst ein `firebaseConfig`-Objekt mit `apiKey`, `authDomain`,
   `projectId`, `storageBucket`, `messagingSenderId`, `appId` – diese 6 Werte
   brauchst du gleich.

### Firestore- & Storage-Regeln

Zwei Zugriffsebenen: Ein Event-Passwort (von der Gastgeber:in vergeben,
gilt für alle Gäste) regelt den *Beitritt*; eine zusätzliche
`approvedUids`-Freischaltung durch die Gastgeber:in regelt, wer die
Event-**Daten** (Fotos, Namen, Punktestände – DSGVO-relevant) überhaupt
lesen darf. Wer wartet, bekommt serverseitig (nicht nur in der
Oberfläche!) ausschließlich Zugriff auf den eigenen Warte-Status.
Event-Erstellung ist außerdem an ein echtes Konto gebunden (Google, Apple
oder E-Mail) – rein anonym kann man nur beitreten, nicht erstellen.

Trage in **Firestore → Regeln** ein:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Fest verdrahtete App-Admin-Identität (Login "admin" / Passwort in der
    // App). Kein Custom Claim nötig, da E-Mail/Passwort-Logins die E-Mail
    // direkt unfälschbar im ID-Token mitliefern.
    function isAppAdmin() {
      return request.auth != null &&
        request.auth.token.email == 'app-admin@pragbingo.internal';
    }

    match /users/{uid}/events/{eventCode} {
      allow read, write: if request.auth != null &&
        (request.auth.uid == uid || isAppAdmin());
    }

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
      allow list: if isAppAdmin();
      allow create: if request.auth != null &&
        request.auth.token.firebase.sign_in_provider != 'anonymous' &&
        request.resource.data.hostAuthUid == request.auth.uid;
      allow update: if false;
      allow delete: if isAppAdmin();

      match /players/{playerId} {
        allow get: if request.auth != null;
        allow list: if isApproved() || isAppAdmin();
        allow create: if request.auth != null &&
          request.resource.data.authUid == request.auth.uid &&
          (
            request.resource.data.approved == false ||
            (isHost() && request.resource.data.approved == true)
          );
        allow update: if isHost() ||
          isAppAdmin() ||
          (
            isApproved() &&
            request.resource.data.approved == resource.data.approved &&
            request.resource.data.authUid == resource.data.authUid
          );
        allow delete: if isHost() || isAppAdmin();
      }

      match /approvedUids/{uidDoc} {
        allow get: if request.auth != null && (request.auth.uid == uidDoc || isAppAdmin());
        allow list: if isAppAdmin();
        allow create: if isHost();
        allow update: if false;
        allow delete: if isHost() || isAppAdmin();
      }

      match /feed/{postId} {
        allow read, write: if isApproved() || isAppAdmin();
      }
      match /chaos/{chaosId} {
        allow read, write: if isApproved() || isAppAdmin();
      }
      match /log/{logId} {
        allow read, write: if isApproved() || isAppAdmin();
      }
      match /ballots/{ballotId} {
        allow read, write: if isApproved() || isAppAdmin();
      }
      match /challenges/{challengeId} {
        allow read, write: if isApproved() || isAppAdmin();
        match /bids/{bidPlayerId} {
          allow read, write: if isApproved() || isAppAdmin();
        }
      }
    }
  }
}
```

Kurz erklärt, was die Regeln tun:
- **`isAppAdmin()`**: Erkennt ausschließlich das eine feste Admin-Konto
  (E-Mail `app-admin@pragbingo.internal`, wird beim ersten Login mit
  Passwort `manage` automatisch angelegt) und schaltet ihm überall Lese-,
  Auflist- und Lösch-Rechte frei – normale Gäste/Gastgeber:innen sind davon
  unberührt.
- **`users/{uid}/events`**: Die persönliche „Meine Events“-Liste – nur der
  jeweilige Account selbst (oder der Admin) darf seine eigenen Einträge
  lesen/schreiben.
- **`events/{eventCode}`**: Nur echte (nicht-anonyme) Konten dürfen Events
  anlegen, und nur mit sich selbst als `hostAuthUid`. Der Event-Name ist per
  Code lesbar (nötig für Warte-Seite/Beitritts-Check), niemand außer dem
  Admin kann alle Events auflisten, niemand außer dem Admin kann ein Event
  wieder löschen.
- **`players`**: Ein einzelnes Profil per exakter ID lesen (nötig für den
  Beitritts-Check) geht immer – aber die komplette
  Teilnehmer:innen-**Liste** gibt es nur für bereits bestätigte Mitglieder
  (oder den Admin). Neue Profile starten zwingend mit `approved: false`,
  erzwungen von der Regel selbst, nicht nur vom Client.
- **`approvedUids`**: Die eigentliche Freischaltung, ausschließlich von der
  Gastgeber:in (oder dem Admin) vergeben. Echte Konten (Google/Apple/E-Mail)
  behalten ihre UID über Geräte hinweg – einmal freigeschaltet, bleibt der
  Zugriff also automatisch bestehen, auch auf einem neuen Handy (das ist der
  Mechanismus hinter „Meine Events“).
- **`feed` / `chaos` / `log` / `ballots` / `challenges`**: Komplett gesperrt,
  solange man nicht in `approvedUids` steht – außer für den Admin.

> **Hinweis zur „verdeckten“ Abstimmung bei Challenges:** Die Gebote werden
> in der Oberfläche erst nach Abschluss angezeigt – rein technisch könnte
> sich aber jede bereits bestätigte Person die `bids`-Unterkollektion direkt
> über die Firestore-SDK ansehen (dieselbe Vertrauensbasis wie bei den
> „geheimen“ Missionen, die ebenfalls nur clientseitig verborgen sind). Für
> eine wirklich serverseitig verdeckte Blind-Auktion bräuchte es eine Cloud
> Function, die außerhalb des Rahmens dieses reinen Client+Firestore-Setups
> liegt.

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

Für Storage ist keine Änderung nötig – „jede:r angemeldete Person“ deckt den
Admin schon mit ab.

### Admin-Bereich

Unter `#/admin` gibt es einen separaten Login („Benutzername“ ist fest
`admin`, Passwort frei wählbar). Der Admin-Zugang ist unabhängig von
einzelnen Events und für die Person gedacht, die die App insgesamt
betreut. Es gibt dafür **bewusst keinen sichtbaren Link** in der App –
`https://<dein-github-username>.github.io/Pragbingo-/#/admin` direkt
aufrufen bzw. als Lesezeichen speichern.

- **Login**: Beim allerersten Login mit dem Passwort `manage` wird das
  Admin-Konto automatisch angelegt (kein manueller Schritt in der Firebase
  Console nötig). Ab dann ist es ein normales E-Mail/Passwort-Konto –
  danach ändert sich nichts mehr automatisch, das Passwort bleibt `manage`,
  bis du es (optional) in der Firebase Console unter **Authentication →
  Users** manuell zurücksetzt.
- **Reiter „Events“**: Liste aller Events mit Teilnehmer:innenzahl, durchsuchbar
  per Event-Code oder -Name. Beim Öffnen eines Events werden alle
  Teilnehmer:innen mit Punktestand, Beitrittsdatum und verbrauchtem Speicher
  (Anzahl Fotos/Videos + MB, berechnet aus den tatsächlichen
  Datei­größen in Storage) angezeigt, inkl. „Nutzerdaten löschen“ pro Person
  und „Ganzes Event löschen“.
- **Reiter „Nutzer:innen“**: Alle Personen app-weit, aggregiert über ihre
  Firebase-Auth-UID (durchsuchbar per Name oder UID) – mit allen Events, in
  denen sie mitspielen. Pro Mitgliedschaft lassen sich Name und Punktestand
  direkt bearbeiten, und „Überall löschen“ entfernt eine Person aus jedem
  Event auf einmal (Events, in denen sie Host ist, werden dabei komplett
  gelöscht).
- **DSGVO-Löschung im Detail**: „Nutzerdaten löschen“ entfernt unwiderruflich
  alle Fotos/Videos (inkl. Storage-Dateien), Feed-Beiträge, Log-Einträge,
  Chaos-Zuweisungen, abgegebenen Stimmen, Challenge-Gebote/-Gewinne, die
  Freischaltung und das Profil dieser Person in einem Event.
- **Grenze der Löschung**: Aus einer reinen Client-App heraus lässt sich das
  Firebase-**Auth-Konto** (die E-Mail-Adresse/Anmeldedaten) einer anderen
  Person technisch nicht löschen – das bräuchte eine Cloud Function mit dem
  Firebase Admin SDK, was außerhalb dieses Setups liegt. Alle
  personenbezogenen **Inhalte** (Name, Fotos, Punkte, Missionen, Beiträge,
  Stimmen) werden aber vollständig entfernt. Falls auch das Auth-Konto weg
  soll, geht das manuell in der Firebase Console unter **Authentication →
  Users**.
- Es gibt auch keine zentrale Liste aller Nutzer:innen in Firebase Auth
  selbst (das bräuchte ebenfalls das Admin SDK) – der Reiter „Nutzer:innen“
  leitet die Liste stattdessen aus allen Teilnehmer:innen-Profilen über alle
  Events her.

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

1. Gastgeber:in öffnet die App → **„Neues Event erstellen“** → meldet sich
   (einmalig) mit Google, Apple oder E-Mail an → Bräutigam-Name, eigenen
   Namen und ein **Event-Passwort** eintragen, optional Bingo/Missionen/
   Chaos-Aufgaben anpassen → bekommt einen **Event-Code**.
2. Gastgeber:in gibt Code **und** Event-Passwort an alle Gäste weiter (z. B.
   in der WhatsApp-Gruppe).
3. Alle anderen öffnen den Link → **„Event beitreten“** → Code,
   Event-Passwort und eigenen Namen eingeben (Bräutigam markiert sich per
   Checkbox) → landen zunächst auf einer Warteseite, bis die Gastgeber:in
   sie im **„Verwalten“**-Tab bestätigt.
4. Über den Abend: Missionen erledigen & Beweis hochladen, Bingo-Felder
   abhaken, den Chaos-Knopf drücken, im **Challenges**-Tab Aufgaben
   vorschlagen und verdeckt Punkte darauf bieten, Fotos im Feed teilen,
   abstimmen.
5. Am Ende: **Abschlussbericht**-Tab zeigt automatisch Sieger:innen,
   Foto-Highlights und Kuriositäten-Statistiken.
6. Am nächsten Morgen: **Kater**-Tab öffnen und anonym bewerten.

### App geschlossen / anderes Handy?

Auf demselben Gerät merkt sich die App den Login automatisch (Landing-Seite
zeigt „Weiter zu deinem Event“).

Für einen nahtlosen Wechsel zwischen Handys **ohne** das Event-Passwort
erneut einzugeben: beim Beitreten (oder vorher über „Anmelden“ auf der
Startseite) mit Google, Apple oder E-Mail anmelden. Das Event erscheint
danach automatisch unter **„Meine Events“** – ein Tap, und man ist wieder
drin, mit vollem Punktestand und Fortschritt, egal auf welchem Gerät.

Wer rein anonym beigetreten ist und Browser-Speicher/Gerät wechselt, muss
sich mit Code + Event-Passwort + demselben Namen neu anmelden und landet
dann als neue Anfrage erneut auf der Warteliste (da es ohne Konto keine
sichere Möglichkeit gibt, dieselbe Person wiederzuerkennen).

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
  state/AuthContext.tsx   Echter Anmeldezustand (Google/Apple/E-Mail vs. anonym)
  state/EventContext.tsx  Zentrale Firestore-Anbindung & Spiellogik
  pages/                  Landing, Login, Meine Events, Event erstellen/beitreten, Dashboard-Shell
  components/tabs/        Die 9 Haupt-Tabs der App
  lib/                    Hilfsfunktionen (IDs, Session, Bingo-Linien-Logik)
```
