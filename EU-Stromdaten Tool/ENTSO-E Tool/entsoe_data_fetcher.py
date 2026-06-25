import os
from datetime import datetime, timedelta
from pathlib import Path
import xml.etree.ElementTree as ET

import pandas as pd
import requests

API_URL = "https://web-api.tp.entsoe.eu/api"
DEFAULT_ZONE = "10Y1001A1001A63L"  # ENTSO-E domain code for Germany


def clean_tag(tag: str) -> str:
    return tag.split("}")[-1]


def _find_child(element, tag):
    for child in element:
        if clean_tag(child.tag).lower() == tag.lower():
            return child
    return None


def _find_children(element, tag):
    normalized_tag = tag.lower()
    return [child for child in element if clean_tag(child.tag).lower() == normalized_tag]


def resolution_to_minutes(resolution: str) -> int:
    if resolution.startswith("PT") and resolution.endswith("M"):
        return int(resolution[2:-1])
    if resolution.startswith("PT") and resolution.endswith("H"):
        return int(resolution[2:-1]) * 60
    if resolution == "P1D":
        return 24 * 60
    if resolution == "P1W":
        return 7 * 24 * 60
    if resolution == "P1M":
        return 30 * 24 * 60
    if resolution == "P1Y":
        return 365 * 24 * 60
    raise ValueError(f"Unsupported resolution format: {resolution}")


def build_period(timestamp: datetime) -> str:
    return timestamp.strftime("%Y%m%d%H%M")


def _request_entsoe(params: dict[str, str], security_token: str) -> str:
    request_params = {**params, "periodStart": params["periodStart"], "periodEnd": params["periodEnd"], "securityToken": security_token}
    headers = {
        "Accept": "application/xml, text/xml",
        "User-Agent": "ENTSOE-Client/1.0",
    }

    response = requests.get(API_URL, params=request_params, headers=headers, timeout=30)
    if response.status_code >= 400:
        snippet = response.text[:1000].strip()
        raise RuntimeError(f"ENTSO-E request failed with {response.status_code}. Response snippet: {snippet}")

    content_type = response.headers.get("content-type", "")
    if "html" in content_type.lower():
        raise RuntimeError(
            "ENTSO-E returned HTML instead of XML (possible invalid token or blocked request). Response snippet: "
            + response.text[:1000]
        )

    return response.text


def _parse_entsoe_xml(
    xml_text: str,
    zone_label: str,
    metric_name: str,
    value_tags: tuple[str, ...] = ("quantity",),
    use_psr_type: bool = False,
) -> pd.DataFrame:
    root = ET.fromstring(xml_text)
    rows = []

    for series in root.iter():
        if clean_tag(series.tag) != "TimeSeries":
            continue

        series_metric = metric_name
        if use_psr_type:
            type_element = _find_child(series, "MktPSRType")
            if type_element is not None:
                psr_type = _find_child(type_element, "psrType")
                if psr_type is not None and psr_type.text:
                    series_metric = psr_type.text

        period = _find_child(series, "Period")
        if period is None:
            continue

        time_interval = _find_child(period, "timeInterval")
        if time_interval is None:
            continue

        start_elem = _find_child(time_interval, "start")
        resolution_elem = _find_child(period, "resolution")
        if start_elem is None or resolution_elem is None or not start_elem.text or not resolution_elem.text:
            continue

        start_timestamp = datetime.fromisoformat(start_elem.text.replace("Z", "+00:00"))
        resolution_minutes = resolution_to_minutes(resolution_elem.text)

        point_idx = 0
        for point in _find_children(period, "point"):
            value_text = None
            for tag_name in value_tags:
                value_node = _find_child(point, tag_name)
                if value_node is not None and value_node.text is not None:
                    value_text = value_node.text
                    break

            if value_text is None:
                continue

            timestamp = start_timestamp + timedelta(minutes=resolution_minutes * point_idx)
            rows.append(
                {
                    "timestamp": timestamp,
                    "zone": zone_label,
                    "metric": series_metric,
                    "value": float(value_text),
                    "source": "ENTSO-E",
                }
            )
            point_idx += 1

    if not rows:
        return pd.DataFrame(columns=["timestamp", "zone", "metric", "value", "source"])

    df = pd.DataFrame(rows)
    return df.sort_values("timestamp").reset_index(drop=True)


def fetch_entsoe_generation(
    bidding_zone: str,
    start: datetime,
    end: datetime,
    security_token: str,
) -> pd.DataFrame:
    xml_text = _request_entsoe(
        {
            "documentType": "A75",
            "processType": "A16",
            "in_Domain": bidding_zone,
            "periodStart": build_period(start),
            "periodEnd": build_period(end),
        },
        security_token,
    )
    return _parse_entsoe_xml(xml_text, bidding_zone, "generation", use_psr_type=True)


def fetch_entsoe_installed_generation_capacity(
    bidding_zone: str,
    start: datetime,
    end: datetime,
    security_token: str,
) -> pd.DataFrame:
    xml_text = _request_entsoe(
        {
            "documentType": "A68",
            "processType": "A33",
            "in_Domain": bidding_zone,
            "periodStart": build_period(start),
            "periodEnd": build_period(end),
        },
        security_token,
    )
    return _parse_entsoe_xml(xml_text, bidding_zone, "installed_generation_capacity", use_psr_type=True)


def fetch_entsoe_generation_per_plant(
    bidding_zone: str,
    start: datetime,
    end: datetime,
    security_token: str,
) -> pd.DataFrame:
    xml_text = _request_entsoe(
        {
            "documentType": "A73",
            "processType": "A16",
            "in_Domain": bidding_zone,
            "periodStart": build_period(start),
            "periodEnd": build_period(end),
        },
        security_token,
    )
    return _parse_entsoe_xml(xml_text, bidding_zone, "generation_per_plant", use_psr_type=True)


def fetch_entsoe_consumption(
    bidding_zone: str,
    start: datetime,
    end: datetime,
    security_token: str,
) -> pd.DataFrame:
    xml_text = _request_entsoe(
        {
            "documentType": "A65",
            "processType": "A16",
            "outBiddingZone_Domain": bidding_zone,
            "periodStart": build_period(start),
            "periodEnd": build_period(end),
        },
        security_token,
    )
    return _parse_entsoe_xml(xml_text, bidding_zone, "consumption")


def fetch_entsoe_crossborder_flows(
    bidding_zone_from: str,
    bidding_zone_to: str,
    start: datetime,
    end: datetime,
    security_token: str,
) -> pd.DataFrame:
    xml_text = _request_entsoe(
        {
            "documentType": "A11",
            "in_Domain": bidding_zone_to,
            "out_Domain": bidding_zone_from,
            "periodStart": build_period(start),
            "periodEnd": build_period(end),
        },
        security_token,
    )
    zone_label = f"{bidding_zone_from}->{bidding_zone_to}"
    return _parse_entsoe_xml(xml_text, zone_label, "cross_border_flow")


def fetch_entsoe_day_ahead_prices(
    bidding_zone: str,
    start: datetime,
    end: datetime,
    security_token: str,
    sequence: int | None = 1,
) -> pd.DataFrame:
    params = {
        "documentType": "A44",
        "in_Domain": bidding_zone,
        "out_Domain": bidding_zone,
        "contract_MarketAgreement.type": "A01",
        "periodStart": build_period(start),
        "periodEnd": build_period(end),
    }
    if sequence is not None:
        params["classificationSequence_AttributeInstanceComponent.position"] = str(sequence)

    xml_text = _request_entsoe(params, security_token)
    return _parse_entsoe_xml(xml_text, bidding_zone, "day_ahead_price", value_tags=("price.amount", "quantity"))


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
