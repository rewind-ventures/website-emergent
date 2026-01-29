# Rewind Ventures — Backend Contracts (Leads)

## Context
The landing page currently uses **MOCK** data for marketing content in `frontend/src/mock.js`.
Form submissions were previously stored in **localStorage** (**MOCK**). This backend will replace that with MongoDB.

## Frontend mocked data (stays mocked)
**File:** `frontend/src/mock.js`
- `MOCK.brand.name`, `MOCK.brand.email`
- `MOCK.brand.calendlyUrl` (placeholder; user will update later)
- `MOCK.nav`, `MOCK.hero`, `MOCK.stats`, `MOCK.services`, `MOCK.outcomes`, `MOCK.testimonials`, `MOCK.faqs`, `MOCK.imagery`

## Data Model: Lead
Stored in MongoDB collection: `leads`

### Lead (stored/returned)
```json
{
  "id": "uuid",
  "name": "string",
  "company": "string",
  "email": "string",
  "phone": "string | null",
  "need": "string",
  "source": "landing_form",
  "status": "new",
  "created_at": "2025-08-01T12:34:56.000Z"
}
```

### LeadCreate (request)
```json
{
  "name": "string",
  "company": "string",
  "email": "string",
  "phone": "string | null",
  "need": "string",
  "source": "landing_form"
}
```

## API Endpoints (all prefixed with `/api`)
Base URL used by frontend: `process.env.REACT_APP_BACKEND_URL` + `/api`

### 1) Create lead
- **POST** `/api/leads`
- Body: `LeadCreate`
- Response: `Lead`
- Errors:
  - `422` validation errors

### 2) List leads (most recent first)
- **GET** `/api/leads?limit=25`
- Response: `Lead[]`

### 3) Update lead status (optional UI later)
- **PATCH** `/api/leads/{id}`
- Body:
```json
{ "status": "new|contacted|closed" }
```
- Response: `Lead`

### 4) Delete lead (optional admin)
- **DELETE** `/api/leads/{id}`
- Response:
```json
{ "ok": true }
```

## Frontend integration plan
**File:** `frontend/src/pages/Landing.jsx`
- Replace `loadLeads()` / `saveLead()` localStorage usage with API calls:
  - On mount: `GET /api/leads?limit=6` for “Recent inquiries”
  - On submit: `POST /api/leads` then prepend result to UI list
- Keep toast feedback using `sonner`.

## Notes
- Do not hardcode URLs/ports. Frontend must call backend via `REACT_APP_BACKEND_URL`.
- Backend must keep binding unchanged and all routes under `/api`.
