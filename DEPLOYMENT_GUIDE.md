# Rewind Ventures - GitHub Pages + GoDaddy Deployment Guide

## Overview

This website is configured for **static deployment** via GitHub Pages with:
- ✅ Form submissions to Google Sheets (instead of a backend database)
- ✅ HashRouter for GitHub Pages URL compatibility
- ✅ CNAME file for GoDaddy custom domain
- ✅ Image upload feature removed from consultation form

---

## Pre-Deployment Checklist

- [ ] Google Sheet created with `leads` and `consultations` tabs
- [ ] Google Apps Script deployed as web app
- [ ] `REACT_APP_GOOGLE_SCRIPT_URL` added to `.env`
- [ ] Build created with `yarn build`
- [ ] Code pushed to GitHub
- [ ] GitHub Pages enabled
- [ ] GoDaddy DNS configured

---

## Step 1: Set Up Google Sheets (Your "Database")

See [GOOGLE_SHEETS_SETUP.md](./GOOGLE_SHEETS_SETUP.md) for detailed instructions.

**Quick Summary:**
1. Create a Google Sheet with tabs: `leads` and `consultations`
2. Add Google Apps Script (code provided in setup guide)
3. Deploy as web app → get URL like `https://script.google.com/macros/s/xxx/exec`
4. Add URL to `/app/frontend/.env`:
   ```
   REACT_APP_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/YOUR_ID/exec
   ```

---

## Step 2: Build the Website

```bash
cd /app/frontend
yarn build
```

This creates a `build/` folder with all static files.

---

## Step 3: Push to GitHub

```bash
# If not already a git repo
git init
git add .
git commit -m "Prepare for GitHub Pages deployment"

# Add your GitHub repo as remote
git remote add origin https://github.com/YOUR_USERNAME/rewind-ventures.git
git push -u origin main
```

---

## Step 4: Enable GitHub Pages

1. Go to your GitHub repository
2. Click **Settings** → **Pages**
3. Under "Source", select:
   - **Branch**: `main` (or `gh-pages` if you prefer)
   - **Folder**: `/root` or `/docs` (you may need to move build files)

### Option A: Deploy from `/docs` folder (Recommended)

```bash
# Copy build to docs folder
cp -r frontend/build docs
git add docs
git commit -m "Add docs folder for GitHub Pages"
git push
```

Then in GitHub Pages settings, select `main` branch and `/docs` folder.

### Option B: Use GitHub Actions (gh-pages branch)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install and Build
        run: |
          cd frontend
          yarn install
          yarn build
          
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./frontend/build
```

---

## Step 5: Configure GoDaddy DNS

1. Log in to GoDaddy
2. Go to **My Products** → **DNS** for your domain

### For apex domain (rewind-ventures.com):

Add these **A Records**:
| Type | Host | Points to | TTL |
|------|------|-----------|-----|
| A | @ | 185.199.108.153 | 1 hour |
| A | @ | 185.199.109.153 | 1 hour |
| A | @ | 185.199.110.153 | 1 hour |
| A | @ | 185.199.111.153 | 1 hour |

### For www subdomain:

Add a **CNAME Record**:
| Type | Host | Points to | TTL |
|------|------|-----------|-----|
| CNAME | www | YOUR_USERNAME.github.io | 1 hour |

### Verify CNAME file

Make sure `/app/CNAME` contains just your domain:
```
rewind-ventures.com
```

This file should be in your build output.

---

## Step 6: Enable HTTPS (GitHub Pages)

1. In GitHub repo **Settings** → **Pages**
2. Check "Enforce HTTPS"
3. Wait for certificate to be issued (can take up to 24 hours)

---

## Folder Structure After Setup

```
rewind-ventures/
├── frontend/
│   ├── src/
│   ├── build/          # Generated static files
│   ├── .env            # Contains REACT_APP_GOOGLE_SCRIPT_URL
│   └── package.json
├── CNAME               # Your domain
├── GOOGLE_SHEETS_SETUP.md
├── DEPLOYMENT_GUIDE.md (this file)
└── docs/               # Copy of build/ for GitHub Pages
```

---

## Troubleshooting

### Forms not submitting data
- Check browser console for errors
- Verify `REACT_APP_GOOGLE_SCRIPT_URL` is set correctly
- Check Google Apps Script execution logs

### 404 errors on page refresh
- This is normal with client-side routing
- The HashRouter (`/#/consultation`) prevents this issue
- If using BrowserRouter, you need a custom 404.html redirect

### Custom domain not working
- DNS changes can take up to 48 hours to propagate
- Verify A records and CNAME are correct
- Check GitHub Pages settings shows your domain

### HTTPS not working
- Wait up to 24 hours for certificate
- Ensure CNAME file is in the build output
- Check "Enforce HTTPS" is enabled in GitHub settings

---

## Email Notifications (Optional)

If you want email notifications when forms are submitted:

### Option 1: Google Apps Script (Free)
Uncomment the `sendEmailNotification` function in your Apps Script.

### Option 2: Resend API
Add your Resend API key to the Apps Script (see GOOGLE_SHEETS_SETUP.md).

---

## Support

For questions about:
- **This website**: hello@rewind-ventures.com
- **GitHub Pages**: [GitHub Docs](https://docs.github.com/en/pages)
- **GoDaddy DNS**: [GoDaddy Help](https://www.godaddy.com/help)
