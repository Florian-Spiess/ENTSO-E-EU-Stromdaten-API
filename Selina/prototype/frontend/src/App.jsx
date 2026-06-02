import { useEffect, useRef, useState } from 'react';

const DEFAULT_BACKEND = 'http://localhost:8000';
const DEFAULT_ZONE = 'DE';
const DEFAULT_START = '2026-06-01T00:00';
const DEFAULT_END = '2026-06-01T23:00';

const plotlyAvailable = () => typeof window !== 'undefined' && window.Plotly;

function PlotlyChart({ points, title, yLabel }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!plotlyAvailable() || !points?.length) {
      return;
    }

    window.Plotly.newPlot(
      chartRef.current,
      [
        {
          x: points.map((item) => item.x),
          y: points.map((item) => item.y),
          mode: 'lines+markers',
          type: 'scatter',
          line: { shape: 'spline', color: '#1f3864' },
        },
      ],
      {
        title,
        xaxis: { title: 'Zeit' },
        yaxis: { title: yLabel },
        margin: { t: 50, l: 60, r: 20, b: 50 },
      },
      { responsive: true }
    );
  }, [points, title, yLabel]);

  return <div ref={chartRef} className="chart-card" />;
}

function formatIsoLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  return date.toISOString();
}

function buildTable(records) {
  if (!records?.length) {
    return <p>Keine Rohdaten vorhanden.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>timestamp</th>
          <th>zone</th>
          <th>metric</th>
          <th>value</th>
          <th>unit</th>
        </tr>
      </thead>
      <tbody>
        {records.slice(0, 50).map((row, index) => (
          <tr key={index}>
            <td>{row.timestamp}</td>
            <td>{row.zone || ''}</td>
            <td>{row.metric || ''}</td>
            <td>{row.value}</td>
            <td>{row.unit || ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function App() {
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND);
  const [apiKey, setApiKey] = useState('');
  const [zone, setZone] = useState(DEFAULT_ZONE);
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [status, setStatus] = useState('Bereit. Bitte Backend starten.');
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('co2_intensity');
  const [co2Data, setCo2Data] = useState([]);
  const [renewableData, setRenewableData] = useState([]);
  const [rawData, setRawData] = useState([]);
  const [dataLabel, setDataLabel] = useState('Rohdaten');
  const [refreshInterval, setRefreshInterval] = useState(60);
  const [refreshActive, setRefreshActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);
  const refreshTimerRef = useRef(null);

  useEffect(() => {
    loadMetricList();
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [backendUrl]);

  const headers = apiKey ? { 'Content-Type': 'application/json', 'x-api-key': apiKey } : { 'Content-Type': 'application/json' };

  const fetchApi = async (path) => {
    const normalizedUrl = backendUrl.replace(/\/$/, '');
    const response = await fetch(`${normalizedUrl}${path}`, { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return response.json();
  };

  const loadMetricList = async () => {
    try {
      const result = await fetchApi('/ggc/metrics');
      setMetrics(result);
      if (result.length && !result.some((item) => item.metric === selectedMetric)) {
        setSelectedMetric(result[0].metric);
      }
    } catch (error) {
      setError(error.message);
      setStatus('Metrikliste konnte nicht geladen werden.');
    }
  };

  const normalizeSeries = (records) =>
    records
      .map((row) => ({ x: new Date(row.timestamp), y: Number(row.value) }))
      .sort((a, b) => a.x - b.x);

  const loadAllData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setStatus('Lade CO2-Intensität...');
      const co2Records = await fetchApi(`/ggc/co2_intensity?zone=${encodeURIComponent(zone)}&start=${encodeURIComponent(formatIsoLocal(start))}&end=${encodeURIComponent(formatIsoLocal(end))}`);
      setCo2Data(normalizeSeries(co2Records));

      setStatus('Lade erneuerbare Anteile...');
      const renewableRecords = await fetchApi(`/ggc/renewable_share?zone=${encodeURIComponent(zone)}&start=${encodeURIComponent(formatIsoLocal(start))}&end=${encodeURIComponent(formatIsoLocal(end))}`);
      setRenewableData(normalizeSeries(renewableRecords));

      const fetchedAt = new Date().toLocaleString('de-DE');
      setLastFetch(fetchedAt);
      setStatus('Daten erfolgreich geladen.');
    } catch (error) {
      setError(error.message);
      setStatus('Fehler beim Laden der Daten.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUnifiedData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setStatus('Lade vereinheitlichte Daten...');
      const unifiedRecords = await fetchApi(`/unified?zone=${encodeURIComponent(zone)}&start=${encodeURIComponent(formatIsoLocal(start))}&end=${encodeURIComponent(formatIsoLocal(end))}`);
      setRawData(unifiedRecords);
      setDataLabel('Unified-Daten');
      setLastFetch(new Date().toLocaleString('de-DE'));
      setStatus(`Unified-Daten geladen: ${unifiedRecords.length} Datensätze.`);
    } catch (error) {
      setError(error.message);
      setStatus('Fehler beim Laden der einheitlichen Daten.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRawData = async (metric) => {
    setIsLoading(true);
    setError(null);
    try {
      setStatus(`Lade Rohdaten für ${metric}...`);
      const records = await fetchApi(`/ggc/${metric}?zone=${encodeURIComponent(zone)}&start=${encodeURIComponent(formatIsoLocal(start))}&end=${encodeURIComponent(formatIsoLocal(end))}`);
      setRawData(records);
      setDataLabel(`Rohdaten (${metric})`);
      setSelectedMetric(metric);
      setLastFetch(new Date().toLocaleString('de-DE'));
      setStatus(`Rohdaten geladen: ${records.length} Datensätze für ${metric}.`);
    } catch (error) {
      setError(error.message);
      setStatus('Fehler beim Laden der Rohdaten.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAutoRefresh = () => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
      setRefreshActive(false);
      setStatus('Auto-Refresh gestoppt.');
      return;
    }

    refreshTimerRef.current = setInterval(loadAllData, Number(refreshInterval) * 1000);
    setRefreshActive(true);
    setStatus(`Auto-Refresh aktiv (${refreshInterval}s).`);
  };

  const latestCo2 = co2Data.length ? co2Data[co2Data.length - 1].y : null;
  const latestRenewable = renewableData.length ? renewableData[renewableData.length - 1].y : null;
  const rawCount = rawData.length;

  return (
    <div className="app-shell">
      <header className="hero">
        <h1>Green Grid Compass React Dashboard</h1>
        <p>Live-Daten-Frontend für das Phase-3-Backend.</p>
      </header>
      <main>
        <section className="panel">
          <h2>Dashboard-Konfiguration</h2>
          <div className="grid">
            <label>
              Backend-URL
              <input value={backendUrl} onChange={(e) => setBackendUrl(e.target.value)} />
            </label>
            <label>
              Backend API-Key
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Optional" />
            </label>
            <label>
              Zone
              <input value={zone} onChange={(e) => setZone(e.target.value)} />
            </label>
            <label>
              Startzeitpunkt
              <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label>
              Endzeitpunkt
              <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>
          <div className="action-row">
            <button onClick={loadAllData} disabled={isLoading}>Daten laden</button>
            <button onClick={loadUnifiedData} disabled={isLoading}>Unified laden</button>
            <button onClick={toggleAutoRefresh} disabled={isLoading && !refreshActive}>{refreshActive ? 'Auto-Refresh stoppen' : 'Auto-Refresh starten'}</button>
          </div>
          <div className="grid">
            <label>
              Refresh-Intervall (Sekunden)
              <input type="number" min="10" value={refreshInterval} onChange={(e) => setRefreshInterval(e.target.value)} disabled={isLoading} />
            </label>
            <label>
              Rohdaten-Metrik
              <select value={selectedMetric} onChange={(e) => setSelectedMetric(e.target.value)} disabled={isLoading || !metrics.length}>
                {metrics.length ? metrics.map((item) => (
                  <option key={item.metric} value={item.metric}>{item.metric}</option>
                )) : <option value="">Lade...</option>}
              </select>
            </label>
            <div className="metric-list">
              <strong>Unterstützte Metriken</strong>
              <p>{metrics.length ? metrics.map((item) => item.metric).join(', ') : 'Lade...'}</p>
            </div>
          </div>

          <div className="kpi-row">
            <div className="kpi-card">
              <span>Letzte CO2-Intensität</span>
              <strong>{latestCo2 !== null ? `${latestCo2.toFixed(1)} gCO2eq/kWh` : '—'}</strong>
            </div>
            <div className="kpi-card">
              <span>Letzter erneuerbarer Anteil</span>
              <strong>{latestRenewable !== null ? `${latestRenewable.toFixed(1)} %` : '—'}</strong>
            </div>
            <div className="kpi-card">
              <span>Aktuelle Rohdaten</span>
              <strong>{rawCount}</strong>
            </div>
            <div className="kpi-card">
              <span>Letzter Abruf</span>
              <strong>{lastFetch || '—'}</strong>
            </div>
          </div>

          <div className={`status ${error ? 'error' : ''}`}>{status}</div>
        </section>

        <section className="panel charts">
          <PlotlyChart points={co2Data} title="CO2-Intensität" yLabel="gCO2eq/kWh" />
          <PlotlyChart points={renewableData} title="Erneuerbarer Anteil" yLabel="%" />
        </section>

        <section className="panel">
          <h2>{dataLabel}</h2>
          <p className="status" style={{ marginTop: 0, color: '#475569' }}>Aktuelle Tabelle: {dataLabel}</p>
          <div className="action-row">
            <button onClick={() => loadRawData(selectedMetric)} disabled={isLoading || !selectedMetric}>Rohdaten laden</button>
            <button onClick={() => loadRawData('co2_intensity')} disabled={isLoading}>CO2-Rohdaten</button>
            <button onClick={() => loadRawData('renewable_share')} disabled={isLoading}>Erneuerbare Rohdaten</button>
          </div>
          <div className="data-table">{buildTable(rawData)}</div>
        </section>
      </main>
    </div>
  );
}
