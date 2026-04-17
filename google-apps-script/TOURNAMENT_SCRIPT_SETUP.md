# Pickleball Tournament Apps Script Setup

Use this when the enquiry form Apps Script should remain unchanged.

## 1. Create A Separate Apps Script Project

1. Log in as `thepicklepoint@gmail.com`.
2. Go to https://script.google.com.
3. Click `New project`.
4. Name it `Rewind Pickleball Tournament Handler`.

## 2. Paste The Tournament Handler

Paste the code from:

```text
google-apps-script/tournament-handler.gs
```

This is tournament-only. It does not affect the existing enquiry form Apps Script.

## 3. Set The Folder ID

Find:

```javascript
const TOURNAMENT_FOLDER_ID = "";
```

Set it to the Drive folder where tournament sheets should be created:

```javascript
const TOURNAMENT_FOLDER_ID = "YOUR_FOLDER_ID";
```

The folder must be owned by, or editable by, `thepicklepoint@gmail.com`.

## 4. Add Explicit OAuth Scopes

In Apps Script:

1. Click `Project Settings`.
2. Enable `Show "appsscript.json" manifest file in editor`.
3. Open `appsscript.json`.
4. Use the manifest from:

```text
google-apps-script/tournament-appsscript.json
```

or paste:

```json
{
  "timeZone": "Asia/Kolkata",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
  ]
}
```

## 5. Authorize Drive

1. Save the project.
2. Select the function `authorizeDriveOnce`.
3. Click `Run`.
4. Approve all permissions as `thepicklepoint@gmail.com`.

The function should finish without errors. It creates and trashes a temporary sheet to prove Drive and Sheets permissions are working.

## 6. Deploy As Web App

1. Click `Deploy` -> `New deployment`.
2. Select type: `Web app`.
3. Set:

```text
Execute as: Me
Who has access: Anyone
```

4. Deploy.
5. Copy the Web App URL ending in `/exec`.

## 7. Configure Local Frontend

In `frontend/.env.local`, keep the old enquiry form URL as-is if needed, and add:

```env
REACT_APP_TOURNAMENT_SCRIPT_URL=https://script.google.com/macros/s/YOUR_NEW_TOURNAMENT_DEPLOYMENT_ID/exec
```

Restart the dev server after changing `.env.local`.

## 8. Configure GitHub Pages

In GitHub repo settings:

```text
Settings -> Secrets and variables -> Actions -> New repository secret
```

Add:

```text
REACT_APP_TOURNAMENT_SCRIPT_URL
```

Value:

```text
https://script.google.com/macros/s/YOUR_NEW_TOURNAMENT_DEPLOYMENT_ID/exec
```

The existing `REACT_APP_GOOGLE_SCRIPT_URL` can stay unchanged for enquiry forms.

## Existing Enquiry Form Script

If you ever need the clean form-only version, use:

```text
google-apps-script/forms-handler.gs
```

and this manifest:

```text
google-apps-script/forms-appsscript.json
```
