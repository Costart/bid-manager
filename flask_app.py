import io
import os

import pandas as pd
from flask import Flask, Response, jsonify, render_template, request, session

from src.calculation.bid_calculator import (
    BidParams,
    calculate_bids,
    compute_aggregate_stats,
)
from src.export.microsoft_ads_exporter import export_microsoft_ads_csv
from src.ingestion.google_ads_parser import parse_google_ads_csv

app = Flask(__name__)
app.secret_key = os.urandom(24)

# In-memory storage (per-session would need Redis/DB in production)
data_store = {
    "raw_df": None,
    "result_df": None,
    "overrides": {},
}


def get_params_from_request():
    return BidParams(
        profit_margin=float(request.form.get("profit_margin", 30)) / 100.0,
        bid_floor=float(request.form.get("bid_floor", 0.10)),
        bid_cap=float(request.form.get("bid_cap", 50.00)),
        min_clicks=int(request.form.get("min_clicks", 50)),
    )


@app.route("/")
def index():
    return render_template(
        "index.html",
        data=None,
        stats=None,
        campaigns=[],
        ad_groups=[],
        overrides=data_store["overrides"],
    )


@app.route("/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    try:
        content = io.StringIO(file.read().decode("utf-8-sig"))
        data_store["raw_df"] = parse_google_ads_csv(content)

        params = get_params_from_request()
        data_store["result_df"] = calculate_bids(
            data_store["raw_df"], params, data_store["overrides"]
        )

        return jsonify({"success": True, "count": len(data_store["result_df"])})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/calculate", methods=["POST"])
def calculate():
    if data_store["raw_df"] is None:
        return jsonify({"error": "No data uploaded"}), 400

    params = get_params_from_request()
    data_store["result_df"] = calculate_bids(
        data_store["raw_df"], params, data_store["overrides"]
    )

    return jsonify({"success": True})


@app.route("/data", methods=["GET"])
def get_data():
    if data_store["result_df"] is None:
        return jsonify({"data": [], "stats": None, "campaigns": [], "ad_groups": []})

    df = data_store["result_df"].copy()

    # Apply filters
    campaign_filter = request.args.get("campaign", "")
    ad_group_filter = request.args.get("ad_group", "")

    if campaign_filter:
        df = df[df["campaign"] == campaign_filter]
    if ad_group_filter:
        df = df[df["ad_group"] == ad_group_filter]

    stats = compute_aggregate_stats(df)

    # Get unique campaigns and ad groups for filters
    all_campaigns = sorted(data_store["result_df"]["campaign"].unique().tolist())
    all_ad_groups = sorted(df["ad_group"].unique().tolist()) if len(df) > 0 else []

    # Prepare data for display
    display_cols = [
        "keyword",
        "match_type",
        "campaign",
        "ad_group",
        "clicks",
        "conversions",
        "conversion_value",
        "current_max_cpc",
        "target_cpc",
        "bid_delta",
        "profitability",
        "insufficient_data",
    ]
    display = df[[c for c in display_cols if c in df.columns]].copy()

    # Convert to records
    records = display.to_dict(orient="records")

    return jsonify(
        {
            "data": records,
            "stats": stats,
            "campaigns": all_campaigns,
            "ad_groups": all_ad_groups,
        }
    )


@app.route("/override", methods=["POST"])
def set_override():
    data = request.json
    key = data.get("key")
    bid = data.get("bid")

    if key and bid is not None:
        data_store["overrides"][key] = float(bid)

        # Recalculate
        if data_store["raw_df"] is not None:
            params = BidParams(
                profit_margin=float(data.get("profit_margin", 30)) / 100.0,
                bid_floor=float(data.get("bid_floor", 0.10)),
                bid_cap=float(data.get("bid_cap", 50.00)),
                min_clicks=int(data.get("min_clicks", 50)),
            )
            data_store["result_df"] = calculate_bids(
                data_store["raw_df"], params, data_store["overrides"]
            )

    return jsonify({"success": True, "overrides": data_store["overrides"]})


@app.route("/override/remove", methods=["POST"])
def remove_override():
    data = request.json
    key = data.get("key")

    if key in data_store["overrides"]:
        del data_store["overrides"][key]

        # Recalculate
        if data_store["raw_df"] is not None:
            params = BidParams(
                profit_margin=float(data.get("profit_margin", 30)) / 100.0,
                bid_floor=float(data.get("bid_floor", 0.10)),
                bid_cap=float(data.get("bid_cap", 50.00)),
                min_clicks=int(data.get("min_clicks", 50)),
            )
            data_store["result_df"] = calculate_bids(
                data_store["raw_df"], params, data_store["overrides"]
            )

    return jsonify({"success": True, "overrides": data_store["overrides"]})


@app.route("/export", methods=["GET"])
def export():
    if data_store["result_df"] is None:
        return "No data to export", 400

    export_all = request.args.get("all", "false") == "true"
    campaign_filter = request.args.get("campaign", "")
    ad_group_filter = request.args.get("ad_group", "")

    df = data_store["result_df"].copy()

    if not export_all:
        if campaign_filter:
            df = df[df["campaign"] == campaign_filter]
        if ad_group_filter:
            df = df[df["ad_group"] == ad_group_filter]

    csv_str = export_microsoft_ads_csv(df)

    return Response(
        csv_str,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=microsoft_ads_bids.csv"},
    )


@app.route("/reset", methods=["POST"])
def reset():
    data_store["raw_df"] = None
    data_store["result_df"] = None
    data_store["overrides"] = {}
    return jsonify({"success": True})


if __name__ == "__main__":
    import sys

    # Disable debug mode to avoid reloader issues
    app.run(debug=False, host="127.0.0.1", port=5001, threaded=True)
