from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import distinct, func
from typing import List, Optional
import database
from pydantic import BaseModel
from datetime import datetime
from db_models import CropPriceSchema, FiltersSchema, PriceSummary

# Initialize Database
database.init_db()

app = FastAPI(title="Specialty Crop Dashboard API")

# --- CORS Configuration ---
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.get("/api/filters", response_model=FiltersSchema)
def get_filters(db: Session = Depends(get_db)):
    """Return unique values for each filterable field."""
    def get_distinct(field):
        return sorted([r[0] for r in db.query(distinct(field)).filter(field.isnot(None), field != "N/A").all()])
    
    # Get unique dates formatted as strings
    dates = db.query(distinct(database.CropPrice.report_date)).filter(
        database.CropPrice.report_date.isnot(None)
    ).order_by(database.CropPrice.report_date.desc()).limit(30).all()
    
    return FiltersSchema(
        categories=get_distinct(database.CropPrice.category),
        commodities=get_distinct(database.CropPrice.commodity),
        varieties=get_distinct(database.CropPrice.variety),
        packages=get_distinct(database.CropPrice.package),
        item_sizes=get_distinct(database.CropPrice.item_size),
        districts=get_distinct(database.CropPrice.district),
        organics=get_distinct(database.CropPrice.organic),
        dates=[d[0].strftime("%m/%d/%Y") for d in dates if d[0]],
    )

@app.get("/api/prices", response_model=List[CropPriceSchema])
def get_prices(
    commodity: Optional[str] = Query(None),
    variety: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    organic: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db)
):
    """Get filtered price data."""
    query = db.query(database.CropPrice)
    
    if commodity:
        query = query.filter(database.CropPrice.commodity == commodity)
    if variety:
        query = query.filter(database.CropPrice.variety == variety)
    if category:
        query = query.filter(database.CropPrice.category == category)
    if district:
        query = query.filter(database.CropPrice.district == district)
    if organic:
        query = query.filter(database.CropPrice.organic == organic)
    if date:
        try:
            parsed_date = datetime.strptime(date, "%m/%d/%Y")
            query = query.filter(database.CropPrice.report_date == parsed_date)
        except ValueError:
            pass
    
    return query.order_by(database.CropPrice.report_date.desc()).limit(limit).all()

@app.get("/api/price_summary", response_model=List[PriceSummary])
def get_price_summary(
    commodity: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get aggregated price summary by commodity."""
    query = db.query(
        database.CropPrice.commodity,
        database.CropPrice.variety,
        func.avg(database.CropPrice.low_price).label('avg_low_price'),
        func.avg(database.CropPrice.high_price).label('avg_high_price'),
        func.count(database.CropPrice.id).label('count'),
        func.max(database.CropPrice.market_tone_comments).label('market_tone'),
    ).group_by(
        database.CropPrice.commodity,
        database.CropPrice.variety
    )
    
    if commodity:
        query = query.filter(database.CropPrice.commodity == commodity)
    if date:
        try:
            parsed_date = datetime.strptime(date, "%m/%d/%Y")
            query = query.filter(database.CropPrice.report_date == parsed_date)
        except ValueError:
            pass
    
    results = query.limit(50).all()
    
    return [
        PriceSummary(
            commodity=r.commodity,
            variety=r.variety,
            avg_low_price=round(r.avg_low_price, 2) if r.avg_low_price else None,
            avg_high_price=round(r.avg_high_price, 2) if r.avg_high_price else None,
            count=r.count,
            market_tone=r.market_tone,
        )
        for r in results
    ]

# Keep legacy endpoint for compatibility
@app.get("/api/crops", response_model=List[CropPriceSchema])
def get_crops(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    crops = db.query(database.CropPrice).offset(skip).limit(limit).all()
    return crops
