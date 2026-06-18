# 🌍 ENTSO-E API — Projektfortschritt

**Status:** Phase 1 (Konzept & Prototyp) ✅ | **Last Updated:** 24. Mai 2026

---

## 📋 Projektübersicht

**Ziel:** API + Dashboard zur Abfrage und Visualisierung von EU-Stromdaten (Erzeugung, Verbrauch, CO2-Intensität, Marktpreise).

**Team:** EU-Stromdaten Tool (Uni Weihenstephan, 6. Semester)

---

## ✅ Abgeschlossene Phasen

### Phase 1: Konzept & Grundlagen

#### 1️⃣ Scope & Ziele definieren ✓
- **Thema:** ENTSO-E API — EU-Stromdaten abrufen und visualisieren, mit optionalen GGC-Zusatzmetriken
- **Kernfunktionen:**
  - Echtzeit-Stromdaten sammeln (Erzeugung, Verbrauch, CO2, Preise)
  - Zeitreihen-Analyse & Aggregation
  - Interaktive Visualisierungen (Charts, Karten, Dashboards)
  - REST-API für Drittanwendungen
  - Embeddable Widgets

#### 2️⃣ Datenquellen identifizieren ✓
Folgende Quellen gelistet & evaluiert:
- **ENTSO-E Transparency Platform** (offiziell, umfassend; API-Key erforderlich)
- **electricityMap API** (CO2-Daten, einfacher Einstieg)
- **Open Power System Data (OPSD)** (historische Zeitreihen, CSV)
- **Nationale TSOs** (TenneT, Amprion, RTE, Red Eléctrica)
- **Energiebörsen** (Nord Pool, EPEX SPOT)

#### 3️⃣ Architektur skizzieren ✓
**Komponenten:**
```
External Sources (ENTSO-E, electricityMap, OPSD, TSO)
    ↓
Ingest Workers (scheduled, retries, rate-limit handling)
    ↓
ETL / Normalizer (XML/JSON/CSV → einheitliches Schema)
    ↓
TimescaleDB / InfluxDB (Zeitreihen-Speicherung)
    ↓
Backend API (FastAPI/Express) ← Cache (Redis)
    ↓
Frontend (React + D3/Plotly + Leaflet)
    ↓
Auth & API Gateway (Rate-limiting, API keys)
```

**Nicht-funktionale Anforderungen:**
- Latenz: Near-Realtime
- Skalierbarkeit: Horizontal für API + Workers
- Robustheit: Retry-Mechanismen, Datenlücken-Handling

#### 4️⃣ Visualisierungstypen auswählen ✓
**MVP-Visualisierungen (priorisiert):**
1. **Stacked Area Chart** — Erzeugungsmix über Zeit
2. **KPI-Tiles** — Live-Status (CO2 g/kWh, % erneuerbar, Preis)
3. **Choropleth-Karte** — Länderübersicht mit Farbcodierung
4. **Heatmap** — Tages-/Wochenmuster (Hour-of-Day vs. Day)

**Zusätzlich:**
- Donut/Pie Charts (Momentaufnahmen)
- Interactive Comparison (2 Länder / Zeiträume)
- Sankey-Diagramme (Energieflüsse)

#### 5️⃣ Prototyp / Implementierung (in Arbeit) ✓
**Erstellte Artefakte:**

| Datei | Beschreibung |
|-------|-------------|
| `data/sample_generation.csv` | Beispieldaten (8h Erzeugungsmix für DE) |
| `prototype/plot_generation.py` | Python-Skript: Plotly Stacked-Area-Chart |
| `prototype/requirements.txt` | Dependencies (pandas, plotly) |
| `prototype/stacked_area.html` | 📊 Ausgabe: Interaktives Chart |
| `prototype/README.md` | Setup & Ausführungsanleitung |

**Abhängigkeiten:**
```
pandas>=1.5.0
plotly>=5.0.0
```

**Ausführung (lokal getestet & funktioniert):**
```powershell
C:\Users\Seli6\miniconda3\python.exe -m pip install -r prototype\requirements.txt
C:\Users\Seli6\miniconda3\python.exe prototype\plot_generation.py
# Ausgabe: prototype\stacked_area.html (öffnet im Browser)
```

**Ergebnis:** ✅ Interaktives Stacked-Area-Chart mit Zoom, Pan, Legende-Toggle.

---

## 📊 Aktueller Stand

| Aufgabe | Status | Fortschritt |
|---------|--------|-------------|
| Scope & Ziele | ✅ Fertig | 100% |
| Datenquellen | ✅ Fertig | 100% |
| Architektur | ⚙️ In Arbeit | 80% |
| Visualisierungstypen | ⚙️ In Arbeit | 80% |
| Prototyp | ✅ Fertig | 100% |

**Gesamtfortschritt Phase 1:** 100% ✨

---

## 🚀 Nächste Schritte (Phase 2)

### Priorität 1: Live-Datenbeschaffung
- [ ] ENTSO-E API-Credentials beantragen
- [ ] electricityMap API testen
- [ ] Python-Fetcher schreiben (Retry-Logik, Backfill)
- [ ] Daten in TimescaleDB speichern

### Priorität 2: Backend-API
- [ ] FastAPI-Projekt scaffolden
- [ ] Endpoints: `/generation`, `/consumption`, `/co2`, `/prices`
- [ ] Auth & Rate-limiting (API keys)
- [ ] Redis-Caching für häufige Anfragen

### Priorität 3: Frontend-Dashboard
- [ ] React-App mit Plotly/D3-Integration
- [ ] Länderfilter, Zeitbereichsauswahl
- [ ] Choropleth-Karte (Leaflet)
- [ ] Embeddable Widgets

### Priorität 4: DevOps & Deployment
- [ ] Docker-Images (Fetcher, API, Frontend)
- [ ] GitHub Actions CI/CD
- [ ] Monitoring (Prometheus/Grafana)
- [ ] Dokumentation (OpenAPI/Swagger)

---

## 🛠️ Technologie-Stack

| Layer | Technologie |
|-------|------------|
| **Datenquellen** | ENTSO-E, electricityMap, OPSD, TSOs |
| **Daten-Ingest** | Python (Requests, APScheduler/Celery) |
| **ETL** | Pandas, custom normalizer |
| **Zeitreihenspeicher** | TimescaleDB (oder InfluxDB) |
| **Backend** | FastAPI (Python) oder Express (Node.js) |
| **Cache** | Redis |
| **Frontend** | React, Plotly, D3.js, Leaflet |
| **Auth** | API Keys, JWT (optional) |
| **Monitoring** | Prometheus, Grafana, ELK/Loki |
| **Deployment** | Docker, Docker-Compose, k8s (optional) |
| **CI/CD** | GitHub Actions |

---

## 📁 Projektstruktur

```
GreenGrid_Compas_API/
├── README.md                    # Hauptdokumentation
├── PROGRESS.md                  # 📄 Dieses Dokument
├── .github/
│   └── workflows/               # CI/CD Pipelines
├── data/
│   └── sample_generation.csv    # Beispieldaten
├── prototype/                   # MVP & Visualisierungen
│   ├── plot_generation.py
│   ├── requirements.txt
│   ├── stacked_area.html
│   └── README.md
├── src/                         # (kommend)
│   ├── fetcher/                 # Daten-Ingest
│   ├── api/                     # Backend-API
│   ├── db/                      # Datenbank-Schemas
│   └── utils/
├── frontend/                    # (kommend)
│   └── src/                     # React-App
├── docs/                        # Dokumentation
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── SETUP.md
├── docker-compose.yml           # (kommend)
└── .gitignore
```

---

## 📝 Notizen & Lessons Learned

1. **Python-Setup:** Miniconda mit Python 3.13.12 getestet & funktioniert.
2. **Plotly:** Einfache & mächtige Lösung für interaktive Charts (HTML-Export).
3. **Datenquellen-Recherche:** ENTSO-E ist der Goldstandard, benötigt aber API-Registrierung.
4. **Nextfire-Task:** Live-Fetcher + FastAPI-Boilerplate mit TimescaleDB-Schema.

---

## 👥 Kontakt & Ressourcen

- **GitHub Repo:** GreenGrid_Compas_API
- **Arbeitspfad:** `e:\StudiumWeihenstephan\6.Semester\Git\GreenGrid_Compas_API\`
- **Python-Env:** Miniconda3, Python 3.13.12

---

**Letzter Update:** 24.05.2026 | **Nächste Review:** Phase 2 Kickoff
