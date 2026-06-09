import argparse
import logging
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import ggc_data_fetcher as ggc_fetcher
import entsoe_data_fetcher as entsoe_fetcher

DEFAULT_ZONE = os.getenv("GGC_API_ZONE", "DE")
DEFAULT_ENTSO_ZONE = os.getenv("ENTSOE_ZONE", "10Y1001A1001A63L")
DEFAULT_OUTPUT = "unified_energy_data.csv"


def parse_timestamp(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise argparse.ArgumentTypeError(f"Ungültiges ISO-Datum: {value}")


def normalize_df(df: pd.DataFrame, metric: str, source: str, zone: str, unit: str) -> pd.DataFrame:
    df = df.copy()
    if "timestamp" not in df.columns:
        if "time" in df.columns:
            df["timestamp"] = df["time"]
        elif "date" in df.columns:
            df["timestamp"] = df["date"]
        elif "from" in df.columns:
            df["timestamp"] = df["from"]
        else:
            raise ValueError(f"Keine Zeitstempel-Spalte in Antwort von {source}/{metric} gefunden.")

    if "value" not in df.columns:
        for candidate in ["measurementValue", "measurement_value", "valueAmount", "quantity"]:
            if candidate in df.columns:
                df["value"] = df[candidate]
                break

    if "zone" not in df.columns:
        df["zone"] = zone

    if "quality_flag" not in df.columns:
        for candidate in ["quality", "quality_flag", "valueStatus", "value_status", "status"]:
            if candidate in df.columns:
                df["quality_flag"] = df[candidate]
                break

    if "revision_flag" not in df.columns:
        for candidate in ["revisionStatus", "revision", "isRevision", "revision_status"]:
            if candidate in df.columns:
                df["revision_flag"] = df[candidate]
                break

    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, errors="coerce", infer_datetime_format=True)
    if df["timestamp"].isna().any():
        failed = df["timestamp"].isna().sum()
        logging.warning("%d ungültige Zeitstempel erkannt, versuche Fallback-Parsing.", failed)
        df["timestamp"] = pd.to_datetime(df["timestamp"].astype(str).str.replace(" ", "T"), utc=True, errors="coerce")
        if df["timestamp"].isna().any():
            remaining = df["timestamp"].isna().sum()
            logging.warning("%d verbleibende ungültige Zeitstempel nach Fallback-Parsing.", remaining)

    if "value" not in df.columns:
        raise ValueError(f"Keine Werte-Spalte in Antwort von {source}/{metric} gefunden.")

    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    if df["value"].isna().any():
        count = df["value"].isna().sum()
        logging.warning("%d Werte konnten nicht numerisch interpretiert werden und werden verworfen.", count)

    df["metric"] = metric
    df["source"] = source
    df["unit"] = unit
    df["zone"] = df["zone"].fillna(zone)

    df = df.dropna(subset=["timestamp", "value"])
    df = df.drop_duplicates(subset=["timestamp", "zone", "metric", "source"], keep="last")

    columns = ["timestamp", "zone", "metric", "value", "unit", "source"]
    if "quality_flag" in df.columns:
        columns.append("quality_flag")
    if "revision_flag" in df.columns:
        columns.append("revision_flag")

    return df[columns]


def fetch_primary_ggc(start: datetime, end: datetime, zone: str) -> list[pd.DataFrame]:
    records = []

    for metric_name, func, unit in [
        ("co2_intensity", ggc_fetcher.fetch_co2_intensity, "gCO2eq/kWh"),
        ("renewable_share", ggc_fetcher.fetch_renewable_share, "%"),
    ]:
        try:
            df = func(start, end, zone)
            if df.empty:
                logging.info("Keine Daten für GGC-Metrik %s gefunden.", metric_name)
                continue
            records.append(normalize_df(df, metric_name, "GGC", zone, unit))
        except Exception as exc:
            logging.warning("GGC %s konnte nicht geladen werden: %s", metric_name, exc)

    return records


def fetch_entsoe_fallback(start: datetime, end: datetime, zone: str) -> list[pd.DataFrame]:
    token = os.getenv("ENTSOE_API_KEY")
    if not token:
        logging.warning("ENTSOE_API_KEY nicht gesetzt; ENTSO-E Fallback wird übersprungen.")
        return []

    try:
        df = entsoe_fetcher.fetch_entsoe_generation(DEFAULT_ENTSO_ZONE, start, end, token)
        if df.empty:
            logging.info("Keine ENTSO-E-Fallbackdaten gefunden.")
            return []
        return [normalize_df(df, "generation", "ENTSO-E", zone, "MW")]
    except Exception as exc:
        logging.warning("ENTSO-E Fallback konnte nicht geladen werden: %s", exc)
        return []


def build_unified_dataset(start: datetime, end: datetime, zone: str, enable_ggc: bool, enable_entsoe: bool) -> pd.DataFrame:
    frames = []

    if enable_ggc:
        frames.extend(fetch_primary_ggc(start, end, zone))

    if enable_entsoe:
        frames.extend(fetch_entsoe_fallback(start, end, zone))

    if not frames:
        raise RuntimeError("Keine Datenquellen konnten geladen werden. Prüfe die API-Keys und Parameter.")

    unified = pd.concat(frames, ignore_index=True)
    unified = unified.sort_values(["timestamp", "metric", "zone"]).reset_index(drop=True)
    return unified


def save_unified_dataframe(df: pd.DataFrame, output_file: str) -> Path:
    output_path = Path(__file__).resolve().parents[1] / "data" / output_file
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)
    return output_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Phase 2 Pipeline: GGC primär, ENTSO-E fallback")
    parser.add_argument("--from", dest="from_ts", type=parse_timestamp, help="Startzeitraum im ISO-Format")
    parser.add_argument("--to", dest="to_ts", type=parse_timestamp, help="Endzeitraum im ISO-Format")
    parser.add_argument("--zone", default=DEFAULT_ZONE, help="Bidding Zone / Zone code")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="CSV-Ausgabedatei")
    parser.add_argument("--no-ggc", action="store_true", help="GGC-Daten nicht abrufen")
    parser.add_argument("--no-entsoe", action="store_true", help="ENTSO-E-Daten nicht abrufen")
    parser.add_argument("--backfill-days", type=int, help="Backfill mehrere Tage im angegebenen Zeitraum")
    parser.add_argument("--verbose", action="store_true", help="Detaillierte Ausgabe")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(levelname)s: %(message)s")

    end = args.to_ts or datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    start = args.from_ts or (end - timedelta(hours=24))
    if start >= end:
        raise SystemExit("Startzeit muss vor Endzeit liegen.")

    if args.backfill_days:
        if args.backfill_days < 1:
            raise SystemExit("--backfill-days muss mindestens 1 sein.")
        total_hours = timedelta(days=args.backfill_days)
        start = end - total_hours

    logging.info("Starte Phase-2-Pipeline: %s bis %s für Zone %s", start.isoformat(), end.isoformat(), args.zone)
    unified = build_unified_dataset(start, end, args.zone, not args.no_ggc, not args.no_entsoe)

    output_path = save_unified_dataframe(unified, args.output)
    logging.info("Gespeichert: %s", output_path)
    logging.info("Datensätze insgesamt: %d", len(unified))


if __name__ == "__main__":
    main()
