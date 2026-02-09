# Rewind Ventures - Architecture Diagram

## Complete System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                         │
│                              REWIND VENTURES ARCHITECTURE                               │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────┐
                                    │   VISITOR   │
                                    │  (Browser)  │
                                    └──────┬──────┘
                                           │
                                           │ Types: rewind-ventures.com
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    DNS RESOLUTION                                       │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              GODADDY DNS                                         │   │
│  │                                                                                  │   │
│  │   A Records (@ → GitHub IPs):          CNAME Record:                            │   │
│  │   • 185.199.108.153                    • www → rewind-ventures.github.io        │   │
│  │   • 185.199.109.153                                                             │   │
│  │   • 185.199.110.153                    Email Records (preserved):               │   │
│  │   • 185.199.111.153                    • MX, SPF, DKIM for email                │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                           │                                             │
└───────────────────────────────────────────┼─────────────────────────────────────────────┘
                                            │
                                            │ Routes to GitHub's servers
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   HOSTING LAYER                                         │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                            GITHUB PAGES                                          │   │
│  │                                                                                  │   │
│  │   • Serves static files (HTML, CSS, JS)                                         │   │
│  │   • Free HTTPS certificate (Let's Encrypt)                                      │   │
│  │   • Global CDN (Fastly) for fast loading                                        │   │
│  │   • Checks CNAME file to verify domain ownership                                │   │
│  │                                                                                  │   │
│  │   Files served:                                                                  │   │
│  │   ├── index.html                                                                │   │
│  │   ├── static/js/main.xxxxx.js    (React app bundle)                            │   │
│  │   ├── static/css/main.xxxxx.css  (Styles)                                      │   │
│  │   └── CNAME                       (rewind-ventures.com)                         │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                           │                                             │
└───────────────────────────────────────────┼─────────────────────────────────────────────┘
                                            │
                                            │ Serves React SPA
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                  FRONTEND APPLICATION                                   │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         REACT SINGLE PAGE APP (SPA)                              │   │
│  │                                                                                  │   │
│  │   Router: HashRouter (URLs like /#/consultation)                                │   │
│  │                                                                                  │   │
│  │   ┌─────────────────┐         ┌─────────────────────┐                           │   │
│  │   │  Landing Page   │         │  Consultation Page  │                           │   │
│  │   │  (/)            │         │  (/#/consultation)  │                           │   │
│  │   │                 │         │                     │                           │   │
│  │   │  • Hero         │         │  • Contact Info     │                           │   │
│  │   │  • Services     │         │  • Sport Selection  │                           │   │
│  │   │  • How We Work  │         │  • Location/Maps    │                           │   │
│  │   │  • Proof        │         │  • Submit Form      │                           │   │
│  │   │  • FAQ          │         │                     │                           │   │
│  │   │  • Contact Form │         │                     │                           │   │
│  │   └────────┬────────┘         └──────────┬──────────┘                           │   │
│  │            │                              │                                      │   │
│  │            │      Form Submissions        │                                      │   │
│  │            └──────────────┬───────────────┘                                      │   │
│  │                           │                                                      │   │
│  │                           ▼                                                      │   │
│  │            ┌──────────────────────────────┐                                      │   │
│  │            │   googleSheets.js helper     │                                      │   │
│  │            │   submitToGoogleSheets()     │                                      │   │
│  │            └──────────────┬───────────────┘                                      │   │
│  │                           │                                                      │   │
│  └───────────────────────────┼──────────────────────────────────────────────────────┘   │
│                              │                                                          │
└──────────────────────────────┼──────────────────────────────────────────────────────────┘
                               │
                               │ POST request with form data
                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                  DATA STORAGE LAYER                                     │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         GOOGLE APPS SCRIPT                                       │   │
│  │                         (Web App / API Endpoint)                                 │   │
│  │                                                                                  │   │
│  │   URL: https://script.google.com/macros/s/AKfycby.../exec                       │   │
│  │                                                                                  │   │
│  │   • Receives POST requests from website                                         │   │
│  │   • Parses JSON data                                                            │   │
│  │   • Routes to correct sheet based on "sheet" parameter                          │   │
│  │   • Appends row to Google Sheet                                                 │   │
│  │   • Returns success/error response                                              │   │
│  │                                                                                  │   │
│  └──────────────────────────────────┬──────────────────────────────────────────────┘   │
│                                     │                                                   │
│                                     │ Writes data                                       │
│                                     ▼                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         GOOGLE SHEETS                                            │   │
│  │                         "Rewind Ventures Leads"                                  │   │
│  │                                                                                  │   │
│  │   ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │   │  Tab: "leads"                                                           │   │   │
│  │   │  ┌───────────┬──────┬─────────┬─────────┬───────┬─────────┬────────┐   │   │   │
│  │   │  │ timestamp │ name │ email   │ company │ phone │ message │ source │   │   │   │
│  │   │  ├───────────┼──────┼─────────┼─────────┼───────┼─────────┼────────┤   │   │   │
│  │   │  │ 2026-02.. │ John │ j@x.com │ Acme    │ +91.. │ Need... │ landing│   │   │   │
│  │   │  └───────────┴──────┴─────────┴─────────┴───────┴─────────┴────────┘   │   │   │
│  │   └─────────────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                                  │   │
│  │   ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │   │  Tab: "consultations"                                                   │   │   │
│  │   │  ┌───────────┬──────┬───────┬─────────┬────────┬────────┬─────────┐    │   │   │
│  │   │  │ timestamp │ name │ email │ company │ sports │ area   │ maps_url│... │   │   │
│  │   │  ├───────────┼──────┼───────┼─────────┼────────┼────────┼─────────┤    │   │   │
│  │   │  │ 2026-02.. │ Jane │ j@y.. │ Sports..│ pickle │ 15000  │ https..│... │   │   │
│  │   │  └───────────┴──────┴───────┴─────────┴────────┴────────┴─────────┘    │   │   │
│  │   └─────────────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════════════════
                              DEVELOPMENT & DEPLOYMENT WORKFLOW
═══════════════════════════════════════════════════════════════════════════════════════════


┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│             │      │             │      │             │      │             │
│  EMERGENT   │ ───► │   GITHUB    │ ───► │   GITHUB    │ ───► │   GITHUB    │
│   (IDE)     │      │   (Repo)    │      │   ACTIONS   │      │   PAGES     │
│             │      │             │      │   (CI/CD)   │      │  (Hosting)  │
└─────────────┘      └─────────────┘      └─────────────┘      └─────────────┘
      │                    │                    │                    │
      │                    │                    │                    │
      ▼                    ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│ Edit code   │      │ Store       │      │ 1. Checkout │      │ Serve       │
│ & content   │      │ source code │      │ 2. yarn     │      │ static      │
│             │      │ & history   │      │    install  │      │ files to    │
│ Click       │      │             │      │ 3. yarn     │      │ visitors    │
│ "Save to    │      │ Triggers    │      │    build    │      │             │
│  GitHub"    │      │ workflow    │      │ 4. Deploy   │      │ ~2 min      │
│             │      │ on push     │      │    to Pages │      │ after push  │
└─────────────┘      └─────────────┘      └─────────────┘      └─────────────┘


═══════════════════════════════════════════════════════════════════════════════════════════
                                    VISITOR JOURNEY
═══════════════════════════════════════════════════════════════════════════════════════════


    ┌──────────────────────────────────────────────────────────────────────────────────┐
    │                                                                                  │
    │   1. DISCOVER                    2. EXPLORE                    3. CONVERT       │
    │                                                                                  │
    │   ┌─────────────┐               ┌─────────────┐               ┌─────────────┐   │
    │   │             │               │             │               │             │   │
    │   │  Types URL  │    ─────►    │  Browses    │    ─────►    │  Fills out  │   │
    │   │  or clicks  │               │  Services,  │               │  Contact or │   │
    │   │  link       │               │  FAQ, Proof │               │  Consult    │   │
    │   │             │               │             │               │  Form       │   │
    │   └─────────────┘               └─────────────┘               └──────┬──────┘   │
    │                                                                      │          │
    │                                                                      │          │
    │                                                                      ▼          │
    │                                                               ┌─────────────┐   │
    │                                                               │             │   │
    │   4. YOU RESPOND                                              │  Data saved │   │
    │                                                               │  to Google  │   │
    │   ┌─────────────┐                                             │  Sheets     │   │
    │   │             │               ┌─────────────┐               │             │   │
    │   │  Check your │    ◄─────    │  You get    │    ◄─────    │  Success    │   │
    │   │  Google     │               │  notified   │               │  message    │   │
    │   │  Sheet      │               │  (optional) │               │  shown      │   │
    │   │             │               │             │               │             │   │
    │   └─────────────┘               └─────────────┘               └─────────────┘   │
    │                                                                                  │
    └──────────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════════════════
                                    TECHNOLOGY STACK
═══════════════════════════════════════════════════════════════════════════════════════════


    ┌────────────────────────────────────────────────────────────────────────────────┐
    │                                                                                │
    │   FRONTEND                          BACKEND/DATA          INFRASTRUCTURE       │
    │   ─────────                         ────────────          ──────────────       │
    │                                                                                │
    │   • React 19                        • Google Sheets       • GitHub Pages       │
    │   • React Router (HashRouter)       • Google Apps Script  • GitHub Actions     │
    │   • Tailwind CSS                    • (No server needed!) • GoDaddy DNS        │
    │   • Radix UI Components                                   • Fastly CDN         │
    │   • React Hook Form                                       • Let's Encrypt SSL  │
    │   • Zod (validation)                                                           │
    │   • Lucide Icons                                                               │
    │                                                                                │
    └────────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════════════════
                                    COST BREAKDOWN
═══════════════════════════════════════════════════════════════════════════════════════════


    ┌────────────────────────────────────────────────────────────────────────────────┐
    │                                                                                │
    │   SERVICE                           COST                                       │
    │   ───────                           ────                                       │
    │                                                                                │
    │   • GitHub Pages (hosting)          FREE                                       │
    │   • GitHub Actions (CI/CD)          FREE (2,000 mins/month)                    │
    │   • Google Sheets (database)        FREE                                       │
    │   • Google Apps Script (API)        FREE                                       │
    │   • Let's Encrypt SSL               FREE                                       │
    │   • GoDaddy Domain                  ~$12-20/year (only paid service)           │
    │   • Emergent (development)          Your plan                                  │
    │                                                                                │
    │   ─────────────────────────────────────────────────────────────────────────    │
    │   TOTAL RECURRING COST:             ~$12-20/year (domain only)                 │
    │                                                                                │
    └────────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════════════════
                                    KEY URLS & RESOURCES
═══════════════════════════════════════════════════════════════════════════════════════════


    ┌────────────────────────────────────────────────────────────────────────────────┐
    │                                                                                │
    │   YOUR WEBSITE                                                                 │
    │   • Live site:        https://rewind-ventures.com                              │
    │   • Consultation:     https://rewind-ventures.com/#/consultation               │
    │                                                                                │
    │   GITHUB                                                                       │
    │   • Repository:       https://github.com/rewind-ventures/website-emergent      │
    │   • Actions (builds): https://github.com/rewind-ventures/website-emergent/actions
    │   • Settings:         https://github.com/rewind-ventures/website-emergent/settings
    │                                                                                │
    │   GOOGLE                                                                       │
    │   • Sheets:           (Your Google Sheets with leads & consultations tabs)     │
    │   • Apps Script:      https://script.google.com (manage your web app)          │
    │                                                                                │
    │   GODADDY                                                                      │
    │   • DNS Management:   https://dcc.godaddy.com/manage/rewind-ventures.com/dns   │
    │                                                                                │
    └────────────────────────────────────────────────────────────────────────────────┘
```

## Simple Visual Summary

```
                                YOU (Developer)
                                      │
                                      │ Make changes
                                      ▼
                               ┌─────────────┐
                               │  EMERGENT   │
                               │    (IDE)    │
                               └──────┬──────┘
                                      │
                                      │ Save to GitHub
                                      ▼
                               ┌─────────────┐
                               │   GITHUB    │──────► Auto-build ──────► GITHUB PAGES
                               │    REPO     │         (2 mins)          (Hosting)
                               └─────────────┘                               │
                                                                             │
                                                                             ▼
                                                        ┌─────────────────────────────┐
                                                        │   rewind-ventures.com       │
                               GODADDY DNS ───────────► │   (Your Live Website)       │
                               (Points domain)          └──────────────┬──────────────┘
                                                                       │
                                                                       │ Form Submit
                                                                       ▼
                                                        ┌─────────────────────────────┐
                                                        │   GOOGLE SHEETS             │
                                                        │   (Your Lead Database)      │
                                                        └─────────────────────────────┘
```
