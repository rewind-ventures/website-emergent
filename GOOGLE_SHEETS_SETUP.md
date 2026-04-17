# Google Sheets Setup for Rewind Ventures

This guide will help you set up Google Sheets as your "database" for form submissions.

## Step 1: Create Your Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it "Rewind Ventures Leads"
4. Create **two sheets** (tabs at the bottom):
   - `leads` - for contact form submissions
   - `consultations` - for consultation form submissions

### Sheet 1: "leads" columns
| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| timestamp | name | email | company | phone | message | source |

### Sheet 2: "consultations" columns
| A | B | C | D | E | F | G | H | I | J | K |
|---|---|---|---|---|---|---|---|---|---|---|
| timestamp | name | email | company | details | area_sqft | facility_type | sports | facility_name | google_maps_url | source |

## Step 2: Create the Google Apps Script

1. In your Google Sheet, go to **Extensions → Apps Script**
2. Delete any existing code and paste the combined form + tournament handler from:

   ```
   google-apps-script/rewind-form-and-tournament-handler.gs
   ```

   This keeps the existing `leads` and `consultations` form submission behavior, and adds tournament actions that create one new Google Sheet per tournament.

### Legacy form-only script

The original form-only script is kept below for reference. Use the combined script above for the tournament manager.

```javascript
// Google Apps Script for Rewind Ventures Form Submissions

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheetName = data.sheet || "leads";
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: "Sheet not found: " + sheetName }))
        .setMimeType(ContentService.MimeType.JSON);
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
        data.source || "website"
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
        data.source || "website"
      ];
    } else {
      // Generic fallback - add all data as JSON
      row = [
        data.timestamp || new Date().toISOString(),
        JSON.stringify(data)
      ];
    }
    
    sheet.appendRow(row);
    
    // Optional: Send email notification
    sendEmailNotification(data, sheetName);
    
    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput("Rewind Ventures Form Handler is running!")
    .setMimeType(ContentService.MimeType.TEXT);
}

// Optional: Email notification function
function sendEmailNotification(data, sheetName) {
  // Uncomment and configure to enable email notifications
  // Replace with your email address
  /*
  const recipientEmail = "hello@rewind-ventures.com";
  const subject = `New ${sheetName === 'leads' ? 'Lead' : 'Consultation'} from Rewind Ventures Website`;
  const body = `
New submission received:

Name: ${data.name}
Email: ${data.email}
Company: ${data.company}
${sheetName === 'consultations' ? `
Facility: ${data.facility_name}
Sports: ${data.sports}
Details: ${data.details}
` : `
Message: ${data.message}
`}
Timestamp: ${data.timestamp}
  `;
  
  MailApp.sendEmail(recipientEmail, subject, body);
  */
}
```

3. Click **Save** (Ctrl+S or Cmd+S)
4. Name the project "Rewind Ventures Form Handler"

## Step 3: Deploy as Web App

1. Click **Deploy → New deployment**
2. Click the gear icon ⚙️ next to "Select type" and choose **Web app**
3. Configure:
   - **Description**: "Form handler v1"
   - **Execute as**: "Me" (your email)
   - **Who has access**: "Anyone" (this allows your website to send data)
4. Click **Deploy**
5. **Authorize** the app when prompted (click through the warnings - it's your own script)
6. **Copy the Web App URL** - it looks like:
   ```
   https://script.google.com/macros/s/AKfycbx.../exec
   ```

## Step 4: Add the URL to Your Website

1. Open `/app/frontend/.env`
2. Add your Google Script URL:
   ```
   REACT_APP_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
   ```
3. The same URL is used by:
   - Contact form submissions
   - Consultation form submissions
   - Pickleball tournament creation, score syncing, and score locking
4. Rebuild your frontend:
   ```bash
   cd frontend && yarn build
   ```

## Step 5: Test It!

1. Open your website
2. Fill out the contact form
3. Check your Google Sheet - you should see a new row!
4. Open `/#/pickleball`
5. Create a tournament - a new Google Sheet should appear in the Google Drive account that deployed the Apps Script
6. Add teams, generate a draw, submit a score, then refresh the page - the score should remain locked

---

## Tournament Sheets

Each new tournament creates a separate spreadsheet owned by the account that deployed the Apps Script, for example `thepicklepoint@gmail.com`.

Each tournament spreadsheet contains:

| Tab | Purpose |
|---|---|
| `Summary` | Tournament name, date, courts, status, updated time |
| `Teams` | Player/team list and assigned group |
| `Matches` | Draw, courts, scores, lock status, referee submission metadata |
| `Standings` | Live standings for all-play-all or each group |
| `Qualifiers` | Playoff qualifiers once group matches are complete |
| `_state` | Hidden JSON state used by the website |

### Optional folder placement

By default, tournament sheets are created in the deploying account's My Drive. To force them into a specific folder:

1. Create/open the folder in Google Drive
2. Copy the folder ID from the URL
3. In `google-apps-script/rewind-form-and-tournament-handler.gs`, set:

```javascript
const TOURNAMENT_FOLDER_ID = "YOUR_FOLDER_ID";
```

4. Redeploy the Apps Script web app

---

## Troubleshooting

### "Form submission will be simulated"
This means the `REACT_APP_GOOGLE_SCRIPT_URL` is not set. Add it to your `.env` file.

### Submissions not appearing in the sheet
1. Make sure the sheet tabs are named exactly `leads` and `consultations`
2. Check the Apps Script execution logs: In Apps Script, go to **Executions** to see any errors

### CORS errors
Google Apps Script should handle CORS automatically. If you see errors, make sure you deployed with "Anyone" access.

---

## Optional: Email Notifications with Resend

If you want email notifications, you have two options:

### Option A: Use Google Apps Script's built-in MailApp
Uncomment the `sendEmailNotification` function in the Apps Script code above.

### Option B: Use Resend (if you have an API key)
You can modify the Apps Script to call Resend's API:

```javascript
function sendEmailNotification(data, sheetName) {
  const RESEND_API_KEY = "re_YOUR_API_KEY"; // Add your key
  
  const payload = {
    from: "Rewind Ventures <hello@rewind-ventures.com>",
    to: "hello@rewind-ventures.com",
    subject: `New ${sheetName === 'leads' ? 'Lead' : 'Consultation'} Submission`,
    html: `<p>New submission from ${data.name} (${data.email})</p>`
  };
  
  UrlFetchApp.fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + RESEND_API_KEY,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload)
  });
}
```

---

## GitHub Pages Deployment

After setting up Google Sheets, deploy to GitHub Pages:

1. Push your code to GitHub
2. Go to your repository **Settings → Pages**
3. Set source to "Deploy from a branch"
4. Select the branch with your `build` folder (usually `gh-pages` or `main`)
5. Your site will be live at `https://yourusername.github.io/repo-name/`

### Connect to GoDaddy Domain

1. In GoDaddy DNS settings, add:
   - **Type**: CNAME
   - **Host**: www
   - **Points to**: yourusername.github.io
   
2. Add an A record for the apex domain (@):
   - **Type**: A
   - **Host**: @
   - **Points to**: (GitHub's IPs - see [GitHub docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site))
     - 185.199.108.153
     - 185.199.109.153
     - 185.199.110.153
     - 185.199.111.153

3. The CNAME file in your repo should contain your domain:
   ```
   rewind-ventures.com
   ```
