from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import database
from pydantic import BaseModel
from datetime import datetime

# Initialize Database
database.init_db()

app = FastAPI(title="Specialty Crop Dashboard API")

# --- CORS Configuration ---
origins = [
    "http://localhost:5173",  # Vite default port
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---
class CropPriceSchema(BaseModel):
    id: int
    commodity: str
    variety: str | None
    date: datetime
    price_min: float | None
    price_max: float | None
    unit: str | None
    location: str | None

    class Config:
        from_attributes = True

# --- Dependency ---
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Endpoints ---
@app.get("/")
def read_root():
    return {"message": "Welcome to the Specialty Crop Dashboard API"}

@app.get("/api/crops", response_model=List[CropPriceSchema])
def get_crops(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    crops = db.query(database.CropPrice).offset(skip).limit(limit).all()
    return crops
