# Anleitung: ENTSO-E Tool anwenden

Die Anwendung nutzt ENTSO-E als primäre Datenquelle. Green Grid Compass bleibt optional für ergänzende Metriken verfügbar.

## Kurzfassung

1. Backend starten
2. Frontend starten
3. Im Browser öffnen
4. Daten laden

## 1. Voraussetzungen

Stelle sicher, dass installiert sind:

- Python 3
- Node.js und npm
- Git

## 2. Schnellstart

### Backend starten

```powershell
cd EU-Stromdaten Tool/prototype
pip install -r requirements.txt
copy .env.example .env
uvicorn backend_api:app --reload --host 0.0.0.0 --port 8000
```

Das Backend läuft danach unter:

```text
http://localhost:8000
```

### Frontend starten

Öffne ein zweites Terminal und führe aus:

```powershell
cd EU-Stromdaten Tool/prototype/frontend
npm install
copy .env.example .env
npm run dev
```

Das Frontend läuft danach unter:

```text
http://localhost:5173
```

## 3. So nutzt du das Tool

1. Öffne http://localhost:5173 im Browser.
2. Falls nötig, stelle die Backend-URL auf http://localhost:8000 ein.
3. Wähle eine Zone wie DE.
4. Lege Start- und Endzeitpunkt fest.
5. Klicke auf Daten laden.

Danach werden dir automatisch angezeigt:

- ENTSO-E-Erzeugung als Standardansicht
- Rohdaten und Vergleichsdaten für den gewählten Zeitraum
- Optionale GGC-Metriken, falls du sie im Frontend zusätzlich nutzen willst
- Lesezeichen und Cache-Status

## 4. Was du optional anpassen kannst

- API-Key eintragen, falls das Backend ihn verlangt
- Vergleichsmodus aktivieren
- Lesezeichen für häufige Abfragen speichern
- GGC nur dann aktivieren, wenn du die Zusatzmetriken brauchst
- Backend-URL über die Umgebungsvariable VITE_BACKEND_URL festlegen

## 5. Wenn etwas nicht funktioniert

- Prüfe, ob Backend und Frontend tatsächlich laufen
- Prüfe, ob die Backend-URL korrekt ist
- Prüfe, ob die .env-Datei vorhanden ist
- Falls das Backend nicht erreichbar ist, greift das Frontend auf den letzten Cache zurück

## 6. Für den nächsten Schritt

Für einen produktiveren Einsatz solltest du später noch ergänzen:

- HTTPS
- echte Secrets für API-Keys
- Hosting-Deployment
- Monitoring und Logging
