import pandas as pd
import plotly.express as px
from pathlib import Path


def main():
    repo_root = Path(__file__).resolve().parents[1]
    data_path = repo_root / "data" / "sample_generation.csv"
    if not data_path.exists():
        print(f"Missing sample data at {data_path}")
        return

    df = pd.read_csv(data_path, parse_dates=["timestamp"] )
    df = df.sort_values("timestamp")

    country = "DE"
    dfc = df[df["country"] == country].set_index("timestamp")
    gen_cols = [c for c in ["wind", "solar", "fossil", "hydro", "nuclear", "other"] if c in dfc.columns]

    fig = px.area(dfc, x=dfc.index, y=gen_cols, labels={"value": "MW", "timestamp": "Time"},
                  title=f"Generation mix — {country}")

    out = Path(__file__).resolve().parent / "stacked_area.html"
    fig.write_html(out, include_plotlyjs='cdn')
    print(f"Wrote interactive chart to: {out}")


if __name__ == "__main__":
    main()
