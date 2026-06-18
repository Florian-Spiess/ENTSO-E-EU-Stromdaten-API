# Progress Phase 2

**Status: Phase 2 abgeschlossen** ✅

## Ziel
Phase 2 des Projekts ist die Umsetzung eines Live-Fetchers mit ENTSO-E als primärer Datenquelle und optionalen Green-Grid-Compass-Zusatzmetriken. Das Ziel ist ein wiederverwendbarer Python-Prototyp, der die ENTSO-E-API für die Standarddaten nutzt und GGC nur bei Bedarf ergänzt.

## Umsetzung
- Neue Datei erstellt: `EU-Stromdaten Tool/prototype/ggc_data_fetcher.py`
- ENTSO-E-Fetcher: `EU-Stromdaten Tool/prototype/entsoe_data_fetcher.py`
- Die Implementierung basiert auf:
   - ENTSO-E API als Primärquelle für Erzeugungsdaten
   - Green Grid Compass als optionale Zusatzquelle für CO2- und Anteilsmetriken
   - JSON-Parsing für GGC-Antworten
   - CSV-Ausgabe in `EU-Stromdaten Tool/data/ggc_co2_intensity_live_sample.csv`

## Was wurde realisiert
- `fetch_entsoe_generation(...)` baut den primären API-Request an ENTSO-E auf
- `fetch_ggc_data(...)`, `fetch_co2_intensity(...)` und `fetch_renewable_share(...)` bleiben als optionale Zusatzpfade erhalten
- `prototype/requirements.txt` wurde um `requests` ergänzt

## Bedienung
1. ENTSO-E-Zugangsdaten prüfen und `ENTSOE_API_KEY` setzen
2. Für optionale GGC-Zusatzmetriken den API-Zugriff konfigurieren:
   ```powershell
   $env:GGC_API_BASE_URL = "https://api.greengridcompass.eu"
   $env:GGC_API_KEY = "dein_token"
   ```
3. Für OAuth2 Client-Credentials setzen:
   ```powershell
   $env:GGC_API_BASE_URL = "https://api.greengridcompass.eu"
   $env:GGC_OAUTH_TOKEN_URL = "https://signin.energy/am/oauth2/realms/root/realms/difesp/access_token"
   $env:GGC_CLIENT_ID = "esp_SelinaHeinITProjektaAnSenf_001"
   $env:GGC_CLIENT_SECRET = "dein_secret"
   $env:GGC_SCOPE = "esp"
   ```
4. Das Backend startet dann mit ENTSO-E als Standardquelle:
   ```powershell
   $env:ENTSOE_API_KEY = "<dein_entsoe_token>"
   ```
   > Hinweis: Der ENTSO-E-Token ist vorhanden und sollte lokal als Umgebungsvariable gesetzt werden. Er darf nicht in den Code oder das Repository eingecheckt werden.
5. Im Projektverzeichnis ausführen:
   ```powershell
   python EU-Stromdaten Tool\prototype\ggc_data_fetcher.py
   ```
6. Backend starten:
   ```powershell
   uvicorn EU-Stromdaten Tool.prototype.backend_api:app --reload --host 0.0.0.0 --port 8000
   ```
7. Optionalen täglichen Abruf ausführen:
   ```powershell
   python EU-Stromdaten Tool\prototype\daily_data_sync.py
   ```

### Windows Task Scheduler Beispiel
1. Öffne den Taskplaner (Task Scheduler).
2. Erstelle eine neue Aufgabe und setze sie auf "Täglich".
3. Wähle als Aktion „Programm starten" und verwende:
   - Programm/Skript: `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`
   - Argumente:
     ```powershell
   -NoProfile -WindowStyle Hidden -Command "Set-Item -Path Env:GGC_API_BASE_URL -Value 'https://api.greengridcompass.eu'; Set-Item -Path Env:GGC_OAUTH_TOKEN_URL -Value 'https://signin.energy/am/oauth2/realms/root/realms/difesp/access_token'; Set-Item -Path Env:GGC_CLIENT_ID -Value 'esp_SelinaHeinITProjektaAnSenf_001'; Set-Item -Path Env:GGC_CLIENT_SECRET -Value '<dein_secret>'; Set-Item -Path Env:GGC_SCOPE -Value 'esp'; Set-Item -Path Env:ENTSOE_API_KEY -Value '<dein_entsoe_token>'; & 'C:\Users\<dein_user>\e\StudiumWeihenstephan\6.Semester\Git\GreenGrid_Compas_API\EU-Stromdaten Tool\prototype\daily_data_sync.py'"
     ```
4. Stelle sicher, dass die Aufgabe mit einem Konto ausgeführt wird, das Zugriff auf die Projektdateien hat.
5. Teste die Aufgabe einmal manuell im Taskplaner.

## Ergebnisse
- Phase 2 wird durch einen ENTSO-E-first Live-Fetcher realisiert
- GGC steht als optionale Quelle für Zusatzmetriken bereit
- Eine einheitliche Pipeline für ENTSO-E-Primärdaten und optionale GGC-Zusatzdaten wurde implementiert
- Weiteres Daten-Cleaning für Zeitzonen und Status-/Revision-Informationen wurde ergänzt
- Backend besitzt optionalen API-Key-Schutz und Rate-Limit-Handling für schützbare Endpunkte
- Daten werden bei Erfolg als CSV abgelegt
- Diese Basis ist ideal für Phase 3 (FastAPI-Backend) und Phase 4 (Dashboard)

## Green Grid Compass Interface
- TraXes-API-Dokumentation für Green Grid Compass identifiziert
- Green Grid Compass ist als optionale Zusatzquelle für CO2-Intensität und erneuerbare Anteile verfügbar
- ENTSO-E liefert die primären Erzeugungsdaten, GGC ergänzt bei Bedarf
- Relevante Pfade:
  - `GET /v1/ping`
  - `GET /v1/co2-intensity`
  - `GET /v1/co2-intensity-forecast`
  - `GET /v1/renewable-share`
  - `GET /v1/renewable-share-forecast`
  - `GET /v1/fossil-share`
  - `GET /v1/nuclear-share`
  - `GET /v1/co2-emissions`
  - `GET /v1/power`
  - `GET /v1/co2-intensity-rank`
  - `GET /v1/renewable-share-rank`
- Skripte erstellt: `EU-Stromdaten Tool/prototype/ggc_data_fetcher.py`, `EU-Stromdaten Tool/prototype/entsoe_data_fetcher.py`, `EU-Stromdaten Tool/prototype/unified_data_pipeline.py`, `EU-Stromdaten Tool/prototype/backend_api.py`, `EU-Stromdaten Tool/prototype/daily_data_sync.py`
- Environment-Variablen:
  - `GGC_API_BASE_URL`
  - `GGC_API_KEY` (wenn verfügbar)
  - `GGC_API_AUTH_TYPE` (default: `Bearer`)
  - `GGC_OAUTH_TOKEN_URL` (für OAuth2 / client_credentials)
  - `GGC_CLIENT_ID`
  - `GGC_CLIENT_SECRET`
  - `GGC_SCOPE` (default: `esp`)
  - `ENTSOE_API_KEY`
  - `BACKEND_API_KEY` (optional; aktiviert Backend-Schutz)
- Ausgabe-Samples:
  - `EU-Stromdaten Tool/data/ggc_co2_intensity_live_sample.csv`
  - `EU-Stromdaten Tool/data/entsoe_generation_live_sample.csv`
  - `EU-Stromdaten Tool/data/unified_energy_data.csv`
- Neue Backend-API: `EU-Stromdaten Tool/prototype/backend_api.py` mit Endpunkten für `ping`, `ggc/co2-intensity`, `ggc/renewable-share`, `entsoe/generation` und `unified`
- Scheduler-Wrapper: `EU-Stromdaten Tool/prototype/daily_data_sync.py` zur täglichen Ausführung des Pipeline-Skripts

## Nächste Schritte
1. Scheduler / Backfill einbauen (CLI-Backfill in `unified_data_pipeline.py` bereits vorbereitet)
2. Etablierung eines einheitlichen Schemas für alle Quellen (Standardspalten definiert)
3. API-Endpoint im Backend implementieren ✅
4. Authentifikation & Rate-Limit-Handling ergänzen ✅
5. Weiteres Daten-Cleaning für Zeitzonen und Revisionen ✅
