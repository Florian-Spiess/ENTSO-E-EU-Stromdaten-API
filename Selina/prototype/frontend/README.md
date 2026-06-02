# Green Grid Compass React Dashboard

Dieses Projekt ist der React-Frontend-Prototyp für Phase 4 des Green Grid Compass-Projekts.

## Einrichtung

1. Wechsel in das Frontend-Verzeichnis:
   ```powershell
   cd Selina\prototype\frontend
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
- Falls `BACKEND_API_KEY` im Backend aktiviert ist, muss er im UI eingetragen werden.
- Die Seite nutzt Plotly über ein CDN für die Chart-Darstellung.
- Das frühere statische Prototyp-Dashboard wurde nach `Selina/prototype/dashboard.static.html` verschoben und ist nur noch als Referenz vorhanden.
