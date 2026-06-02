# Progress Phase 4

**Status: Phase 4 weitgehend abgeschlossen**

## Ziel
Phase 4 ist die Umsetzung eines ersten Frontend-Dashboards für das Green Grid Compass-Projekt. Ziel ist ein nutzerfreundliches Interface, das die Phase-3-API nutzt, Live-Daten visualisiert und den Übergang zu einem React-Dashboard vorbereitet.

## Umsetzung
- Neues Dashboard-Prototypen-Frontend in `Selina/prototype/dashboard.static.html` (archiviert)
- Das Frontend nutzt die Phase-3-API-Endpunkte:
  - `/ggc/metrics`
  - `/ggc/co2_intensity`
  - `/ggc/renewable-share`
  - optional: `/unified`
- Visualisierung mit Plotly über CDN
- UI-Komponenten:
  - API-Key-Feld
  - Basis-URL-Feld
  - Zone-Auswahl
  - Start-/Endzeitraum
  - Auto-Refresh / Polling
  - Unterstützte Metriken-Darstellung
  - Rohdaten-Tabellen
  - Dashboard-Status und Fehlerausgabe

## Ergebnis
- Dashboard lädt Metriken von der API und zeigt zwei interaktive Charts:
  - CO2-Intensität
  - Erneuerbarer Anteil
- Neue Funktionen ergänzt:
  - Metrikliste aus `/ggc/metrics`
  - Rohdaten-Tabelle für `co2_intensity` und `renewable_share`
  - Auto-Refresh-Intervall
  - KPI-Zusammenfassung für die aktuellen Werte
  - Responsives Layout für mobile und größere Ansichten
- Das statische HTML-Dashboard wurde in `Selina/prototype/dashboard.static.html` archiviert, während das React-Frontend nun die aktive Benutzeroberfläche bildet.
- React übernimmt jetzt die wichtigsten Live-Interaktionen des Prototyps, inklusive getrenntem Rohdaten- und Unified-Datenmodus.
- Ein React-Frontend-Projekt wurde in `Selina/prototype/frontend` erstellt und enthält jetzt:
  - Konfiguration für Backend-URL und API-Key
  - Live-Charts mit Plotly
  - KPI-Karten
  - Tabellenansicht für Rohdaten
  - auswählbare Rohdaten-Metrik und Ladezustandssteuerung
  - Auto-Refresh mit konfigurierbarem Intervall
  - Status- und Fehleranzeige mit rotem Fehlerzustand
- Phase-3-API wird weiterhin als Datenlieferant genutzt, sodass das Dashboard direkt auf das Backend aufsetzt.

## Nutzung
1. Backend starten:
   ```powershell
   uvicorn Selina.prototype.backend:app --reload --host 0.0.0.0 --port 8000
   ```
2. Ins React-Frontend wechseln:
   ```powershell
   cd Selina\prototype\frontend
   npm install
   npm run dev
   ```
3. Das React-Frontend im Browser öffnen (Standardport `5173`).
4. API-URL, Zone und Zeitraum konfigurieren.
5. Auf `Daten laden` klicken.

## Nächste Schritte
 - [ ] Mobile Ansicht und responsive Dashboard-Komponenten verfeinern
 - [ ] Historische Vergleiche und Zeitreihen-Vergleiche ergänzen
 - [ ] Sicheres Login / API-Key-Management im Frontend gestalten
 - [ ] Caching / Offline-Lesezeichen für häufige Abfragen prüfen
 - [ ] Produktionsfähige Frontend-Deployment-Pipeline definieren
