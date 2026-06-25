# ENTSO-E-EU-Stromdaten API

## Projektüberblick
Dieses Repository enthält ein Tool, mit dem EU-Stromdaten für Erzeugung und Verbrauch in nahezu Echtzeit abgerufen und visualisiert werden.

## Was wir programmiert haben
Wir haben eine kleine Datenplattform für EU-Stromdaten gebaut:
- Ein Python-Backend ruft Daten über die ENTSO-E-Schnittstelle ab.
- Eine Pipeline bereitet die Rohdaten auf und vereinheitlicht sie für die weitere Nutzung.
- Eine Web-Oberfläche (Frontend) zeigt die Daten übersichtlich für den schnellen Vergleich von Ländern, Erzeugung und Verbrauch.

## Wie das Tool funktioniert
1. Das Backend stellt Anfragen an ENTSO-E und lädt aktuelle Stromdaten.
2. Die Daten werden in der Pipeline bereinigt, strukturiert und in ein einheitliches Format gebracht.
3. Über API-Endpunkte liefert das Backend die aufbereiteten Daten an das Frontend.
4. Das Frontend visualisiert die Ergebnisse als interaktive Ansicht im Browser.

Das Ergebnis ist ein durchgängiges Tool von der Datenerfassung bis zur Visualisierung.

## Schnellstart

### Voraussetzungen
- Python 3.10 oder neuer
- Node.js 18 oder neuer
- ENTSOE API Key (in der Backend-Umgebungsdatei)

### 1. Backend einrichten und starten
```powershell
cd EU-Stromdaten Tool/prototype
pip install -r requirements.txt
copy .env.example .env
```

Trage danach in der Datei `.env` mindestens `ENTSOE_API_KEY` ein. (bcfc03b2-2939-4ec2-b4b5-5d1a257083b2)

```powershell
uvicorn backend_api:app --reload --host 0.0.0.0 --port 8000
```

Backend läuft dann unter: `http://localhost:8000`

### 2. Frontend einrichten und starten
In einem zweiten Terminal:

```powershell
cd EU-Stromdaten Tool/prototype/frontend
npm install
copy .env.example .env
npm run dev
```

Frontend läuft dann unter: `http://localhost:5173`

### 3. Tool im Browser öffnen
Öffne `http://localhost:5173`. Das Frontend ruft die Daten über das lokale Backend unter `http://localhost:8000` ab.


Für einen Provider wie Vercel, Netlify oder GitHub Pages kann der Build-Schritt direkt über die eingestellten Variablen laufen:
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variable: `VITE_BACKEND_URL`
