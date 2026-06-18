# ENTSO-E React Dashboard

Dieses Projekt ist der React-Frontend-Prototyp für ein ENTSO-E-zentriertes Dashboard mit optionalen Green-Grid-Compass-Zusatzmetriken.

## Einrichtung

1. Wechsel in das Frontend-Verzeichnis:
   ```powershell
   cd EU-Stromdaten Tool\prototype\frontend
   ```
2. Abhängigkeiten installieren:
   ```powershell
   npm install
   ```

## Entwicklung starten

```powershell
npm run dev
```

Danach das lokale Frontend im Browser öffnen, meist unter `http://localhost:5173`.

## Hinweise

- Das Frontend kommuniziert mit dem Phase-3-Backend unter der konfigurierbaren `Backend-URL`.
- Für produktive Deployment-Umgebungen sollte `VITE_BACKEND_URL` gesetzt werden, statt die URL im Browser permanent zu pflegen.
- Falls `BACKEND_API_KEY` im Backend aktiviert ist, muss er im UI eingetragen werden. Für sensible Deployments sollte der Schlüssel serverseitig verwaltet und nicht dauerhaft im Frontend gespeichert werden.
- Die Seite nutzt Plotly über ein CDN für die Chart-Darstellung.
- Das frühere statische Prototyp-Dashboard wurde nach `EU-Stromdaten Tool/prototype/dashboard.static.html` verschoben und ist nur noch als Referenz vorhanden.

## Umgebungsvariablen

Kopiere `.env.example` nach `.env` und passe die Werte an:

```powershell
Copy-Item .env.example .env
```

Beispielwerte:
- `VITE_BACKEND_URL=http://localhost:8000` oder `VITE_BACKEND_URL=/api`

## CI/CD und Deployment

Für die produktionsnahe Auslieferung ist ein einfacher Build-Workflow vorbereitet. Dieser läuft bei Push und Pull Requests auf das Frontend und prüft den Build mit:

```powershell
npm install
npm run build
```

Die Pipeline ist in [.github/workflows/frontend-ci.yml](.github/workflows/frontend-ci.yml) hinterlegt. Für eine echte Veröffentlichung sollten danach noch Secrets für Backend-URLs und API-Keys in der Hosting-Plattform hinterlegt werden.
