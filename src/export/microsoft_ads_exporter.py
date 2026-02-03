import pandas as pd

MATCH_TYPE_MAP = {
    "Exact match": "Exact",
    "Exact": "Exact",
    "Phrase match": "Phrase",
    "Phrase": "Phrase",
    "Broad match": "Broad",
    "Broad": "Broad",
}


def export_microsoft_ads_csv(df: pd.DataFrame) -> str:
    out = pd.DataFrame()
    out["Type"] = "Keyword"
    out["Status"] = "Active"
    out["Campaign"] = df["campaign"].values
    out["Ad Group"] = df["ad_group"].values
    out["Keyword"] = df["keyword"].values
    out["Match Type"] = (
        df["match_type"].map(MATCH_TYPE_MAP).fillna("Broad").values
    )
    out["Bid"] = df["target_cpc"].map(lambda x: f"{x:.2f}").values
    return out.to_csv(index=False)
