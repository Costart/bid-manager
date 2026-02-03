import streamlit as st
import pandas as pd
from src.ingestion.google_ads_parser import parse_google_ads_csv
from src.calculation.bid_calculator import calculate_bids, BidParams, compute_aggregate_stats
from src.export.microsoft_ads_exporter import export_microsoft_ads_csv

st.set_page_config(page_title="Bid Manager", layout="wide")
st.title("Bid Manager — Google Ads to Microsoft Ads")

# ── Sidebar ──────────────────────────────────────────────
with st.sidebar:
    st.header("Settings")
    uploaded = st.file_uploader("Upload Google Ads CSV", type=["csv"])

    profit_margin = st.slider(
        "Profit Margin %", min_value=0, max_value=90, value=30, step=1
    ) / 100.0

    bid_floor = st.number_input("Bid Floor ($)", value=0.10, step=0.05, format="%.2f")
    bid_cap = st.number_input("Bid Cap ($)", value=50.00, step=1.00, format="%.2f")
    min_clicks = st.number_input("Min Clicks (data threshold)", value=50, step=10)

# ── Session state init ───────────────────────────────────
if "overrides" not in st.session_state:
    st.session_state.overrides = {}
if "raw_df" not in st.session_state:
    st.session_state.raw_df = None

# ── Parse upload ─────────────────────────────────────────
if uploaded is not None:
    try:
        st.session_state.raw_df = parse_google_ads_csv(uploaded)
    except ValueError as e:
        st.error(str(e))
        st.stop()

if st.session_state.raw_df is None:
    st.info("Upload a Google Ads keyword report CSV to get started.")
    st.stop()

# ── Calculate bids ───────────────────────────────────────
params = BidParams(
    profit_margin=profit_margin,
    bid_floor=bid_floor,
    bid_cap=bid_cap,
    min_clicks=int(min_clicks),
)
result = calculate_bids(st.session_state.raw_df, params, st.session_state.overrides)

# ── Filters ──────────────────────────────────────────────
col1, col2 = st.columns(2)
with col1:
    campaigns = st.multiselect(
        "Filter Campaigns",
        options=sorted(result["campaign"].unique()),
        default=[],
    )
with col2:
    ad_groups_opts = sorted(result["ad_group"].unique()) if not campaigns else sorted(
        result[result["campaign"].isin(campaigns)]["ad_group"].unique()
    )
    ad_groups = st.multiselect("Filter Ad Groups", options=ad_groups_opts, default=[])

filtered = result.copy()
if campaigns:
    filtered = filtered[filtered["campaign"].isin(campaigns)]
if ad_groups:
    filtered = filtered[filtered["ad_group"].isin(ad_groups)]

# ── Color-coded table ────────────────────────────────────
st.subheader(f"Keyword Bids ({len(filtered)} keywords)")

display_cols = [
    "keyword", "match_type", "campaign", "ad_group", "clicks",
    "conversions", "conversion_value", "current_max_cpc",
    "target_cpc", "bid_delta", "profitability", "insufficient_data",
]
display = filtered[[c for c in display_cols if c in filtered.columns]].copy()


def color_row(row):
    if row.get("insufficient_data"):
        return ["background-color: #fff3cd"] * len(row)
    if row.get("profitability") == "profitable":
        return ["background-color: #d4edda"] * len(row)
    if row.get("profitability") == "marginal":
        return ["background-color: #fff3cd"] * len(row)
    return ["background-color: #f8d7da"] * len(row)


styled = display.style.apply(color_row, axis=1).format({
    "current_max_cpc": "${:.2f}",
    "target_cpc": "${:.2f}",
    "bid_delta": "${:+.2f}",
    "conversion_value": "${:.2f}",
})
st.dataframe(styled, use_container_width=True, height=500)

# ── Override section ─────────────────────────────────────
with st.expander("Keyword Bid Overrides"):
    st.caption("Lock a specific keyword to a fixed bid.")
    override_options = (
        filtered["campaign"] + " | " + filtered["ad_group"]
        + " | " + filtered["keyword"] + " | " + filtered["match_type"]
    ).tolist()
    selected = st.selectbox("Select keyword to override", ["(none)"] + override_options)
    if selected != "(none)":
        parts = [p.strip() for p in selected.split("|")]
        key = "|".join(parts)
        current = st.session_state.overrides.get(key)
        new_bid = st.number_input(
            f"Override bid for: {selected}",
            value=current if current else float(filtered.iloc[0]["target_cpc"]),
            step=0.10,
            format="%.2f",
            key=f"override_{key}",
        )
        c1, c2 = st.columns(2)
        with c1:
            if st.button("Set Override"):
                st.session_state.overrides[key] = new_bid
                st.rerun()
        with c2:
            if key in st.session_state.overrides and st.button("Remove Override"):
                del st.session_state.overrides[key]
                st.rerun()

    if st.session_state.overrides:
        st.write("**Active overrides:**")
        for k, v in st.session_state.overrides.items():
            st.write(f"- {k}: ${v:.2f}")

# ── Review section ───────────────────────────────────────
with st.expander("Review Before Export", expanded=True):
    stats = compute_aggregate_stats(filtered)
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total Keywords", stats["total_keywords"])
    c2.metric("Avg Bid Change", f"${stats['avg_bid_change']:+.2f}")
    c3.metric("Bid Increases", stats["increases"])
    c4.metric("Bid Decreases", stats["decreases"])

    c5, c6, c7 = st.columns(3)
    c5.metric("Avg Target CPC", f"${stats['avg_target_cpc']:.2f}")
    c6.metric("Insufficient Data", stats["insufficient_data_count"])
    c7.metric("Total Current Cost", f"${stats['total_current_cost']:,.2f}")

    st.subheader("Bid Delta Distribution")
    chart_data = filtered["bid_delta"].dropna()
    st.bar_chart(chart_data.value_counts().sort_index())

# ── Export ────────────────────────────────────────────────
st.subheader("Export")
export_all = st.checkbox("Export all keywords (ignore filters)", value=False)
export_df = result if export_all else filtered

csv_str = export_microsoft_ads_csv(export_df)
st.download_button(
    label=f"Download Microsoft Ads Editor CSV ({len(export_df)} keywords)",
    data=csv_str,
    file_name="microsoft_ads_bids.csv",
    mime="text/csv",
)
