/**
 * Google Sheets Integration Helper
 * 
 * This file handles form submissions to Google Sheets via Google Apps Script.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Create a Google Sheet with columns matching your form fields
 * 2. Deploy the Google Apps Script (see /app/GOOGLE_SHEETS_SETUP.md)
 * 3. Replace the GOOGLE_SCRIPT_URL below with your deployed script URL
 */

// Replace this with your deployed Google Apps Script URL
// You'll get this URL after deploying the Apps Script as a web app
const GOOGLE_SCRIPT_URL = process.env.REACT_APP_GOOGLE_SCRIPT_URL || "";

/**
 * Submit data to Google Sheets via Apps Script
 * @param {Object} data - Form data to submit
 * @param {string} sheetName - Which sheet to write to ("leads" or "consultations")
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function submitToGoogleSheets(data, sheetName = "leads") {
  if (!GOOGLE_SCRIPT_URL) {
    console.warn("Google Script URL not configured. Form submission will be simulated.");
    // Simulate success for development/demo purposes
    return { success: true, message: "Form submitted (demo mode)" };
  }

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors", // Required for Google Apps Script
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sheet: sheetName,
        timestamp: new Date().toISOString(),
        ...data,
      }),
    });

    // With no-cors mode, we can't read the response
    // But if no error was thrown, we assume success
    return { success: true, message: "Form submitted successfully" };
  } catch (error) {
    console.error("Error submitting to Google Sheets:", error);
    return { success: false, message: error.message || "Submission failed" };
  }
}
