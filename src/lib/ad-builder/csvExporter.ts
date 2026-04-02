import { Campaign } from "./types";

export const exportToGoogleAdsCSV = (campaigns: Campaign[]) => {
  const headers = [
    "Campaign",
    "Campaign Daily Budget",
    "Campaign Status",
    "Campaign Language",
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
    const langCode = campaign.language || "";

    campaign.adGroups.forEach((adGroup) => {
      if (adGroup.isDSA) {
        const targetRow = emptyRow();
        targetRow[0] = campaign.name;
        targetRow[1] = "10";
        targetRow[2] = "Enabled";
        targetRow[3] = langCode;
        targetRow[4] = adGroup.name;
        targetRow[5] = "Dynamic";
        targetRow[6] = "Enabled";
        targetRow[9] = adGroup.landingPageUrl;
        rows.push(targetRow);

        const adRow = emptyRow();
        adRow[0] = campaign.name;
        adRow[2] = "Enabled";
        adRow[3] = langCode;
        adRow[4] = adGroup.name;
        adRow[5] = "Dynamic";
        adRow[6] = "Enabled";
        adRow[10] = "Expanded dynamic search ad";
        adRow[16] = adGroup.descriptions[0] || "";
        adRow[17] = adGroup.descriptions[1] || "";
        rows.push(adRow);
      } else {
        adGroup.keywords.forEach((keyword) => {
          const row = emptyRow();
          row[0] = campaign.name;
          row[1] = "10";
          row[2] = "Enabled";
          row[3] = langCode;
          row[4] = adGroup.name;
          row[5] = "";
          row[6] = "Enabled";
          row[7] = keyword;
          row[8] = "Phrase";
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
        adRow[3] = langCode;
        adRow[4] = adGroup.name;
        adRow[6] = "Enabled";
        adRow[10] = "Responsive search ad";
        adRow[11] = adGroup.headlines[0] || "";
        adRow[12] = adGroup.headlines[1] || "";
        adRow[13] = adGroup.headlines[2] || "";
        adRow[14] = adGroup.headlines[3] || "";
        adRow[15] = adGroup.headlines[4] || "";
        adRow[16] = adGroup.descriptions[0] || "";
        adRow[17] = adGroup.descriptions[1] || "";
        adRow[18] = adGroup.descriptions[2] || "";
        adRow[19] = adGroup.landingPageUrl;
        adRow[20] = path1;
        adRow[21] = path2;
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
