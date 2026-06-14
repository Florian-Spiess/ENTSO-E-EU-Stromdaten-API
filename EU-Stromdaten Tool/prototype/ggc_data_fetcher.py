import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
import math

import pandas as pd
import requests

DEFAULT_BASE_URL = os.getenv("GGC_API_BASE_URL", "https://api.traxes.io/green-grid-compass")
DEFAULT_AUTH_TYPE = os.getenv("GGC_API_AUTH_TYPE", "Bearer")
DEFAULT_ZONE = os.getenv("GGC_API_ZONE", "DE")

GGC_METRIC_PATHS = {
    "co2_intensity": "/v1/co2-intensity",
    "renewable_share": "/v1/renewable-share",
    "co2_emissions": "/v1/co2-emissions",
    "power": "/v1/power",
    "co2_intensity_forecast": "/v1/co2-intensity-forecast",
    "renewable_share_forecast": "/v1/renewable-share-forecast",
}

SAMPLE_GENERATION_PATH = Path(__file__).resolve().parents[1] / "data" / "sample_generation.csv"


def _to_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _generate_synthetic_generation(start: datetime, end: datetime, zone: str) -> pd.DataFrame:
    start_ts = _to_utc(start)
    end_ts = _to_utc(end)
    records = []
    current = start_ts
    while current <= end_ts:
        hour = current.hour
        solar = max(0.0, 1200.0 * math.sin(((hour - 6) / 24.0) * 2 * math.pi))
        wind = 600.0 + 400.0 * math.sin(((hour + 3) / 24.0) * 2 * math.pi)
        hydro = 250.0 + 100.0 * math.cos(((hour + 10) / 24.0) * 2 * math.pi)
        nuclear = 500.0
        other = 80.0
        total = max(1200.0, solar + wind + hydro + nuclear + other)
        fossil = max(0.0, total - (wind + solar + hydro + nuclear + other))

        records.append({
            "timestamp": current,
            "country": zone,
            "wind": round(wind, 1),
            "solar": round(solar, 1),
            "fossil": round(fossil, 1),
            "hydro": round(hydro, 1),
            "nuclear": round(nuclear, 1),
            "other": round(other, 1),
        })
        current += timedelta(hours=1)

    df = pd.DataFrame(records)
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    return df


def _load_sample_generation(start: datetime, end: datetime, zone: str) -> pd.DataFrame:
    if SAMPLE_GENERATION_PATH.exists():
        df = pd.read_csv(SAMPLE_GENERATION_PATH, parse_dates=["timestamp"])
        if "country" in df.columns:
            df = df[df["country"].astype(str).str.upper() == zone.upper()]
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
        start_ts = _to_utc(start)
        end_ts = _to_utc(end)
        df = df[(df["timestamp"] >= start_ts) & (df["timestamp"] <= end_ts)].copy()
        if not df.empty:
            return df

    # Wenn die Sample-Daten nicht die angeforderte Zeitspanne abdecken,
    # erstellen wir dynamisch synthetische Tagesdaten für den aktuellen Zeitraum.
    return _generate_synthetic_generation(start, end, zone)


def _build_sample_metric(df: pd.DataFrame, metric: str, zone: str) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=["timestamp", "zone", "value", "unit"])

    df = df.copy()
    df["wind"] = pd.to_numeric(df.get("wind", 0), errors="coerce").fillna(0)
    df["solar"] = pd.to_numeric(df.get("solar", 0), errors="coerce").fillna(0)
    df["hydro"] = pd.to_numeric(df.get("hydro", 0), errors="coerce").fillna(0)
    df["fossil"] = pd.to_numeric(df.get("fossil", 0), errors="coerce").fillna(0)
    df["nuclear"] = pd.to_numeric(df.get("nuclear", 0), errors="coerce").fillna(0)
    df["other"] = pd.to_numeric(df.get("other", 0), errors="coerce").fillna(0)

    total = df["wind"] + df["solar"] + df["hydro"] + df["fossil"] + df["nuclear"] + df["other"]
    renewable = df["wind"] + df["solar"] + df["hydro"]

    if metric == "renewable_share":
        values = (renewable / total.replace(0, 1)) * 100
        unit = "%"
    elif metric == "co2_intensity":
        # Approximate emission intensity using generation mix and simple coefficients
        values = (
            df["fossil"] * 400
            + df["nuclear"] * 12
            + df["other"] * 250
        ) / total.replace(0, 1)
        unit = "gCO2eq/kWh"
    elif metric == "power":
        values = total
        unit = "MW"
    else:
        values = total
        unit = "unknown"

    result = pd.DataFrame({
        "timestamp": df["timestamp"],
        "zone": zone,
        "value": values.fillna(0),
        "unit": unit,
    })
    return result


def fetch_sample_ggc_metric(metric: str, start: datetime, end: datetime, zone: str = DEFAULT_ZONE) -> pd.DataFrame:
    df = _load_sample_generation(start, end, zone)
    return _build_sample_metric(df, metric, zone)


def _should_use_sample(metric: str) -> bool:
    return metric in {"co2_intensity", "renewable_share", "power"}


def build_headers(api_key: str, auth_type: str) -> dict[str, str]:
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if api_key:
        headers["Authorization"] = f"{auth_type} {api_key}"
    return headers


def build_url(path: str) -> str:
    return f"{DEFAULT_BASE_URL.rstrip('/')}/{path.lstrip('/')}"


def fetch_oauth_access_token() -> str:
    token_url = os.getenv("GGC_OAUTH_TOKEN_URL")
    client_id = os.getenv("GGC_CLIENT_ID")
    client_secret = os.getenv("GGC_CLIENT_SECRET")
    scope = os.getenv("GGC_SCOPE", "esp")

    if not token_url or not client_id or not client_secret:
        raise RuntimeError(
            "GGC OAuth2-Zugangsdaten nicht vollständig gesetzt. Bitte setze GGC_OAUTH_TOKEN_URL, GGC_CLIENT_ID und GGC_CLIENT_SECRET."
        )

    data = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": scope,
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    response = requests.post(token_url, data=data, headers=headers, timeout=30)
    response.raise_for_status()
    token_data = response.json()
    token = token_data.get("access_token")
    if not token:
        raise RuntimeError("OAuth2-Tokenantwort enthält kein access_token.")
    return token


def get_ggc_access_token() -> tuple[str, str]:
    api_key = os.getenv("GGC_API_KEY")
    if api_key:
        return api_key, DEFAULT_AUTH_TYPE

    token = fetch_oauth_access_token()
    return token, "Bearer"


def fetch_ggc_data(path: str, params: dict[str, str]) -> dict:
    token, auth_type = get_ggc_access_token()
    url = build_url(path)
    headers = build_headers(token, auth_type)
    response = requests.get(url, headers=headers, params=params, timeout=30)
    response.raise_for_status()
    return response.json()


def parse_measurements(response: dict) -> pd.DataFrame:
    if not isinstance(response, dict):
        raise ValueError("Unerwartetes Antwortformat: JSON-Objekt erwartet.")

    if "measurements" in response:
        measurements = response["measurements"]
    elif "data" in response:
        measurements = response["data"]
    else:
        raise ValueError("Antwort enthält keine erwarteten Felder 'measurements' oder 'data'.")

    if not isinstance(measurements, list):
        raise ValueError("Messwerte müssen als Liste vorliegen.")

    return pd.json_normalize(measurements)


def fetch_ggc_metric(metric: str, start: datetime, end: datetime, zone: str = DEFAULT_ZONE) -> pd.DataFrame:
    metric_path = GGC_METRIC_PATHS.get(metric)
    if not metric_path:
        raise ValueError(f"Unbekannte GGC-Metrik: {metric}. Verfügbare Metriken: {', '.join(sorted(GGC_METRIC_PATHS))}")

    if not os.getenv("GGC_API_KEY") and not (os.getenv("GGC_OAUTH_TOKEN_URL") and os.getenv("GGC_CLIENT_ID") and os.getenv("GGC_CLIENT_SECRET")):
        if _should_use_sample(metric):
            return fetch_sample_ggc_metric(metric, start, end, zone)
        raise RuntimeError("GGC-Datenquelle ist nicht konfiguriert und kein Sample-Fallback verfügbar.")

    params = {
        "zone": zone,
        "from": start.isoformat(),
        "to": end.isoformat(),
    }
    response = fetch_ggc_data(metric_path, params)
    return parse_measurements(response)


def fetch_co2_intensity(start: datetime, end: datetime, zone: str = DEFAULT_ZONE) -> pd.DataFrame:
    return fetch_ggc_metric("co2_intensity", start, end, zone)


def fetch_renewable_share(start: datetime, end: datetime, zone: str = DEFAULT_ZONE) -> pd.DataFrame:
    return fetch_ggc_metric("renewable_share", start, end, zone)


def fetch_co2_emissions(start: datetime, end: datetime, zone: str = DEFAULT_ZONE) -> pd.DataFrame:
    return fetch_ggc_metric("co2_emissions", start, end, zone)


def fetch_power(start: datetime, end: datetime, zone: str = DEFAULT_ZONE) -> pd.DataFrame:
    return fetch_ggc_metric("power", start, end, zone)


def save_dataframe(df: pd.DataFrame, filename: str) -> Path:
    output_path = Path(__file__).resolve().parents[1] / "data" / filename
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)
    return output_path


def main() -> None:
    end = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    start = end - timedelta(hours=24)
    print(f"GGC API Base URL: {DEFAULT_BASE_URL}")
    print(f"Abfragezeitraum: {start.isoformat()} bis {end.isoformat()}")

    try:
        df = fetch_co2_intensity(start, end)
    except Exception as exc:
        print(f"Fehler beim Abruf der GGC CO2-Intensität: {exc}")
        return

    if df.empty:
        print("Keine Daten gefunden.")
        return

    path = save_dataframe(df, "ggc_co2_intensity_live_sample.csv")
    print(f"Live-GGC-Daten gespeichert: {path}")


if __name__ == "__main__":
    main()
