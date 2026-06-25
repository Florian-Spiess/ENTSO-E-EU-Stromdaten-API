from datetime import datetime, timedelta
from typing import Optional
from pathlib import Path
import os
import sys

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Header, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pandas as pd
from dotenv import load_dotenv
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

load_dotenv(HERE / ".env")

import ggc_data_fetcher as ggc_fetcher
import entsoe_data_fetcher as entsoe_fetcher
import unified_data_pipeline as phase2_data_pipeline

app = FastAPI(
    title="ENTSO-E Energy Data API",
    description="FastAPI-Backend mit ENTSO-E als primärer Datenquelle und optionalen GGC-Zusatzmetriken.",
    version="0.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

OPTIONAL_GGC_METRIC_PATHS = {
    "co2_intensity": "CO2-Intensität",
    "renewable_share": "Erneuerbarer Anteil",
    "co2_emissions": "CO2-Emissionen",
    "power": "Aktuelle Leistung",
}

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


def verify_backend_api_key(x_api_key: Optional[str] = Header(None)) -> None:
    backend_key = os.getenv("BACKEND_API_KEY")
    if backend_key and x_api_key != backend_key:
        raise HTTPException(status_code=401, detail="Ungültiger Backend-API-Key")


@app.exception_handler(RateLimitExceeded)
def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Bitte später erneut versuchen."},
    )


@app.options("/{full_path:path}")
def cors_preflight(full_path: str, request: Request) -> Response:
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "3600",
    }
    return Response(status_code=204, headers=headers)


def parse_iso_datetime(value: Optional[str], default: Optional[datetime] = None) -> datetime:
    if value is None:
        if default is not None:
            return default
        raise ValueError("Ein ISO-Zeitstempel muss angegeben werden.")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise ValueError(f"Ungültiges ISO-Datum: {value}")


def make_time_range(start: Optional[str], end: Optional[str]) -> tuple[datetime, datetime]:
    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    end_ts = parse_iso_datetime(end, now)
    start_ts = parse_iso_datetime(start, end_ts - timedelta(hours=24))
    if start_ts >= end_ts:
        raise ValueError("Startzeit muss vor Endzeit liegen.")
    return start_ts, end_ts


@app.get("/")
@limiter.limit("40/minute")
def root(request: Request, _api_key_valid: None = Depends(verify_backend_api_key)):
    return {
        "status": "ok",
        "service": "ENTSO-E Energy Data API",
        "message": "Verwende /entsoe/generation für Primärdaten und /unified für kombinierte Zeitreihen. GGC-Endpunkte sind optional als Zusatz verfügbar.",
    }


@app.get("/health")
@limiter.limit("40/minute")
def health(request: Request, _api_key_valid: None = Depends(verify_backend_api_key)):
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat() + "Z"}


@app.get("/ggc/metrics")
@limiter.limit("20/minute")
def optional_ggc_metrics(request: Request, _api_key_valid: None = Depends(verify_backend_api_key)):
    return [{"metric": metric, "description": description} for metric, description in OPTIONAL_GGC_METRIC_PATHS.items()]


@app.get("/ggc/{metric}")
@limiter.limit("15/minute")
def optional_ggc_metric(
    request: Request,
    metric: str,
    _api_key_valid: None = Depends(verify_backend_api_key),
    zone: str = Query("DE", description="Zone code"),
    start: Optional[str] = Query(None, description="Startzeitpunkt im ISO-Format"),
    end: Optional[str] = Query(None, description="Endzeitpunkt im ISO-Format"),
):
    if metric not in OPTIONAL_GGC_METRIC_PATHS:
        raise HTTPException(status_code=404, detail=f"Unbekannte optionale GGC-Metrik: {metric}. Verwende /ggc/metrics.")

    try:
        start_ts, end_ts = make_time_range(start, end)
        if metric == "co2_intensity":
            df = ggc_fetcher.fetch_co2_intensity(start_ts, end_ts, zone)
        elif metric == "renewable_share":
            df = ggc_fetcher.fetch_renewable_share(start_ts, end_ts, zone)
        elif metric == "co2_emissions":
            df = ggc_fetcher.fetch_co2_emissions(start_ts, end_ts, zone)
        elif metric == "power":
            df = ggc_fetcher.fetch_power(start_ts, end_ts, zone)
        else:
            raise HTTPException(status_code=404, detail=f"Der Endpunkt für {metric} ist noch nicht implementiert.")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return df.to_dict(orient="records")


@app.get("/ggc/co2-intensity")
@limiter.limit("10/minute")
def optional_ggc_co2_intensity(
    request: Request,
    _api_key_valid: None = Depends(verify_backend_api_key),
    zone: str = Query("DE", description="Zone code"),
    start: Optional[str] = Query(None, description="Startzeitpunkt im ISO-Format"),
    end: Optional[str] = Query(None, description="Endzeitpunkt im ISO-Format"),
):
    try:
        start_ts, end_ts = make_time_range(start, end)
        df = ggc_fetcher.fetch_co2_intensity(start_ts, end_ts, zone)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return df.to_dict(orient="records")


@app.get("/ggc/renewable-share")
@limiter.limit("10/minute")
def optional_ggc_renewable_share(
    request: Request,
    _api_key_valid: None = Depends(verify_backend_api_key),
    zone: str = Query("DE", description="Zone code"),
    start: Optional[str] = Query(None, description="Startzeitpunkt im ISO-Format"),
    end: Optional[str] = Query(None, description="Endzeitpunkt im ISO-Format"),
):
    try:
        start_ts, end_ts = make_time_range(start, end)
        df = ggc_fetcher.fetch_renewable_share(start_ts, end_ts, zone)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return df.to_dict(orient="records")


@app.get("/entsoe/generation")
@limiter.limit("5/minute")
def entsoe_generation(
    request: Request,
    _api_key_valid: None = Depends(verify_backend_api_key),
    zone: str = Query("10Y1001A1001A83F", description="ENTSO-E bidding zone code"),
    start: Optional[str] = Query(None, description="Startzeitpunkt im ISO-Format"),
    end: Optional[str] = Query(None, description="Endzeitpunkt im ISO-Format"),
):
    try:
        start_ts, end_ts = make_time_range(start, end)
        token = os.getenv("ENTSOE_API_KEY")
        if not token:
            raise RuntimeError("ENTSOE_API_KEY ist nicht gesetzt.")
        df = entsoe_fetcher.fetch_entsoe_generation(zone, start_ts, end_ts, token)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return df.to_dict(orient="records")


@app.get("/entsoe/generation-per-plant")
@limiter.limit("5/minute")
def entsoe_generation_per_plant(
    request: Request,
    _api_key_valid: None = Depends(verify_backend_api_key),
    zone: str = Query("10Y1001A1001A83F", description="ENTSO-E bidding zone code"),
    start: Optional[str] = Query(None, description="Startzeitpunkt im ISO-Format"),
    end: Optional[str] = Query(None, description="Endzeitpunkt im ISO-Format"),
):
    try:
        start_ts, end_ts = make_time_range(start, end)
        token = os.getenv("ENTSOE_API_KEY")
        if not token:
            raise RuntimeError("ENTSOE_API_KEY ist nicht gesetzt.")
        df = entsoe_fetcher.fetch_entsoe_generation_per_plant(zone, start_ts, end_ts, token)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return df.to_dict(orient="records")


@app.get("/entsoe/consumption")
@limiter.limit("5/minute")
def entsoe_consumption(
    request: Request,
    _api_key_valid: None = Depends(verify_backend_api_key),
    zone: str = Query("10Y1001A1001A83F", description="ENTSO-E bidding zone code"),
    start: Optional[str] = Query(None, description="Startzeitpunkt im ISO-Format"),
    end: Optional[str] = Query(None, description="Endzeitpunkt im ISO-Format"),
):
    try:
        start_ts, end_ts = make_time_range(start, end)
        token = os.getenv("ENTSOE_API_KEY")
        if not token:
            raise RuntimeError("ENTSOE_API_KEY ist nicht gesetzt.")
        df = entsoe_fetcher.fetch_entsoe_consumption(zone, start_ts, end_ts, token)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return df.to_dict(orient="records")


@app.get("/entsoe/prices")
@limiter.limit("5/minute")
def entsoe_prices(
    request: Request,
    _api_key_valid: None = Depends(verify_backend_api_key),
    zone: str = Query("10Y1001A1001A83F", description="ENTSO-E bidding zone code"),
    start: Optional[str] = Query(None, description="Startzeitpunkt im ISO-Format"),
    end: Optional[str] = Query(None, description="Endzeitpunkt im ISO-Format"),
):
    try:
        start_ts, end_ts = make_time_range(start, end)
        token = os.getenv("ENTSOE_API_KEY")
        if not token:
            raise RuntimeError("ENTSOE_API_KEY ist nicht gesetzt.")
        df = entsoe_fetcher.fetch_entsoe_day_ahead_prices(zone, start_ts, end_ts, token)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return df.to_dict(orient="records")


@app.get("/unified")
@limiter.limit("10/minute")
def unified_data(
    request: Request,
    _api_key_valid: None = Depends(verify_backend_api_key),
    zone: str = Query("10Y1001A1001A83F", description="ENTSO-E bidding zone code"),
    start: Optional[str] = Query(None, description="Startzeitpunkt im ISO-Format"),
    end: Optional[str] = Query(None, description="Endzeitpunkt im ISO-Format"),
    include_entsoe: bool = Query(True, description="ENTSO-E als primäre Datenquelle einbeziehen"),
    include_ggc: bool = Query(False, description="Optionale GGC-Metriken zusätzlich einbeziehen"),
):
    try:
        start_ts, end_ts = make_time_range(start, end)
        df = phase2_data_pipeline.build_unified_dataset(
            start_ts,
            end_ts,
            zone,
            enable_ggc=include_ggc,
            enable_entsoe=include_entsoe,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return df.to_dict(orient="records")
