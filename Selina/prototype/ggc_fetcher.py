import os
from datetime import datetime, timedelta
from pathlib import Path

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
