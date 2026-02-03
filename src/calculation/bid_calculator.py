from dataclasses import dataclass
import pandas as pd
import numpy as np


@dataclass
class BidParams:
    profit_margin: float  # 0.0 to 1.0
    bid_floor: float
    bid_cap: float
    min_clicks: int


def calculate_bids(
    df: pd.DataFrame,
    params: BidParams,
    overrides=None,
) -> pd.DataFrame:
    if overrides is None:
        overrides = {}

    result = df.copy()

    clicks = result["clicks"].replace(0, np.nan)
    result["conversion_rate"] = result["conversions"] / clicks
    result["value_per_click"] = result["conversion_value"] / clicks

    # target_cpc = (conv_value / clicks) * (conversions / clicks) * (1 - margin)
    result["raw_target_cpc"] = (
        result["conversion_value"]
        * result["conversion_rate"]
        * (1 - params.profit_margin)
        / clicks
    )

    result["insufficient_data"] = result["clicks"] < params.min_clicks

    # Ad group averages from sufficient-data keywords
    sufficient = result[~result["insufficient_data"] & result["raw_target_cpc"].notna()]
    ag_avg = (
        sufficient.groupby(["campaign", "ad_group"])["raw_target_cpc"]
        .mean()
        .rename("ag_avg_cpc")
    )
    result = result.merge(ag_avg, on=["campaign", "ad_group"], how="left")

    # Fill insufficient data with ad group average, then floor
    result["target_cpc"] = result["raw_target_cpc"]
    mask = result["insufficient_data"] | result["target_cpc"].isna()
    result.loc[mask, "target_cpc"] = result.loc[mask, "ag_avg_cpc"]
    result["target_cpc"] = result["target_cpc"].fillna(params.bid_floor)

    # Clamp
    result["target_cpc"] = result["target_cpc"].clip(
        lower=params.bid_floor, upper=params.bid_cap
    )

    # Apply overrides
    key = (
        result["campaign"] + "|" + result["ad_group"] + "|"
        + result["keyword"] + "|" + result["match_type"]
    )
    result["is_overridden"] = key.isin(overrides)
    for k, bid in overrides.items():
        result.loc[key == k, "target_cpc"] = bid

    result = result.drop(columns=["ag_avg_cpc"], errors="ignore")

    result["bid_delta"] = result["target_cpc"] - result["current_max_cpc"]

    # Profitability label
    conditions = [
        result["target_cpc"] >= result["current_max_cpc"],
        result["target_cpc"] >= result["current_max_cpc"] * 0.9,
    ]
    result["profitability"] = np.select(
        conditions, ["profitable", "marginal"], default="unprofitable"
    )

    for col in ["raw_target_cpc", "target_cpc", "bid_delta", "value_per_click"]:
        result[col] = result[col].round(2)
    result["conversion_rate"] = result["conversion_rate"].round(4)

    return result


def compute_aggregate_stats(df: pd.DataFrame) -> dict:
    return {
        "total_keywords": len(df),
        "avg_bid_change": round(df["bid_delta"].mean(), 2),
        "increases": int((df["bid_delta"] > 0).sum()),
        "decreases": int((df["bid_delta"] < 0).sum()),
        "unchanged": int((df["bid_delta"] == 0).sum()),
        "insufficient_data_count": int(df["insufficient_data"].sum()),
        "avg_target_cpc": round(df["target_cpc"].mean(), 2),
        "total_current_cost": round(df["cost"].sum(), 2) if "cost" in df.columns else 0,
    }
