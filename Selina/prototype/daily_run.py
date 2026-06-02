import os
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    script = root / "prototype" / "phase2_data_pipeline.py"
    if not script.exists():
        print(f"Fehler: {script} wurde nicht gefunden.")
        return 1

    end = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    start = end - timedelta(hours=24)
    output_file = "unified_energy_data.csv"

    env = os.environ.copy()
    env.setdefault("GGC_API_BASE_URL", "https://api.traxes.io/green-grid-compass")

    command = [sys.executable, str(script), "--from", start.isoformat(), "--to", end.isoformat(), "--output", output_file]
    print("Starte täglichen Datenabruf:")
    print(" ", "Start:", start.isoformat())
    print(" ", "Ende:", end.isoformat())
    print(" ", "Befehl:", " ".join(command))

    process = subprocess.run(command, cwd=root, env=env, capture_output=True, text=True)
    print(process.stdout)
    if process.returncode != 0:
        print(process.stderr)
        print("Täglicher Abruf fehlgeschlagen.")
        return process.returncode

    print(f"Täglicher Abruf erfolgreich. Output: {root / 'data' / output_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())