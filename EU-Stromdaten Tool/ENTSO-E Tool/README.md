# ENTSO-E Tool

Lokales Tool zum Abruf und zur Visualisierung von EU-Stromdaten mit Python-Backend und React-Frontend.

## Schnellstart

### Voraussetzungen
- Python 3.10 oder neuer
- Node.js 18 oder neuer
- ENTSOE API Key (in der Backend-Umgebungsdatei)

### 1. Backend einrichten und starten
```powershell
cd "EU-Stromdaten Tool/ENTSO-E Tool"
pip install -r requirements.txt
copy .env.example .env
```

Trage danach in der Datei .env mindestens ENTSOE_API_KEY ein (dein persoenlicher ENTSO-E API Key).

```powershell
uvicorn backend_api:app --reload --host 0.0.0.0 --port 8000
```

Backend laeuft dann unter: http://localhost:8000

### 2. Frontend einrichten und starten
In einem zweiten Terminal:

```powershell
cd "EU-Stromdaten Tool/ENTSO-E Tool/frontend"
npm install
copy .env.example .env
npm run dev
```

Frontend laeuft dann unter: http://localhost:5173

### 3. Tool im Browser oeffnen
Oeffne http://localhost:5173. Das Frontend ruft die Daten ueber das lokale Backend unter http://localhost:8000 ab.
