import { useEffect, useRef, useState } from 'react';

const DEFAULT_BACKEND = import.meta.env?.VITE_BACKEND_URL || 'http://127.0.0.1:9000';
const DEFAULT_ZONE = '10Y1001A1001A83F';
const DEFAULT_PARTNER_ZONE = '10YFR-RTE------C';
const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
const DEFAULT_START = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
const DEFAULT_END = new Date(today.getTime() + 23 * 60 * 60 * 1000).toISOString().slice(0, 16);
const STORAGE_PREFIX = 'entsoe-dashboard';
const CONFIG_VERSION = 2;
const CONFIG_KEY = `${STORAGE_PREFIX}:config`;
const BOOKMARKS_KEY = `${STORAGE_PREFIX}:bookmarks`;
const CACHE_KEY = `${STORAGE_PREFIX}:snapshot`;
const API_KEY_KEY = `${STORAGE_PREFIX}:api-key`;

function getDefaultUtcRange() {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return {
    start: start.toISOString().slice(0, 16),
    end: end.toISOString().slice(0, 16),
  };
}

const ENTSOE_DATASETS = {
  generation: { label: 'Erzeugung', unit: 'MW' },
  consumption: { label: 'Verbrauch', unit: 'MW' },
  flows: { label: 'Cross-Border-Flows', unit: 'MW' },
  prices: { label: 'Day-Ahead-Preise', unit: 'EUR/MWh' },
  installedCapacity: { label: 'Installierte Leistung', unit: 'MW' },
  generationPerPlant: { label: 'Erzeugung pro Anlage', unit: 'MW' },
};

const ENTSOE_DATASET_OPTIONS = Object.keys(ENTSOE_DATASETS).map((metric) => ({
  metric,
  description: ENTSOE_DATASETS[metric].label,
}));

const AGGREGATED_TOTAL_METRICS = new Set(['generation', 'installedCapacity', 'generationPerPlant']);

const GENERATION_TECHNOLOGY_LABELS = {
  B01: 'Biomasse',
  B02: 'Fossile Braunkohle / Lignite',
  B03: 'Fossiles Kohlegas',
  B04: 'Fossiles Gas',
  B05: 'Fossile Steinkohle',
  B06: 'Fossiles Öl',
  B07: 'Fossiles Ölschiefer',
  B08: 'Fossiler Torf',
  B09: 'Geothermie',
  B10: 'Wasserkraft - Pumpspeicher',
  B11: 'Wasserkraft - Laufwasser',
  B12: 'Wasserkraft - Speicher',
  B13: 'Meeresenergie',
  B14: 'Kernenergie',
  B15: 'Sonstige erneuerbare',
  B16: 'Solar',
  B17: 'Abfall',
  B18: 'Wind offshore',
  B19: 'Wind onshore',
  B20: 'Sonstige',
};

const ZONE_LABELS = {
  '10Y1001A1001A83F': 'Deutschland',
  '10Y1001A1001A82H': 'Deutschland',
  '10YFR-RTE------C': 'Frankreich',
};

const ENTSOE_REQUESTS = {
  generation: (zone, start, end, partnerZone) => `/entsoe/generation?zone=${zone}&start=${start}&end=${end}`,
  consumption: (zone, start, end, partnerZone) => `/entsoe/consumption?zone=${zone}&start=${start}&end=${end}`,
  flows: (zone, start, end, partnerZone) => `/entsoe/flows?zone=${zone}&zone_to=${partnerZone}&start=${start}&end=${end}`,
  prices: (zone, start, end, partnerZone) => `/entsoe/prices?zone=${zone}&start=${start}&end=${end}`,
  installedCapacity: (zone, start, end, partnerZone) => `/entsoe/installed-capacity?zone=${zone}&start=${start}&end=${end}`,
  generationPerPlant: (zone, start, end, partnerZone) => `/entsoe/generation-per-plant?zone=${zone}&start=${start}&end=${end}`,
};

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

function getGenerationTechnologyLabel(metricCode) {
  return GENERATION_TECHNOLOGY_LABELS[metricCode] || metricCode;
}

function getZoneLabel(zoneCode) {
  return ZONE_LABELS[zoneCode] || zoneCode;
}

function shouldAggregateMetric(metric) {
  return AGGREGATED_TOTAL_METRICS.has(metric);
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
  const { start, end } = getDefaultUtcRange();
  return startValue === start && endValue === end;
}

const plotlyAvailable = () => typeof window !== 'undefined' && window.Plotly;

function PlotlyChart({ points, title, yLabel, comparisonPoints, comparisonLabel }) {
  const chartRef = useRef(null);

  useEffect(() => {
    let waitTimer = null;

    const renderPlot = () => {
      if (!plotlyAvailable() || !chartRef.current) {
        return false;
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
        return true;
      }

      window.Plotly.newPlot(chartRef.current, traces, {
        title,
        xaxis: { title: 'Zeit' },
        yaxis: { title: { text: `Wert (${yLabel})` } },
        margin: { t: 50, l: 60, r: 20, b: 50 },
        legend: { orientation: 'h', yanchor: 'bottom', y: 1.02, xanchor: 'left', x: 0 },
      }, { responsive: true });

      return true;
    };

    if (!renderPlot()) {
      waitTimer = window.setInterval(() => {
        if (renderPlot()) {
          window.clearInterval(waitTimer);
          waitTimer = null;
        }
      }, 100);
    }

    return () => {
      if (waitTimer) {
        window.clearInterval(waitTimer);
      }
      if (window.Plotly && chartRef.current) {
        window.Plotly.purge(chartRef.current);
      }
    };
  }, [points, comparisonPoints, comparisonLabel, title, yLabel]);

  return <div ref={chartRef} className="chart-card" />;
}

function ChartTile({ title, subtitle, points, comparisonPoints, comparisonLabel, yLabel }) {
  const hasData = Boolean(points?.length || comparisonPoints?.length);
  const latestValue = points?.length ? points[points.length - 1].y : null;
  const pointCount = (points?.length || 0) + (comparisonPoints?.length || 0);
  const showGraphic = !String(subtitle || '').toLowerCase().includes('flows');

  return (
    <div className="chart-tile">
      <div className="chart-tile-header">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>
      {hasData ? (
        showGraphic ? (
          <PlotlyChart
            points={points}
            comparisonPoints={comparisonPoints}
            comparisonLabel={comparisonLabel}
            title={title}
            yLabel={yLabel}
          />
        ) : (
          <div className="chart-summary">
            <div className="chart-summary-row">
              <span>Datenpunkte</span>
              <strong>{pointCount}</strong>
            </div>
            <div className="chart-summary-row">
              <span>Letzter Wert</span>
              <strong>{latestValue !== null ? `${latestValue.toFixed(2)} ${yLabel}` : '—'}</strong>
            </div>
            {comparisonPoints?.length ? (
              <div className="chart-summary-row">
                <span>Vergleich</span>
                <strong>{comparisonLabel || 'aktiv'}</strong>
              </div>
            ) : null}
          </div>
        )
      ) : (
        <div className="chart-empty-state">
          <strong>Keine Daten für diesen Zeitraum</strong>
          <span>Wähle einen anderen Zeitraum oder lade eine andere ENTSO-E-Domain.</span>
        </div>
      )}
    </div>
  );
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
  const [partnerZone, setPartnerZone] = useState(DEFAULT_PARTNER_ZONE);
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [rememberApiKey, setRememberApiKey] = useState(false);
  const [status, setStatus] = useState('Bereit. Bitte Backend starten.');
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('generation');
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
  const [entsoeChartData, setEntsoeChartData] = useState({});
  const [explorerMetric, setExplorerMetric] = useState('generation');
  const [explorerView, setExplorerView] = useState('overview');
  const [availableMetrics, setAvailableMetrics] = useState(null);
  const refreshTimerRef = useRef(null);

  useEffect(() => {
    const storedConfig = readJsonStorage(CONFIG_KEY, null);
    const storedBookmarks = readJsonStorage(BOOKMARKS_KEY, []);

    if (storedConfig?.version === CONFIG_VERSION) {
      setBackendUrl(normalizeBackendUrl(storedConfig.backendUrl || DEFAULT_BACKEND));
      setZone(storedConfig.zone || DEFAULT_ZONE);
      setPartnerZone(storedConfig.partnerZone || DEFAULT_PARTNER_ZONE);
      setSelectedMetric(storedConfig.selectedMetric || 'generation');
      setStart(storedConfig.start || DEFAULT_START);
      setEnd(storedConfig.end || DEFAULT_END);
      setRememberApiKey(Boolean(storedConfig.rememberApiKey));
    } else {
      const defaultRange = getDefaultUtcRange();
      setBackendUrl(DEFAULT_BACKEND);
      setZone(DEFAULT_ZONE);
      setPartnerZone(DEFAULT_PARTNER_ZONE);
      setSelectedMetric('generation');
      setStart(defaultRange.start);
      setEnd(defaultRange.end);
      setRememberApiKey(false);
    }

    if (Array.isArray(storedBookmarks)) {
      setBookmarks(storedBookmarks);
    }

    const storedApiKey = typeof window !== 'undefined' ? window.sessionStorage.getItem(API_KEY_KEY) : null;
    if (storedApiKey) {
      setApiKey(storedApiKey);
    }

    setCacheInfo(null);

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
      version: CONFIG_VERSION,
      backendUrl: normalizeBackendUrl(backendUrl),
      zone,
      partnerZone,
      start,
      end,
      selectedMetric,
      rememberApiKey,
    };
    writeJsonStorage(CONFIG_KEY, config);

    if (rememberApiKey && apiKey) {
      window.sessionStorage.setItem(API_KEY_KEY, apiKey);
    } else {
      window.sessionStorage.removeItem(API_KEY_KEY);
    }
  }, [backendUrl, zone, partnerZone, start, end, selectedMetric, rememberApiKey, apiKey]);

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
      setMetrics(ENTSOE_DATASET_OPTIONS);
      if (!ENTSOE_DATASET_OPTIONS.some((item) => item.metric === selectedMetric)) {
        setSelectedMetric('generation');
      }
    } catch (error) {
      setError(error.message);
      setStatus('ENTSO-E-Daten konnten nicht geladen werden.');
    }
  };

  const normalizeSeries = (records) =>
    records
      .map((row) => ({ x: new Date(row.timestamp), y: Number(row.value) }))
      .sort((a, b) => a.x - b.x);

  const groupSeriesByMetric = (records) => {
    const grouped = new Map();
    records.forEach((row) => {
      if (!grouped.has(row.metric)) {
        grouped.set(row.metric, []);
      }
      grouped.get(row.metric).push({ x: new Date(row.timestamp), y: Number(row.value) });
    });
    return Object.fromEntries(
      Array.from(grouped.entries()).map(([metric, series]) => [
        metric,
        series.sort((a, b) => a.x - b.x),
      ]),
    );
  };

  const buildTotalSeries = (records) => {
    const totals = new Map();
    records.forEach((row) => {
      const timestampKey = new Date(row.timestamp).getTime();
      totals.set(timestampKey, (totals.get(timestampKey) || 0) + Number(row.value));
    });
    return Array.from(totals.entries())
      .map(([timestampKey, value]) => ({ x: new Date(timestampKey), y: value }))
      .sort((a, b) => a.x - b.x);
  };

  const persistSnapshot = (snapshot) => {
    writeJsonStorage(CACHE_KEY, snapshot);
    setCacheInfo(snapshot.cacheInfo || null);
  };

  const getDatasetMeta = (metric) => ENTSOE_DATASETS[metric] || ENTSOE_DATASETS.generation;

  const buildEntsoeDatasetRequest = (metric, currentStart, currentEnd) => {
    const encodedZone = encodeURIComponent(zone);
    const encodedPartnerZone = encodeURIComponent(partnerZone);
    const requestBuilder = ENTSOE_REQUESTS[metric] || ENTSOE_REQUESTS.generation;
    return requestBuilder(encodedZone, encodeURIComponent(currentStart), encodeURIComponent(currentEnd), encodedPartnerZone);
  };

  const fetchEntsoeDataset = async (metric, currentStart, currentEnd, compareStart = null, compareEnd = null) => {
    const currentRecords = await fetchApi(buildEntsoeDatasetRequest(metric, currentStart, currentEnd));
    const comparisonRecords = compareStart && compareEnd
      ? await fetchApi(buildEntsoeDatasetRequest(metric, compareStart, compareEnd))
      : [];

    return {
      currentRecords,
      comparisonRecords,
      currentSeries: normalizeSeries(currentRecords),
      comparisonSeries: normalizeSeries(comparisonRecords),
    };
  };

  const selectedExplorerMeta = getDatasetMeta(explorerMetric);
  const selectedExplorerBundle = entsoeChartData[explorerMetric] || {};
  const selectedExplorerSeries = shouldAggregateMetric(explorerMetric)
    ? buildTotalSeries(selectedExplorerBundle.currentRecords || [])
    : selectedExplorerBundle.currentSeries || [];
  const selectedExplorerComparisonSeries = shouldAggregateMetric(explorerMetric)
    ? buildTotalSeries(selectedExplorerBundle.comparisonRecords || [])
    : selectedExplorerBundle.comparisonSeries || [];
  const selectedExplorerRaw = selectedExplorerBundle.currentRecords || [];
  const generationTechnologyEntries = Object.entries(groupSeriesByMetric(entsoeChartData.generation?.currentRecords || []));
  const generationTotalSeries = buildTotalSeries(entsoeChartData.generation?.currentRecords || []);
  const generationTotalComparisonSeries = buildTotalSeries(entsoeChartData.generation?.comparisonRecords || []);

  const loadEntsoeCharts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setStatus('Lade ENTSO-E-Grafikübersicht...');
      const currentStart = toApiIso(start);
      const currentEnd = toApiIso(end);
      const duration = Number(comparisonWindowHours) * 60 * 60 * 1000;
      const previousEnd = new Date(start);
      const previousStart = new Date(previousEnd.getTime() - duration);
      const compareStart = toApiIso(previousStart);
      const compareEnd = toApiIso(previousEnd);

      const chartEntries = await Promise.allSettled(
        Object.keys(ENTSOE_DATASETS).map(async (metric) => {
          const bundle = await fetchEntsoeDataset(
            metric,
            currentStart,
            currentEnd,
            comparisonEnabled ? compareStart : null,
            comparisonEnabled ? compareEnd : null,
          );
          return [metric, bundle];
        }),
      );

      const nextChartData = Object.fromEntries(
        chartEntries
          .filter((entry) => entry.status === 'fulfilled')
          .map((entry) => entry.value),
      );
      setEntsoeChartData(nextChartData);
      const nextAvailableMetrics = Object.entries(nextChartData)
        .filter(([, bundle]) => (bundle.currentSeries?.length || bundle.currentRecords?.length))
        .map(([metric]) => metric);
      setAvailableMetrics(nextAvailableMetrics);
      if (nextAvailableMetrics.length && !nextAvailableMetrics.includes(explorerMetric)) {
        setExplorerMetric(nextAvailableMetrics[0]);
      }
      if (nextAvailableMetrics.length && !nextAvailableMetrics.includes(selectedMetric)) {
        setSelectedMetric(nextAvailableMetrics[0]);
      }

      const generationRecords = nextChartData.generation?.currentRecords || [];
      const generationComparisonRecords = nextChartData.generation?.comparisonRecords || [];
      setCo2Data(buildTotalSeries(generationRecords));
      setComparisonCo2Data(buildTotalSeries(generationComparisonRecords));

      const fetchedAt = new Date().toLocaleString('de-DE');
      setLastFetch(fetchedAt);
      const failedMetrics = chartEntries.filter((entry) => entry.status === 'rejected').length;
      setStatus(failedMetrics ? `ENTSO-E-Grafikübersicht geladen. ${failedMetrics} Datensatz/Datensätze konnten nicht geladen werden.` : 'ENTSO-E-Grafikübersicht geladen.');
    } catch (error) {
      setError(error.message);
      setStatus('Fehler beim Laden der ENTSO-E-Grafikübersicht.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const meta = getDatasetMeta(selectedMetric);
      setStatus(`Lade ENTSO-E-${meta.label}...`);
      const currentStart = toApiIso(start);
      const currentEnd = toApiIso(end);
      const duration = Number(comparisonWindowHours) * 60 * 60 * 1000;
      const previousEnd = new Date(start);
      const previousStart = new Date(previousEnd.getTime() - duration);
      const compareStart = toApiIso(previousStart);
      const compareEnd = toApiIso(previousEnd);
      const { currentRecords, comparisonRecords, currentSeries, comparisonSeries } = await fetchEntsoeDataset(
        selectedMetric,
        currentStart,
        currentEnd,
        comparisonEnabled ? compareStart : null,
        comparisonEnabled ? compareEnd : null,
      );

      setCo2Data(currentSeries);

      let currentRawData = [...currentRecords];

      if (comparisonEnabled) {
        setStatus('Lade Vergleichszeitraum...');
        setComparisonCo2Data(comparisonSeries);
        currentRawData = [...currentRecords, ...comparisonRecords];
        setComparisonSummary(buildComparisonSummary(currentSeries, comparisonSeries, `ENTSO-E-${meta.label}`));
      } else {
        setComparisonCo2Data([]);
        setComparisonRenewableData([]);
        setComparisonSummary(null);
      }

      setEntsoeChartData((prev) => ({
        ...prev,
        [selectedMetric]: {
          currentRecords,
          comparisonRecords,
          currentSeries,
          comparisonSeries,
        },
      }));
      setRawData(currentRawData);
      setDataLabel(`ENTSO-E ${meta.label} (aktueller Zeitraum)`);

      const fetchedAt = new Date().toLocaleString('de-DE');
      setLastFetch(fetchedAt);
      const snapshot = {
        co2Data: currentSeries,
        renewableData: [],
        rawData: currentRawData,
        dataLabel: `ENTSO-E ${meta.label} (aktueller Zeitraum)`,
        lastFetch: fetchedAt,
        cacheInfo: { zone, partnerZone, start, end, selectedMetric, comparisonEnabled, comparisonWindowHours, fetchedAt },
      };
      persistSnapshot(snapshot);
      setStatus(comparisonEnabled ? `ENTSO-E-${meta.label} erfolgreich geladen. Vergleichszeitraum ${comparisonWindowHours}h aktiv.` : `ENTSO-E-${meta.label} erfolgreich geladen.`);
    } catch (error) {
      setCo2Data([]);
      setComparisonCo2Data([]);
      setRenewableData([]);
      setComparisonRenewableData([]);
      setRawData([]);
      setDataLabel(`ENTSO-E ${getDatasetMeta(selectedMetric).label}`);
      setLastFetch(null);
      setComparisonSummary(null);
      setError(error.message);
      setStatus('Fehler beim Laden der ENTSO-E-Daten.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUnifiedData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setStatus('Lade vereinheitlichte Daten...');
      const unifiedRecords = await fetchApi(`/unified?zone=${encodeURIComponent(zone)}&start=${encodeURIComponent(toApiIso(start))}&end=${encodeURIComponent(toApiIso(end))}&include_entsoe=true&include_ggc=false`);
      setRawData(unifiedRecords);
      setDataLabel('ENTSO-E Unified-Daten');
      setLastFetch(new Date().toLocaleString('de-DE'));
      setStatus(`ENTSO-E Unified-Daten geladen: ${unifiedRecords.length} Datensätze.`);
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
      const meta = getDatasetMeta(metric);
      setStatus(`Lade ENTSO-E-${meta.label}...`);
      const records = await fetchApi(buildEntsoeDatasetRequest(metric, toApiIso(start), toApiIso(end)));
      setRawData(records);
      setDataLabel(`ENTSO-E ${meta.label}`);
      setSelectedMetric(metric);
      setExplorerMetric(metric);
      setExplorerView('table');
      setLastFetch(new Date().toLocaleString('de-DE'));
      setStatus(`ENTSO-E-${meta.label} geladen: ${records.length} Datensätze.`);
    } catch (error) {
      setRawData([]);
      setError(error.message);
      setStatus('Fehler beim Laden der ENTSO-E-Rohdaten.');
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
  const visibleMetrics = availableMetrics?.length ? availableMetrics : Object.keys(ENTSOE_DATASETS);
  const visibleDatasetEntries = Object.entries(ENTSOE_DATASETS).filter(([metric]) => visibleMetrics.includes(metric));
  const visibleDatasetOptions = ENTSOE_DATASET_OPTIONS.filter((item) => visibleMetrics.includes(item.metric));

  return (
    <div className="app-shell">
      <header className="hero">
        <h1>ENTSO-E React Dashboard</h1>
        <p>Live-Daten-Frontend mit ENTSO-E als primärer Quelle, Vergleich, Cache und Lesezeichen.</p>
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
              Zielzone für Flows
              <input value={partnerZone} onChange={(e) => setPartnerZone(e.target.value)} placeholder="z. B. FR" />
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
            <button type="button" onClick={loadEntsoeCharts} disabled={isLoading}>Alle Grafiken laden</button>
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
              ENTSO-E-Datentyp
              <select value={selectedMetric} onChange={(e) => setSelectedMetric(e.target.value)} disabled={isLoading || !metrics.length}>
                {visibleDatasetOptions.length ? visibleDatasetOptions.map((item) => (
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
              <strong>ENTSO-E Datentypen</strong>
              <p>{visibleDatasetOptions.length ? visibleDatasetOptions.map((item) => `${item.metric} (${item.description})`).join(', ') : 'Lade...'}</p>
              {availableMetrics && availableMetrics.length < ENTSOE_DATASET_OPTIONS.length && (
                <p className="hint">Es werden nur Datensätze gezeigt, die im gewählten Zeitraum echte ENTSO-E-Daten geliefert haben.</p>
              )}
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
              <span>Letzter ENTSO-E-Wert</span>
              <strong>{latestCo2 !== null ? `${latestCo2.toFixed(1)}` : '—'}</strong>
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
              <p><strong>Erzeugung:</strong> Δ letzter Wert {comparisonSummary.latestDelta?.toFixed(1) || '—'} • Δ Mittelwert {comparisonSummary.averageDelta?.toFixed(1) || '—'}</p>
            </div>
          )}

          {cacheInfo && (
            <div className="cache-card">
              <strong>Live-Status:</strong> Letzter Abruf {cacheInfo.fetchedAt} für {cacheInfo.zone} / {cacheInfo.start} bis {cacheInfo.end}
            </div>
          )}

          <div className={`status ${error ? 'error' : ''}`}>{status}</div>
          <p className="hint">Hinweis: API-Schlüssel werden nicht dauerhaft gespeichert, sondern nur optional für die aktuelle Sitzung hinterlegt.</p>
        </section>

        <section className="panel">
          <div className="section-header">
            <div>
              <h2>Explorer</h2>
              <p>Datensatz auswählen und zwischen Übersicht, Tabelle und Rohdaten umschalten.</p>
            </div>
            <button type="button" className="secondary" onClick={loadEntsoeCharts} disabled={isLoading}>Alle Daten aktualisieren</button>
          </div>
          <div className="explorer-toolbar">
            <div className="explorer-section">
              <strong>Datensatz</strong>
              <div className="action-row explorer-tabs">
                {visibleDatasetEntries.map(([metric, meta]) => (
                  <button
                    key={metric}
                    type="button"
                    className={metric === explorerMetric ? 'selected-tab' : 'secondary'}
                    onClick={() => setExplorerMetric(metric)}
                    disabled={isLoading}
                  >
                    {meta.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="explorer-section">
              <strong>Ansicht</strong>
              <div className="action-row explorer-tabs">
                <button type="button" className={explorerView === 'overview' ? 'selected-tab' : 'secondary'} onClick={() => setExplorerView('overview')} disabled={isLoading}>Übersicht</button>
                <button type="button" className={explorerView === 'chart' ? 'selected-tab' : 'secondary'} onClick={() => setExplorerView('chart')} disabled={isLoading}>Grafik</button>
                <button type="button" className={explorerView === 'table' ? 'selected-tab' : 'secondary'} onClick={() => setExplorerView('table')} disabled={isLoading}>Tabelle</button>
                <button type="button" className={explorerView === 'raw' ? 'selected-tab' : 'secondary'} onClick={() => setExplorerView('raw')} disabled={isLoading}>Rohdaten</button>
              </div>
            </div>
          </div>

          {explorerView === 'overview' ? (
            <div className="chart-grid">
              {explorerMetric === 'generation' ? (
                <>
                  <ChartTile
                    key="generation-total"
                    title={`ENTSO-E Gesamterzeugung - ${getZoneLabel(zone)}`}
                    subtitle="Summe aller Technologien"
                    points={generationTotalSeries}
                    comparisonPoints={generationTotalComparisonSeries}
                    comparisonLabel={`Vorheriger ${comparisonWindowHours}h-Zeitraum`}
                    yLabel={ENTSOE_DATASETS.generation.unit}
                  />
                  {generationTechnologyEntries.map(([metric, series]) => (
                    <ChartTile
                      key={metric}
                      title={`ENTSO-E Technologie: ${getGenerationTechnologyLabel(metric)} - ${getZoneLabel(zone)}`}
                      subtitle={metric}
                      points={series}
                      yLabel={ENTSOE_DATASETS.generation.unit}
                    />
                  ))}
                </>
              ) : visibleDatasetEntries.map(([metric, meta]) => {
                const chartBundle = entsoeChartData[metric] || {};
                const points = shouldAggregateMetric(metric)
                  ? buildTotalSeries(chartBundle.currentRecords || [])
                  : (chartBundle.currentSeries || []);
                const comparisonPoints = shouldAggregateMetric(metric)
                  ? buildTotalSeries(chartBundle.comparisonRecords || [])
                  : (chartBundle.comparisonSeries || []);
                const subtitle = shouldAggregateMetric(metric) ? 'Summe aller Teilreihen' : metric;
                return (
                  <ChartTile
                    key={metric}
                    title={`ENTSO-E ${meta.label} - ${getZoneLabel(zone)}`}
                    subtitle={subtitle}
                    points={points}
                    comparisonPoints={comparisonPoints}
                    comparisonLabel={`Vorheriger ${comparisonWindowHours}h-Zeitraum`}
                    yLabel={meta.unit}
                  />
                );
              })}
            </div>
          ) : explorerView === 'chart' ? (
            <div className="chart-tile explorer-focus-card">
              <div className="chart-tile-header">
                <div>
                  <h3>{`ENTSO-E ${selectedExplorerMeta.label} - ${getZoneLabel(zone)}`}</h3>
                  <p>{explorerMetric}</p>
                </div>
              </div>
              {selectedExplorerSeries.length ? (
                explorerMetric === 'flows' ? (
                  <div className="chart-summary">
                    <div className="chart-summary-row">
                      <span>Datenpunkte</span>
                      <strong>{selectedExplorerSeries.length}</strong>
                    </div>
                    <div className="chart-summary-row">
                      <span>Hinweis</span>
                      <strong>Diese Grafik wird ausgeblendet, weil sie unübersichtlich war.</strong>
                    </div>
                  </div>
                ) : (
                  <PlotlyChart
                    key={explorerMetric}
                    points={selectedExplorerSeries}
                    comparisonPoints={selectedExplorerComparisonSeries}
                    comparisonLabel={`Vorheriger ${comparisonWindowHours}h-Zeitraum`}
                    title={`ENTSO-E ${selectedExplorerMeta.label} - ${getZoneLabel(zone)}`}
                    yLabel={selectedExplorerMeta.unit}
                  />
                )
              ) : (
                <div className="chart-empty-state">
                  <strong>Keine Daten für diesen Datensatz</strong>
                  <span>Wechsle den Zeitraum oder lade den Datensatz neu.</span>
                </div>
              )}
            </div>
          ) : explorerView === 'table' ? (
            <div className="data-table">{buildTable(selectedExplorerRaw)}</div>
          ) : (
            <pre className="raw-json">{JSON.stringify(selectedExplorerRaw.slice(0, 50), null, 2)}</pre>
          )}
        </section>

        <section className="panel">
          <h2>{dataLabel}</h2>
          <p className="status" style={{ marginTop: 0, color: '#475569' }}>Aktuelle Tabelle: {dataLabel}</p>
          <div className="action-row">
            <button type="button" onClick={() => loadRawData(selectedMetric)} disabled={isLoading || !selectedMetric}>Daten laden</button>
            {visibleDatasetEntries.map(([metric, meta]) => (
              <button type="button" key={metric} onClick={() => loadRawData(metric)} disabled={isLoading}>
                {meta.label}
              </button>
            ))}
          </div>
          <div className="data-table">{buildTable(rawData)}</div>
        </section>
      </main>
    </div>
  );
}
