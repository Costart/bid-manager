import { Campaign } from "./types";

export const exportToGoogleAdsCSV = (campaigns: Campaign[]) => {
  const headers = [
    "Campaign",
    "Campaign Daily Budget",
    "Campaign Status",
    "Ad Group",
    "Ad Group Type",
    "Ad Group Status",
    "Keyword",
    "Criterion Type",
    "Dynamic Ad Target",
    "Ad Type",
    "Headline 1",
    "Headline 2",
    "Headline 3",
    "Headline 4",
    "Headline 5",
    "Description 1",
    "Description 2",
    "Description 3",
    "Final URL",
    "Path 1",
    "Path 2",
  ];

  const COLS = headers.length;
  const rows: string[][] = [];
  rows.push(headers);

  const emptyRow = () => new Array(COLS).fill("");

  campaigns.forEach((campaign) => {
    campaign.adGroups.forEach((adGroup) => {
      if (adGroup.isDSA) {
        const targetRow = emptyRow();
        targetRow[0] = campaign.name;
        targetRow[1] = "10";
        targetRow[2] = "Enabled";
        targetRow[3] = adGroup.name;
        targetRow[4] = "Dynamic";
        targetRow[5] = "Enabled";
        targetRow[8] = adGroup.landingPageUrl;
        rows.push(targetRow);

        const adRow = emptyRow();
        adRow[0] = campaign.name;
        adRow[2] = "Enabled";
        adRow[3] = adGroup.name;
        adRow[4] = "Dynamic";
        adRow[5] = "Enabled";
        adRow[9] = "Expanded dynamic search ad";
        adRow[15] = adGroup.descriptions[0] || "";
        adRow[16] = adGroup.descriptions[1] || "";
        rows.push(adRow);
      } else {
        adGroup.keywords.forEach((keyword) => {
          const row = emptyRow();
          row[0] = campaign.name;
          row[1] = "10";
          row[2] = "Enabled";
          row[3] = adGroup.name;
          row[4] = "";
          row[5] = "Enabled";
          row[6] = keyword;
          row[7] = "Phrase";
          rows.push(row);
        });

        let path1 = "";
        let path2 = "";
        try {
          const urlObj = new URL(adGroup.landingPageUrl);
          const segments = urlObj.pathname.split("/").filter(Boolean);
          if (segments.length > 0) path1 = segments[0].substring(0, 15);
          if (segments.length > 1) path2 = segments[1].substring(0, 15);
        } catch {
          // ignore url parsing error
        }

        const adRow = emptyRow();
        adRow[0] = campaign.name;
        adRow[2] = "Enabled";
        adRow[3] = adGroup.name;
        adRow[5] = "Enabled";
        adRow[9] = "Responsive search ad";
        adRow[10] = adGroup.headlines[0] || "";
        adRow[11] = adGroup.headlines[1] || "";
        adRow[12] = adGroup.headlines[2] || "";
        adRow[13] = adGroup.headlines[3] || "";
        adRow[14] = adGroup.headlines[4] || "";
        adRow[15] = adGroup.descriptions[0] || "";
        adRow[16] = adGroup.descriptions[1] || "";
        adRow[17] = adGroup.descriptions[2] || "";
        adRow[18] = adGroup.landingPageUrl;
        adRow[19] = path1;
        adRow[20] = path2;
        rows.push(adRow);
      }
    });
  });

  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => {
          const cellStr = String(cell || "");
          if (
            cellStr.includes(",") ||
            cellStr.includes('"') ||
            cellStr.includes("\n")
          ) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        })
        .join(","),
    )
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `google-ads-rsa-import-${Date.now()}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
