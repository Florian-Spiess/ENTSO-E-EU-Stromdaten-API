import { useEffect, useRef, useState } from 'react';

const DEFAULT_BACKEND = import.meta.env?.VITE_BACKEND_URL || 'http://127.0.0.1:9000';
const DEFAULT_ZONE = 'DE';
const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
const DEFAULT_START = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
const DEFAULT_END = new Date(today.getTime() + 23 * 60 * 60 * 1000).toISOString().slice(0, 16);
const STORAGE_PREFIX = 'ggc-dashboard';
const CONFIG_KEY = `${STORAGE_PREFIX}:config`;
const BOOKMARKS_KEY = `${STORAGE_PREFIX}:bookmarks`;
const CACHE_KEY = `${STORAGE_PREFIX}:snapshot`;
const API_KEY_KEY = `${STORAGE_PREFIX}:api-key`;

function normalizeBackendUrl(url) {
  if (!url) return DEFAULT_BACKEND;
  const trimmed = url.toString().trim().replace(/\/$/, '');
  if (trimmed === '/api' || trimmed === 'api') {
    return DEFAULT_BACKEND;
  }
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1):8000$/i.test(trimmed)) {
    return DEFAULT_BACKEND;
  }
  return trimmed;
}

function getTodayRange() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return {
    start: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    end: new Date(today.getTime() + 23 * 60 * 60 * 1000).toISOString().slice(0, 16),
  };
}

function isSameLocalDate(value, compareDate) {
  if (!value) return false;
  const date = new Date(value);
  return (
    date.getFullYear() === compareDate.getFullYear() &&
    date.getMonth() === compareDate.getMonth() &&
    date.getDate() === compareDate.getDate()
  );
}

function isSameWeekRange(startValue, endValue) {
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  return isSameLocalDate(startValue, sevenDaysAgo) && isSameLocalDate(endValue, today);
}

const plotlyAvailable = () => typeof window !== 'undefined' && window.Plotly;

function PlotlyChart({ points, title, yLabel, comparisonPoints, comparisonLabel }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!plotlyAvailable() || !chartRef.current) {
      return;
    }

    const traces = [];
    if (points?.length) {
      traces.push({
        x: points.map((item) => item.x),
        y: points.map((item) => item.y),
        mode: 'lines+markers',
        type: 'scatter',
        name: 'Aktueller Zeitraum',
        line: { shape: 'spline', color: '#1f3864' },
      });
    }

    if (comparisonPoints?.length) {
      traces.push({
        x: comparisonPoints.map((item) => item.x),
        y: comparisonPoints.map((item) => item.y),
        mode: 'lines+markers',
        type: 'scatter',
        name: comparisonLabel || 'Vergleichszeitraum',
        line: { shape: 'spline', color: '#f59e0b' },
      });
    }

    if (!traces.length) {
      return;
    }

    window.Plotly.newPlot(chartRef.current, traces, {
      title,
      xaxis: { title: 'Zeit' },
      yaxis: { title: yLabel },
      margin: { t: 50, l: 60, r: 20, b: 50 },
      legend: { orientation: 'h', yanchor: 'bottom', y: 1.02, xanchor: 'left', x: 0 },
    }, { responsive: true });

    return () => {
      if (window.Plotly && chartRef.current) {
        window.Plotly.purge(chartRef.current);
      }
    };
  }, [points, comparisonPoints, comparisonLabel, title, yLabel]);

  return <div ref={chartRef} className="chart-card" />;
}

function toApiIso(value) {
  if (!value) return '';
  const date = new Date(value);
  return date.toISOString();
}

function toInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function average(values) {
  if (!values?.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildComparisonSummary(currentSeries, compareSeries, label) {
  if (!currentSeries?.length || !compareSeries?.length) {
    return null;
  }

  const currentValues = currentSeries.map((item) => item.y);
  const compareValues = compareSeries.map((item) => item.y);
  const currentLatest = currentValues[currentValues.length - 1];
  const compareLatest = compareValues[compareValues.length - 1];

  return {
    label,
    latestDelta: currentLatest - compareLatest,
    averageDelta: average(currentValues) - average(compareValues),
  };
}

function readJsonStorage(key, fallback = null) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const storedValue = window.localStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
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
  const [backendUrl, setBackendUrl] = useState(normalizeBackendUrl(DEFAULT_BACKEND));
  const [apiKey, setApiKey] = useState('changeme');
  const [zone, setZone] = useState(DEFAULT_ZONE);
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [rememberApiKey, setRememberApiKey] = useState(false);
  const [status, setStatus] = useState('Bereit. Bitte Backend starten.');
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('co2_intensity');
  const [co2Data, setCo2Data] = useState([]);
  const [comparisonCo2Data, setComparisonCo2Data] = useState([]);
  const [renewableData, setRenewableData] = useState([]);
  const [comparisonRenewableData, setComparisonRenewableData] = useState([]);
  const [rawData, setRawData] = useState([]);
  const [dataLabel, setDataLabel] = useState('Rohdaten');
  const [refreshInterval, setRefreshInterval] = useState(60);
  const [refreshActive, setRefreshActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);
  const [comparisonEnabled, setComparisonEnabled] = useState(false);
  const [comparisonWindowHours, setComparisonWindowHours] = useState(24);
  const [comparisonSummary, setComparisonSummary] = useState(null);
  const [bookmarkName, setBookmarkName] = useState('');
  const [bookmarks, setBookmarks] = useState([]);
  const [cacheInfo, setCacheInfo] = useState(null);
  const refreshTimerRef = useRef(null);

  useEffect(() => {
    const storedConfig = readJsonStorage(CONFIG_KEY, null);
    const storedBookmarks = readJsonStorage(BOOKMARKS_KEY, []);
    const cachedSnapshot = readJsonStorage(CACHE_KEY, null);

    if (storedConfig) {
      const todayRange = getTodayRange();
      const storedStart = storedConfig.start || DEFAULT_START;
      const storedEnd = storedConfig.end || DEFAULT_END;
      const useToday = !isSameWeekRange(storedStart, storedEnd);

      setBackendUrl(normalizeBackendUrl(storedConfig.backendUrl || DEFAULT_BACKEND));
      setZone(storedConfig.zone || DEFAULT_ZONE);
      setStart(useToday ? todayRange.start : storedStart);
      setEnd(useToday ? todayRange.end : storedEnd);
      setRememberApiKey(Boolean(storedConfig.rememberApiKey));
    }

    if (Array.isArray(storedBookmarks)) {
      setBookmarks(storedBookmarks);
    }

    const storedApiKey = typeof window !== 'undefined' ? window.sessionStorage.getItem(API_KEY_KEY) : null;
    if (storedApiKey) {
      setApiKey(storedApiKey);
    }

    if (cachedSnapshot) {
      setCo2Data(cachedSnapshot.co2Data || []);
      setRenewableData(cachedSnapshot.renewableData || []);
      setRawData(cachedSnapshot.rawData || []);
      setDataLabel(cachedSnapshot.dataLabel || 'Cache');
      setLastFetch(cachedSnapshot.lastFetch || null);
      setCacheInfo(cachedSnapshot.cacheInfo || null);
    }

    loadMetricList(storedConfig?.backendUrl || DEFAULT_BACKEND);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const config = {
      backendUrl: normalizeBackendUrl(backendUrl),
      zone,
      start,
      end,
      rememberApiKey,
    };
    writeJsonStorage(CONFIG_KEY, config);

    if (rememberApiKey && apiKey) {
      window.sessionStorage.setItem(API_KEY_KEY, apiKey);
    } else {
      window.sessionStorage.removeItem(API_KEY_KEY);
    }
  }, [backendUrl, zone, start, end, rememberApiKey, apiKey]);

  const headers = apiKey ? { 'Content-Type': 'application/json', 'x-api-key': apiKey } : { 'Content-Type': 'application/json' };

  const fetchApi = async (path, targetBackendUrl = backendUrl) => {
    const normalizedUrl = normalizeBackendUrl(targetBackendUrl).replace(/\/$/, '');
    const response = await fetch(`${normalizedUrl}${path}`, { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return response.json();
  };

  const loadMetricList = async (targetBackendUrl = backendUrl) => {
    try {
      const result = await fetchApi('/ggc/metrics', targetBackendUrl);
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

  const persistSnapshot = (snapshot) => {
    writeJsonStorage(CACHE_KEY, snapshot);
    setCacheInfo(snapshot.cacheInfo || null);
  };

  const loadAllData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setStatus('Lade CO2-Intensität...');
      const currentStart = toApiIso(start);
      const currentEnd = toApiIso(end);
      const co2Records = await fetchApi(`/ggc/co2_intensity?zone=${encodeURIComponent(zone)}&start=${encodeURIComponent(currentStart)}&end=${encodeURIComponent(currentEnd)}`);
      const normalizedCo2 = normalizeSeries(co2Records);
      setCo2Data(normalizedCo2);

      let normalizedComparisonCo2 = [];
      let normalizedComparisonRenewable = [];
      let normalizedRenewable = [];
      let nextSummary = null;
      let currentRawData = [...co2Records];

      if (comparisonEnabled) {
        const duration = Number(comparisonWindowHours) * 60 * 60 * 1000;
        const previousEnd = new Date(start);
        const previousStart = new Date(previousEnd.getTime() - duration);
        const compareStart = toApiIso(previousStart);
        const compareEnd = toApiIso(previousEnd);

        setStatus('Lade Vergleichszeitraum...');
        const comparisonCo2Records = await fetchApi(`/ggc/co2_intensity?zone=${encodeURIComponent(zone)}&start=${encodeURIComponent(compareStart)}&end=${encodeURIComponent(compareEnd)}`);
        normalizedComparisonCo2 = normalizeSeries(comparisonCo2Records);
        setComparisonCo2Data(normalizedComparisonCo2);

        const renewableRecords = await fetchApi(`/ggc/renewable_share?zone=${encodeURIComponent(zone)}&start=${encodeURIComponent(currentStart)}&end=${encodeURIComponent(currentEnd)}`);
        const comparisonRenewableRecords = await fetchApi(`/ggc/renewable_share?zone=${encodeURIComponent(zone)}&start=${encodeURIComponent(compareStart)}&end=${encodeURIComponent(compareEnd)}`);
        normalizedRenewable = normalizeSeries(renewableRecords);
        normalizedComparisonRenewable = normalizeSeries(comparisonRenewableRecords);
        setRenewableData(normalizedRenewable);
        setComparisonRenewableData(normalizedComparisonRenewable);
        currentRawData = [...co2Records, ...renewableRecords];
        setComparisonSummary({
          co2: buildComparisonSummary(normalizedCo2, normalizedComparisonCo2, 'CO2-Intensität'),
          renewable: buildComparisonSummary(normalizedRenewable, normalizedComparisonRenewable, 'Erneuerbarer Anteil'),
        });
      } else {
        setStatus('Lade erneuerbare Anteile...');
        const renewableRecords = await fetchApi(`/ggc/renewable_share?zone=${encodeURIComponent(zone)}&start=${encodeURIComponent(currentStart)}&end=${encodeURIComponent(currentEnd)}`);
        normalizedRenewable = normalizeSeries(renewableRecords);
        setRenewableData(normalizedRenewable);
        setComparisonCo2Data([]);
        setComparisonRenewableData([]);
        setComparisonSummary(null);
        currentRawData = [...co2Records, ...renewableRecords];
      }

      setRawData(currentRawData);
      setDataLabel('Rohdaten (aktueller Zeitraum)');

      const fetchedAt = new Date().toLocaleString('de-DE');
      setLastFetch(fetchedAt);
      const snapshot = {
        co2Data: normalizedCo2,
        renewableData: normalizedRenewable,
        rawData: currentRawData,
        dataLabel: 'Rohdaten (aktueller Zeitraum)',
        lastFetch: fetchedAt,
        cacheInfo: { zone, start, end, comparisonEnabled, comparisonWindowHours, fetchedAt },
      };
      persistSnapshot(snapshot);
      setStatus(comparisonEnabled ? `Daten erfolgreich geladen. Vergleichszeitraum ${comparisonWindowHours}h aktiv.` : 'Daten erfolgreich geladen.');
    } catch (error) {
      const cachedSnapshot = readJsonStorage(CACHE_KEY, null);
      if (cachedSnapshot) {
        setCo2Data(cachedSnapshot.co2Data || []);
        setRenewableData(cachedSnapshot.renewableData || []);
        setRawData(cachedSnapshot.rawData || []);
        setDataLabel(cachedSnapshot.dataLabel || 'Cache');
        setLastFetch(cachedSnapshot.lastFetch || null);
        setStatus('Backend nicht erreichbar. Offline-Cache wird verwendet.');
      } else {
        setError(error.message);
        setStatus('Fehler beim Laden der Daten.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadUnifiedData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setStatus('Lade vereinheitlichte Daten...');
      const unifiedRecords = await fetchApi(`/unified?zone=${encodeURIComponent(zone)}&start=${encodeURIComponent(toApiIso(start))}&end=${encodeURIComponent(toApiIso(end))}`);
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
      const records = await fetchApi(`/ggc/${metric}?zone=${encodeURIComponent(zone)}&start=${encodeURIComponent(toApiIso(start))}&end=${encodeURIComponent(toApiIso(end))}`);
      setRawData(records);
      setDataLabel(`Rohdaten (${metric})`);
      setSelectedMetric(metric);
      setLastFetch(new Date().toLocaleString('de-DE'));
      setStatus(`Rohdaten geladen: ${records.length} Datensätze für ${metric}.`);
    } catch (error) {
      const cachedSnapshot = readJsonStorage(CACHE_KEY, null);
      if (cachedSnapshot?.rawData?.length) {
        setRawData(cachedSnapshot.rawData);
        setStatus('Rohdaten konnten nicht vom Backend geladen werden. Cache wird verwendet.');
      } else {
        setError(error.message);
        setStatus('Fehler beim Laden der Rohdaten.');
      }
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

    refreshTimerRef.current = setInterval(() => {
      loadAllData();
    }, Number(refreshInterval) * 1000);
    setRefreshActive(true);
    setStatus(`Auto-Refresh aktiv (${refreshInterval}s).`);
  };

  const saveBookmark = () => {
    if (!bookmarkName.trim()) {
      setStatus('Bitte einen Namen für das Lesezeichen eingeben.');
      return;
    }

    const nextBookmarks = [
      { id: Date.now(), name: bookmarkName.trim(), backendUrl, zone, start, end, apiKey: rememberApiKey ? apiKey : '', rememberApiKey },
      ...bookmarks,
    ].slice(0, 6);

    setBookmarks(nextBookmarks);
    writeJsonStorage(BOOKMARKS_KEY, nextBookmarks);
    setBookmarkName('');
    setStatus(`Lesezeichen gespeichert: ${bookmarkName.trim()}`);
  };

  const restoreBookmark = (bookmark) => {
    setBackendUrl(bookmark.backendUrl || DEFAULT_BACKEND);
    setZone(bookmark.zone || DEFAULT_ZONE);
    setStart(bookmark.start || DEFAULT_START);
    setEnd(bookmark.end || DEFAULT_END);
    setRememberApiKey(Boolean(bookmark.rememberApiKey));
    setApiKey(bookmark.apiKey || '');
    setStatus(`Lesezeichen geladen: ${bookmark.name}`);
  };

  const clearSavedSettings = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(API_KEY_KEY);
      window.localStorage.removeItem(CONFIG_KEY);
      window.localStorage.removeItem(BOOKMARKS_KEY);
      window.localStorage.removeItem(CACHE_KEY);
    }
    setApiKey('');
    setRememberApiKey(false);
    setBookmarks([]);
    setCacheInfo(null);
    setStatus('Gespeicherte Einstellungen entfernt.');
  };

  const latestCo2 = co2Data.length ? co2Data[co2Data.length - 1].y : null;
  const latestRenewable = renewableData.length ? renewableData[renewableData.length - 1].y : null;
  const rawCount = rawData.length;
  const rawDataSeries = normalizeSeries(rawData);

  return (
    <div className="app-shell">
      <header className="hero">
        <h1>Green Grid Compass React Dashboard</h1>
        <p>Live-Daten-Frontend für das Phase-3-Backend mit Vergleich, Cache und Lesezeichen.</p>
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
              <input type="datetime-local" value={toInputValue(start)} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label>
              Endzeitpunkt
              <input type="datetime-local" value={toInputValue(end)} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>
          <div className="action-row">
            <button type="button" onClick={loadAllData} disabled={isLoading}>Daten laden</button>
            <button type="button" onClick={loadUnifiedData} disabled={isLoading}>Unified laden</button>
            <button type="button" onClick={toggleAutoRefresh} disabled={isLoading && !refreshActive}>{refreshActive ? 'Auto-Refresh stoppen' : 'Auto-Refresh starten'}</button>
            <button type="button" className="secondary" onClick={clearSavedSettings}>Gespeicherte Daten löschen</button>
          </div>
          <div className="grid compact-grid">
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
            <label>
              Vergleichsfenster (Stunden)
              <input type="number" min="1" value={comparisonWindowHours} onChange={(e) => setComparisonWindowHours(e.target.value)} disabled={isLoading} />
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={comparisonEnabled} onChange={(e) => setComparisonEnabled(e.target.checked)} />
              Historischen Vergleich aktivieren
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={rememberApiKey} onChange={(e) => setRememberApiKey(e.target.checked)} />
              API-Key nur für diese Sitzung speichern
            </label>
            <div className="metric-list">
              <strong>Unterstützte Metriken</strong>
              <p>{metrics.length ? metrics.map((item) => item.metric).join(', ') : 'Lade...'}</p>
            </div>
          </div>

          <div className="grid compact-grid">
            <label>
              Lesezeichen-Name
              <input value={bookmarkName} onChange={(e) => setBookmarkName(e.target.value)} placeholder="z. B. Team-Übersicht" />
            </label>
            <div className="bookmark-box">
              <button type="button" onClick={saveBookmark} disabled={isLoading}>Aktuelle Ansicht speichern</button>
              <p>Die aktuelle Konfiguration, Zone und Zeitraum werden als Lesezeichen festgehalten.</p>
            </div>
          </div>
          {bookmarks.length > 0 && (
            <div className="bookmark-list">
              <strong>Gespeicherte Lesezeichen</strong>
              <div className="action-row">
                {bookmarks.map((bookmark) => (
                  <button type="button" key={bookmark.id} className="secondary" onClick={() => restoreBookmark(bookmark)}>
                    {bookmark.name}
                  </button>
                ))}
              </div>
            </div>
          )}

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

          {comparisonSummary && (
            <div className="comparison-card">
              <h3>Historische Vergleiche</h3>
              <p><strong>CO2:</strong> Δ letzter Wert {comparisonSummary.co2?.latestDelta?.toFixed(1) || '—'} • Δ Mittelwert {comparisonSummary.co2?.averageDelta?.toFixed(1) || '—'}</p>
              <p><strong>Erneuerbar:</strong> Δ letzter Wert {comparisonSummary.renewable?.latestDelta?.toFixed(1) || '—'} • Δ Mittelwert {comparisonSummary.renewable?.averageDelta?.toFixed(1) || '—'}</p>
            </div>
          )}

          {cacheInfo && (
            <div className="cache-card">
              <strong>Cache-Status:</strong> Letzter Abruf {cacheInfo.fetchedAt} für {cacheInfo.zone} / {cacheInfo.start} bis {cacheInfo.end}
            </div>
          )}

          <div className={`status ${error ? 'error' : ''}`}>{status}</div>
          <p className="hint">Hinweis: API-Schlüssel werden nicht dauerhaft gespeichert, sondern nur optional für die aktuelle Sitzung hinterlegt.</p>
        </section>

        <section className="panel charts">
          <PlotlyChart points={co2Data} comparisonPoints={comparisonCo2Data} comparisonLabel={`Vorheriger ${comparisonWindowHours}h-Zeitraum`} title="CO2-Intensität" yLabel="gCO2eq/kWh" />
          <PlotlyChart points={renewableData} comparisonPoints={comparisonRenewableData} comparisonLabel={`Vorheriger ${comparisonWindowHours}h-Zeitraum`} title="Erneuerbarer Anteil" yLabel="%" />
        </section>

        <section className="panel charts">
          <PlotlyChart points={rawDataSeries} title={dataLabel} yLabel="Wert" />
        </section>

        <section className="panel">
          <h2>{dataLabel}</h2>
          <p className="status" style={{ marginTop: 0, color: '#475569' }}>Aktuelle Tabelle: {dataLabel}</p>
          <div className="action-row">
            <button type="button" onClick={() => loadRawData(selectedMetric)} disabled={isLoading || !selectedMetric}>Rohdaten laden</button>
            <button type="button" onClick={() => loadRawData('co2_intensity')} disabled={isLoading}>CO2-Rohdaten</button>
            <button type="button" onClick={() => loadRawData('renewable_share')} disabled={isLoading}>Erneuerbare Rohdaten</button>
          </div>
          <div className="data-table">{buildTable(rawData)}</div>
        </section>
      </main>
    </div>
  );
}
