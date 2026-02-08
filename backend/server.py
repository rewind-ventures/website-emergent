from fastapi import FastAPI, APIRouter, HTTPException, Query, UploadFile, File, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone
import asyncio
import base64
import resend



ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Resend email configuration
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "hello@rewind-ventures.com")
resend.api_key = RESEND_API_KEY


def _safe_email(s: Optional[str]) -> str:
    return (s or "").strip()


def _render_kv_table(rows: List[tuple]) -> str:
    # Simple email-safe HTML
    tr = []
    for k, v in rows:
        tr.append(
            f"<tr><td style='padding:8px 10px;border:1px solid #e5e7eb;white-space:nowrap;font-weight:700'>{k}</td>"
            f"<td style='padding:8px 10px;border:1px solid #e5e7eb'>{v}</td></tr>"
        )
    return "<table style='border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px'>" + "".join(tr) + "</table>"


async def send_notification_email(
    *,
    to_email: str,
    subject: str,
    html: str,
    reply_to: Optional[str] = None,
    attachments: Optional[List[dict]] = None,
):
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set; skipping email send")
        return {"skipped": True, "reason": "missing_api_key"}

    params = {
        "from": SENDER_EMAIL,
        "to": [to_email],
        "subject": subject,
        "html": html,
    }
    if reply_to:
        params["reply_to"] = reply_to
    if attachments:
        params["attachments"] = attachments

    return await asyncio.to_thread(resend.Emails.send, params)



# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str


# Leads
LeadStatus = Literal["new", "contacted", "closed"]

class LeadCreate(BaseModel):
    name: str
    company: str
    email: str
    phone: Optional[str] = None
    need: str
    source: str = "landing_form"

class LeadUpdate(BaseModel):
    status: LeadStatus

class Lead(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    company: str
    email: str
    phone: Optional[str] = None
    need: str
    source: str = "landing_form"
    status: LeadStatus = "new"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Consultations (new)
class SportCourts(BaseModel):
    sport: str
    courts: int

class ConsultationCreate(BaseModel):
    name: str
    email: str
    company: str
    details: str
    area_sqft: Optional[int] = None
    mode: Literal["single", "multi"]
    sports: List[SportCourts]
    facility_name: str
    google_maps_url: str
    source: str = "consultation_form"

class Consultation(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    company: str
    details: str
    area_sqft: Optional[int] = None
    mode: Literal["single", "multi"]
    sports: List[SportCourts]
    facility_name: str
    google_maps_url: str
    source: str = "consultation_form"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


async def _build_image_attachments_for_consultation(
    consultation_id: str, max_total_bytes: int = 18 * 1024 * 1024
) -> Optional[List[dict]]:
    # Best-effort attachments: if too large, return None (fallback)
    images = await db.consultation_images.find(
        {"consultation_id": consultation_id, "status": "complete"}, {"_id": 0}
    ).to_list(50)

    attachments: List[dict] = []
    total = 0

    for img in images:
        image_id = img.get("id")
        if not image_id:
            continue

        chunks = (
            await db.consultation_image_chunks.find(
                {"consultation_id": consultation_id, "image_id": image_id}, {"_id": 0}
            )
            .sort("index", 1)
            .to_list(10000)
        )

        data = b"".join([c.get("data", b"") for c in chunks])
        if not data:
            continue

        total += len(data)
        if total > max_total_bytes:
            return None

        b64 = base64.b64encode(data).decode("utf-8")
        attachments.append(
            {
                "filename": img.get("filename", f"site-image-{image_id}.jpg"),
                "content": b64,
                "content_type": img.get("content_type") or "application/octet-stream",
            }
        )

    return attachments


class ConsultationImageInit(BaseModel):
    filename: str
    size: int
    content_type: Optional[str] = None

class ConsultationImageInitResponse(BaseModel):
    image_id: str





@api_router.post("/leads", response_model=Lead)
async def create_lead(input: LeadCreate):
    lead = Lead(**input.model_dump())

    doc = lead.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()

    await db.leads.update_one({"id": doc["id"]}, {"$setOnInsert": doc}, upsert=True)

    # Email notification (Send Message form)
    try:
        subject = f"New website message — {lead.company}"
        html = (
            "<div style='font-family:Arial,sans-serif'>"
            "<h2 style='margin:0 0 10px'>New website enquiry</h2>"
            + _render_kv_table(
                [
                    ("Name", lead.name),
                    ("Email", lead.email),
                    ("Company", lead.company),
                    ("Message", lead.need),
                    ("Source", lead.source),
                    ("Created", doc["created_at"]),
                ]
            )
            + "</div>"
        )
        await send_notification_email(
            to_email="hello@rewind-ventures.com",
            subject=subject,
            html=html,
            reply_to=_safe_email(lead.email),
        )
    except Exception as e:
        logger.exception("Failed sending lead email notification: %s", str(e))

    return lead


@api_router.post("/consultations", response_model=Consultation)
async def create_consultation(input: ConsultationCreate):
    obj = Consultation(**input.model_dump())
    doc = obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.consultations.insert_one(doc)

    # Email notification (Book a consultation form) - best-effort.
    # Attachments are added AFTER image upload completes (see complete endpoint).
    try:
        subject = f"New consultation request — {obj.facility_name}"
        sports_line = ", ".join([f"{s.sport}: {s.courts}" for s in obj.sports])
        html = (
            "<div style='font-family:Arial,sans-serif'>"
            "<h2 style='margin:0 0 10px'>New consultation request</h2>"
            + _render_kv_table(
                [
                    ("Name", obj.name),
                    ("Email", obj.email),
                    ("Company", obj.company),
                    ("Facility", obj.facility_name),
                    ("Mode", obj.mode),
                    ("Sports", sports_line),
                    ("Area (sq.ft)", str(obj.area_sqft) if obj.area_sqft else ""),
                    ("Maps", f"<a href='{obj.google_maps_url}'>Open in Google Maps</a>"),
                    ("Details", obj.details),
                    ("Created", doc["created_at"]),
                ]
            )
            + "<p style='color:#6b7280;margin-top:12px'>Images will follow in a second email once upload completes.</p>"
            + "</div>"
        )
        await send_notification_email(
            to_email="hello@rewind-ventures.com",
            subject=subject,
            html=html,
            reply_to=_safe_email(obj.email),
        )
    except Exception as e:
        logger.exception("Failed sending consultation email notification: %s", str(e))

    return obj


@api_router.post(
    "/consultations/{consultation_id}/images/init",
    response_model=ConsultationImageInitResponse,
)
async def init_consultation_image(consultation_id: str, input: ConsultationImageInit):
    # ensure consultation exists
    exists = await db.consultations.find_one({"id": consultation_id}, {"_id": 0, "id": 1})
    if not exists:
        raise HTTPException(status_code=404, detail="Consultation not found")

    image_id = str(uuid.uuid4())
    meta = {
        "id": image_id,
        "consultation_id": consultation_id,
        "filename": input.filename,
        "size": input.size,
        "content_type": input.content_type,
        "status": "uploading",
        "chunks": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.consultation_images.insert_one(meta)
    return {"image_id": image_id}


@api_router.post("/consultations/{consultation_id}/images/{image_id}/chunk")
async def upload_consultation_image_chunk(
    consultation_id: str,
    image_id: str,
    chunk: UploadFile = File(...),
    index: int = Form(...),
    total: int = Form(...),
):
    meta = await db.consultation_images.find_one(
        {"id": image_id, "consultation_id": consultation_id}, {"_id": 0}
    )
    if not meta:
        raise HTTPException(status_code=404, detail="Image upload not initialized")

    data = await chunk.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty chunk")

    # Store chunk in mongo (simple MVP). For production, use object storage.
    chunk_doc = {
        "image_id": image_id,
        "consultation_id": consultation_id,
        "index": int(index),
        "total": int(total),
        "data": data,
        "size": len(data),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.consultation_image_chunks.insert_one(chunk_doc)

    await db.consultation_images.update_one(
        {"id": image_id},
        {"$addToSet": {"chunks": int(index)}, "$set": {"total": int(total)}},
    )

    return {"ok": True}


@api_router.post("/consultations/{consultation_id}/images/{image_id}/complete")
async def complete_consultation_image_upload(consultation_id: str, image_id: str):
    meta = await db.consultation_images.find_one(
        {"id": image_id, "consultation_id": consultation_id}, {"_id": 0}
    )
    if not meta:
        raise HTTPException(status_code=404, detail="Image upload not initialized")

    total = int(meta.get("total") or 0)
    chunks = sorted([int(x) for x in meta.get("chunks", [])])
    if total <= 0 or len(chunks) < total:
        raise HTTPException(status_code=400, detail="Upload incomplete")

    await db.consultation_images.update_one(
        {"id": image_id},
        {"$set": {"status": "complete", "completed_at": datetime.now(timezone.utc).isoformat()}},
    )

    # Link image id to consultation
    await db.consultations.update_one(
        {"id": consultation_id},
        {"$addToSet": {"image_ids": image_id}},
    )

    # If all uploads are complete for this consultation, send a follow-up email with attachments.
    try:
        images = await db.consultation_images.find(
            {"consultation_id": consultation_id}, {"_id": 0}
        ).to_list(50)
        if images and all((img.get("status") == "complete") for img in images):
            attachments = await _build_image_attachments_for_consultation(consultation_id)
            if attachments is None:
                # Fallback: too large for safe email size
                await send_notification_email(
                    to_email="hello@rewind-ventures.com",
                    subject=f"Consultation images uploaded — (too large to attach) [{consultation_id}]",
                    html=(
                        "<div style='font-family:Arial,sans-serif'>"
                        "<h3 style='margin:0 0 10px'>Images uploaded</h3>"
                        "<p>Total size exceeded safe email attachment limits. Images are stored in the system.</p>"
                        f"<p>Consultation ID: <b>{consultation_id}</b></p>"
                        "</div>"
                    ),
                )
            elif len(attachments) > 0:
                await send_notification_email(
                    to_email="hello@rewind-ventures.com",
                    subject=f"Consultation images — {consultation_id}",
                    html=(
                        "<div style='font-family:Arial,sans-serif'>"
                        "<h3 style='margin:0 0 10px'>Site images attached</h3>"
                        f"<p>Consultation ID: <b>{consultation_id}</b></p>"
                        "</div>"
                    ),
                    attachments=attachments,
                )
    except Exception as e:
        logger.exception("Failed sending consultation images email: %s", str(e))

    return {"ok": True}


@api_router.get("/leads", response_model=List[Lead])
async def list_leads(limit: int = Query(default=25, ge=1, le=100)):
    leads = await db.leads.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)

    for lead in leads:
        if isinstance(lead.get("created_at"), str):
            lead["created_at"] = datetime.fromisoformat(lead["created_at"])

    return leads


@api_router.patch("/leads/{lead_id}", response_model=Lead)
async def update_lead(lead_id: str, input: LeadUpdate):
    res = await db.leads.find_one_and_update(
        {"id": lead_id},
        {"$set": {"status": input.status}},
        projection={"_id": 0},
        return_document=ReturnDocument.AFTER,
    )

    if not res:
        raise HTTPException(status_code=404, detail="Lead not found")

    if isinstance(res.get("created_at"), str):
        res["created_at"] = datetime.fromisoformat(res["created_at"])

    return res


@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str):
    res = await db.leads.delete_one({"id": lead_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"ok": True}

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()