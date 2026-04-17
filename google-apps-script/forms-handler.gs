/**
 * Rewind Ventures form handler.
 *
 * Use this as the existing enquiry/contact/consultation Apps Script.
 * Deploy as a Web App and use its URL for:
 *
 * REACT_APP_GOOGLE_SCRIPT_URL
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheetName = data.sheet || "leads";

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return jsonResponse({
        success: false,
        error: "Sheet not found: " + sheetName,
      });
    }

    let row;

    if (sheetName === "leads") {
      row = [
        data.timestamp || new Date().toISOString(),
        data.name || "",
        data.email || "",
        data.company || "",
        data.phone || "",
        data.message || "",
        data.source || "website",
      ];
    } else if (sheetName === "consultations") {
      row = [
        data.timestamp || new Date().toISOString(),
        data.name || "",
        data.email || "",
        data.company || "",
        data.details || "",
        data.area_sqft || "",
        data.facility_type || "",
        data.sports || "",
        data.facility_name || "",
        data.google_maps_url || "",
        data.source || "website",
      ];
    } else {
      row = [data.timestamp || new Date().toISOString(), JSON.stringify(data)];
    }

    sheet.appendRow(row);

    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse({ success: false, error: String(error) });
  }
}

function doGet() {
  return ContentService
    .createTextOutput("Rewind Ventures form handler is running")
    .setMimeType(ContentService.MimeType.TEXT);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
