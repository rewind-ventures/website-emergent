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


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

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


@api_router.post("/consultations", response_model=Consultation)
async def create_consultation(input: ConsultationCreate):
    obj = Consultation(**input.model_dump())
    doc = obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.consultations.insert_one(doc)
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
    index: int = Query(..., ge=0),
    total: int = Query(..., ge=1, le=10000),
    chunk: "UploadFile" = None,
):
    # NOTE: UploadFile imported below to avoid circular import issues with fastapi.
    raise HTTPException(status_code=500, detail="Not implemented")


@api_router.post("/consultations/{consultation_id}/images/{image_id}/complete")
async def complete_consultation_image_upload(consultation_id: str, image_id: str):
    raise HTTPException(status_code=500, detail="Not implemented")

    doc["created_at"] = doc["created_at"].isoformat()

    # Ensure uniqueness by our business id
    await db.leads.update_one({"id": doc["id"]}, {"$setOnInsert": doc}, upsert=True)
    return lead


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