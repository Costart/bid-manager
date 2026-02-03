import pandas as pd


COLUMN_MAP = {
    "Campaign": "campaign",
    "Ad group": "ad_group",
    "Ad Group": "ad_group",
    "Keyword": "keyword",
    "Match type": "match_type",
    "Match Type": "match_type",
    "Max. CPC": "current_max_cpc",
    "Max CPC": "current_max_cpc",
    "Clicks": "clicks",
    "Impressions": "impressions",
    "Conversions": "conversions",
    "Conv. value": "conversion_value",
    "Conversion value": "conversion_value",
    "Conv. Value": "conversion_value",
    "Cost": "cost",
}

REQUIRED_INTERNAL = [
    "campaign", "ad_group", "keyword", "match_type",
    "clicks", "conversions", "conversion_value",
]

NUMERIC_COLS = [
    "current_max_cpc", "clicks", "impressions",
    "conversions", "conversion_value", "cost",
]


def _clean_numeric(series: pd.Series) -> pd.Series:
    return (
        series.astype(str)
        .str.replace(r"[$%,]", "", regex=True)
        .str.replace(",", "", regex=False)
        .str.replace('"', "", regex=False)
        .str.replace("=", "", regex=False)
        .str.strip()
        .replace({"": "0", " --": "0", "--": "0"})
        .astype(float)
    )


def parse_google_ads_csv(uploaded_file) -> pd.DataFrame:
    df = pd.read_csv(uploaded_file, encoding="utf-8-sig")
    df.columns = df.columns.str.strip()

    for c in ["Campaign", "campaign"]:
        if c in df.columns:
            df = df[df[c].notna() & (df[c].astype(str).str.lower() != "total")]
            break

    rename = {}
    for src, dst in COLUMN_MAP.items():
        if src in df.columns and dst not in rename.values():
            rename[src] = dst
    df = df.rename(columns=rename)

    missing = [c for c in REQUIRED_INTERNAL if c not in df.columns]
    if missing:
        cols = ", ".join(df.columns.tolist())
        raise ValueError(f"Missing required columns: {', '.join(missing)}. Found: {cols}")

    if "current_max_cpc" not in df.columns:
        df["current_max_cpc"] = 0.0

    for col in NUMERIC_COLS:
        if col in df.columns:
            df[col] = _clean_numeric(df[col])

    df["clicks"] = df["clicks"].astype(int)
    if "impressions" in df.columns:
        df["impressions"] = df["impressions"].astype(int)

    return df.reset_index(drop=True)
