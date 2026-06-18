import os
from datetime import datetime, timedelta
from pathlib import Path
import requests
import pandas as pd
import xml.etree.ElementTree as ET

API_URL = "https://transparency.entsoe.eu/api"
DEFAULT_ZONE = "10Y1001A1001A63L"  # ENTSO-E domain code for Germany


def clean_tag(tag: str) -> str:
    return tag.split('}')[-1]


def _find_child(element, tag):
    for child in element:
        if clean_tag(child.tag) == tag:
            return child
    return None


def _find_children(element, tag):
    return [child for child in element if clean_tag(child.tag) == tag]


def resolution_to_minutes(resolution: str) -> int:
    if resolution.startswith("PT") and resolution.endswith("M"):
        return int(resolution[2:-1])
    if resolution.startswith("PT") and resolution.endswith("H"):
        return int(resolution[2:-1]) * 60
    raise ValueError(f"Unsupported resolution format: {resolution}")


def build_period(timestamp: datetime) -> str:
    return timestamp.strftime("%Y%m%d%H%M")


def fetch_entsoe_generation(
    bidding_zone: str,
    start: datetime,
    end: datetime,
    security_token: str,
    document_type: str = "A75",
    process_type: str = "A16",
) -> pd.DataFrame:
    params = {
        "documentType": document_type,
        "processType": process_type,
        "outBiddingZone_Domain": bidding_zone,
        "periodStart": build_period(start),
        "periodEnd": build_period(end),
        "securityToken": security_token,
    }

    headers = {
        "Accept": "application/xml, text/xml",
        "User-Agent": "GGC-ENTSOE-Client/1.0",
    }

    response = requests.get(API_URL, params=params, headers=headers, timeout=30)
    response.raise_for_status()

    content_type = response.headers.get("content-type", "")
    # If the platform returns HTML (login/landing page) surface that for debugging
    if "html" in content_type.lower():
        raise RuntimeError(
            "ENTSO-E returned HTML instead of XML (possible invalid token or blocked request). Response snippet: "
            + response.text[:1000]
        )

    try:
        return parse_entsoe_xml(response.text, bidding_zone)
    except ET.ParseError as exc:
        # include the server response to help debugging invalid-token / error payloads
        raise RuntimeError(f"XML parse error from ENTSO-E: {exc}. Response snippet: {response.text[:1000]}")


def parse_entsoe_xml(xml_text: str, bidding_zone: str) -> pd.DataFrame:
    root = ET.fromstring(xml_text)
    rows = []

    for series in root.iter():
        if clean_tag(series.tag) != "TimeSeries":
            continue

        type_code = None
        type_element = _find_child(series, "MktPSRType")
        if type_element is not None:
            psr_type = _find_child(type_element, "psrType")
            if psr_type is not None:
                type_code = psr_type.text

        period = _find_child(series, "Period")
        if period is None:
            continue

        time_interval = _find_child(period, "timeInterval")
        if time_interval is None:
            continue

        start_elem = _find_child(time_interval, "start")
        resolution_elem = _find_child(period, "resolution")
        if start_elem is None or resolution_elem is None:
            continue

        start_timestamp = datetime.fromisoformat(start_elem.text)
        resolution_minutes = resolution_to_minutes(resolution_elem.text)

        point_idx = 0
        for point in _find_children(period, "point"):
            quantity = _find_child(point, "quantity")
            if quantity is None or quantity.text is None:
                continue

            timestamp = start_timestamp + timedelta(minutes=resolution_minutes * point_idx)
            rows.append(
                {
                    "timestamp": timestamp,
                    "zone": bidding_zone,
                    "metric": type_code or "unknown",
                    "value": float(quantity.text),
                    "source": "ENTSO-E",
                }
            )
            point_idx += 1

    if not rows:
        return pd.DataFrame(columns=["timestamp", "zone", "metric", "value", "source"])

    df = pd.DataFrame(rows)
    df = df.sort_values("timestamp").reset_index(drop=True)
    return df


def main() -> None:
    token = os.getenv("ENTSOE_API_KEY")
    if not token:
        print("ERROR: ENTSOE_API_KEY is not set. Bitte setze den API-Key als Umgebungsvariable.")
        return

    end = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    start = end - timedelta(hours=24)

    print(f"Rufe ENTSO-E-Daten ab für Zone {DEFAULT_ZONE} von {start} bis {end}")
    try:
        df = fetch_entsoe_generation(DEFAULT_ZONE, start, end, token)
    except requests.RequestException as exc:
        print(f"Fehler beim Abruf der ENTSO-E-API: {exc}")
        return
    except Exception as exc:
        print(f"Parsing-Fehler: {exc}")
        return

    if df.empty:
        print("Keine Daten aus der ENTSO-E-Antwort extrahiert.")
        return

    output_path = Path(__file__).resolve().parents[1] / "data" / "entsoe_generation_live_sample.csv"
    df.to_csv(output_path, index=False)
    print(f"Live-Daten erfolgreich gespeichert: {output_path}")


if __name__ == "__main__":
    main()
