# Progress Phase 3

**Status: Phase 3 abgeschlossen** ✅

## Ziel
Phase 3 des Green Grid Compass-Projekts ist die Umsetzung eines produktionsnahen FastAPI-Backends. Dieses Backend stellt GGC-Daten und ENTSO-E-Fallbackdaten als REST-API zur Verfügung, bietet Health-Checks, eine Metrik-Liste und eine einheitliche Zugriffsoberfläche für Frontend/Dashboard-Clients.

## Umsetzung
- `Selina/prototype/backend.py` wurde erweitert auf Phase 3
- Das Backend stellt nun folgende Endpunkte bereit:
  - `/` - zentrale Service-Info
  - `/health` - Gesundheitsstatus mit aktuellem Zeitstempel
  - `/ggc/metrics` - Liste der unterstützten GGC-Metriken
  - `/ggc/{metric}` - generischer Endpunkt für GGC-Daten
  - `/ggc/co2-intensity` - expliziter CO2-Intensitäts-Endpunkt
  - `/ggc/renewable-share` - expliziter erneuerbarer Anteil
  - `/entsoe/generation` - ENTSO-E-Fallback für Erzeugungsdaten
  - `/unified` - vereinheitlichte Daten von GGC und optional ENTSO-E

- `Selina/prototype/ggc_fetcher.py` wurde erweitert:
  - Generischer `fetch_ggc_metric(...)`-Zugriff für mehrere Kennzahlen
  - Unterstützte Metriken: `co2_intensity`, `renewable_share`, `co2_emissions`, `power`
  - Forecast-API-Pfade vorbereitet (`co2_intensity_forecast`, `renewable_share_forecast`)

## Technischer Stand
- API basiert auf FastAPI, mit `slowapi` für Rate-Limiting
- Optionaler `BACKEND_API_KEY` schützt Endpunkte
- Zeitbereichsvalidierung per ISO-Format umgesetzt
- OpenAPI-Dokumentation wird automatisch über `/docs` verfügbar sein

## Environment-Variablen
- `GGC_API_BASE_URL`
- `GGC_API_KEY`
- `GGC_OAUTH_TOKEN_URL`
- `GGC_CLIENT_ID`
- `GGC_CLIENT_SECRET`
- `GGC_SCOPE`
- `ENTSOE_API_KEY`
- `BACKEND_API_KEY`

## Ausführung
```powershell
uvicorn Selina.prototype.backend:app --reload --host 0.0.0.0 --port 8000
```

Beispielaufrufe:
```powershell
Invoke-WebRequest "http://localhost:8000/ggc/metrics"
Invoke-WebRequest "http://localhost:8000/ggc/co2_intensity?zone=DE&start=2026-06-01T00:00:00&end=2026-06-01T23:00:00"
Invoke-WebRequest "http://localhost:8000/unified?zone=DE&start=2026-06-01T00:00:00&end=2026-06-01T23:00:00&include_entsoe=true"
```

## Ergebnisse
- Backend-Endpunkte sind jetzt mit optionaler `BACKEND_API_KEY`-Absicherung geschützt.
- Alle limitierten FastAPI-Endpunkte wurden auf SlowAPI-kompatible Signaturen angepasst.
- Tests mit `FastAPI TestClient` bestätigten:
  - `401` ohne gültigen API-Key
  - `200` für `/`, `/health` und `/ggc/metrics` mit gültigem Key
  - `400` für GGC- und ENTSO-E-Endpunkte bei fehlender Zielkonfiguration (erwartetes Verhalten ohne API-Keys/Token)
- Backend-Testskript: `Selina/prototype/test_backend.py`
- `Selina/prototype/requirements.txt` wurde um `httpx2` ergänzt, damit FastAPI TestClient funktioniert

## Nächste Schritte
1. Phase 4 starten: React-Dashboard mit Live-API-Anbindung
2. Optional: Caching (Redis) und persistente Timeseries-Datenbank hinzufügen
3. Alerting / KPI-Endpunkte für CO2-Spitzen und erneuerbare Anteile ergänzen
4. Production-Hardening: HTTPS, Logging, Monitoring
