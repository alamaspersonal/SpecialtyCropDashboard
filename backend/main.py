from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import distinct, func
from typing import List, Optional
import database
from pydantic import BaseModel
from datetime import datetime, timedelta
from db_models import CropPriceSchema, FiltersSchema, PriceSummary, UnifiedPriceSchema

# Initialize Database
database.init_db()

app = FastAPI(title="Specialty Crop Dashboard API")

# --- CORS Configuration ---
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "*", # Allow all origins for network access
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

@app.get("/api/filters") # response_model=FiltersSchema removed for brevity
def get_filters(
    commodity: Optional[str] = Query(None),
    variety: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    organic: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    def build_query_excluding(exclude_field: str):
        query = db.query(database.CropPrice)
        if commodity and exclude_field != 'commodity':
            query = query.filter(database.CropPrice.commodity == commodity)
        if variety and exclude_field != 'variety':
            query = query.filter(database.CropPrice.variety == variety)
        if category and exclude_field != 'category':
            query = query.filter(database.CropPrice.category == category)
        if district and exclude_field != 'district':
            query = query.filter(database.CropPrice.district == district)
        if organic and exclude_field != 'organic':
            query = query.filter(database.CropPrice.organic == organic)
        return query
    
    def get_distinct_for_field(field, field_name: str):
        base = build_query_excluding(field_name).with_entities(distinct(field)).filter(
            field.isnot(None), field != "N/A"
        )
        return sorted([r[0] for r in base.all()])
    
    return {
        "categories": get_distinct_for_field(database.CropPrice.category, 'category'),
        "commodities": get_distinct_for_field(database.CropPrice.commodity, 'commodity'),
        "varieties": get_distinct_for_field(database.CropPrice.variety, 'variety'),
        "item_sizes": get_distinct_for_field(database.CropPrice.item_size, 'item_size'),
        "districts": get_distinct_for_field(database.CropPrice.district, 'district'),
        "organics": get_distinct_for_field(database.CropPrice.organic, 'organic'),
    }

@app.get("/api/prices")
def get_prices(
    commodity: Optional[str] = Query(None),
    variety: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    package: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    organic: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    days: Optional[int] = Query(None),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(database.CropPrice)
    if commodity: query = query.filter(database.CropPrice.commodity == commodity)
    if variety: query = query.filter(database.CropPrice.variety == variety)
    if category: query = query.filter(database.CropPrice.category == category)
    if package: query = query.filter(database.CropPrice.package == package)
    if district: query = query.filter(database.CropPrice.district == district)
    if organic: query = query.filter(database.CropPrice.organic == organic)
    
    if date:
        try:
            parsed_date = datetime.strptime(date, "%m/%d/%Y")
            query = query.filter(database.CropPrice.report_date == parsed_date)
        except ValueError: pass
    elif days:
        max_date_result = query.with_entities(func.max(database.CropPrice.report_date)).scalar()
        if max_date_result:
            cutoff_date = max_date_result - timedelta(days=days)
            query = query.filter(database.CropPrice.report_date >= cutoff_date)
    
    return query.order_by(database.CropPrice.report_date.desc()).limit(limit).all()

@app.get("/api/price_summary")
def get_price_summary(
    commodity: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Get aggregated price summary. 
    SQL AVG automatically ignores NULLs.
    We add explicit counts for low and high prices.
    """
    query = db.query(
        database.CropPrice.commodity,
        database.CropPrice.variety,
        func.avg(database.CropPrice.low_price).label('avg_low_price'),
        func.avg(database.CropPrice.high_price).label('avg_high_price'),
        # Specific counters for non-null values
        func.count(database.CropPrice.low_price).label('low_price_count'),
        func.count(database.CropPrice.high_price).label('high_price_count'),
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
        except ValueError: pass
    
    results = query.limit(50).all()
    
    return [
        {
            "commodity": r.commodity,
            "variety": r.variety,
            "avg_low_price": round(r.avg_low_price, 2) if r.avg_low_price else None,
            "avg_high_price": round(r.avg_high_price, 2) if r.avg_high_price else None,
            "low_price_count": r.low_price_count,
            "high_price_count": r.high_price_count,
            "market_tone": r.market_tone,
        }
        for r in results
    ]

@app.get("/api/v2/prices")
def get_unified_prices(
    commodity: str = Query(...),
    variety: Optional[str] = Query(None),
    package: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(database.UnifiedCropPrice).filter(database.UnifiedCropPrice.commodity == commodity)
    if variety: query = query.filter(database.UnifiedCropPrice.variety == variety)
    if package: query = query.filter(database.UnifiedCropPrice.package == package)
    if start_date:
        try: query = query.filter(database.UnifiedCropPrice.report_date >= datetime.strptime(start_date, "%Y-%m-%d"))
        except ValueError: pass
    if end_date:
        try: query = query.filter(database.UnifiedCropPrice.report_date <= datetime.strptime(end_date, "%Y-%m-%d"))
        except ValueError: pass
            
    return query.order_by(database.UnifiedCropPrice.report_date).limit(2000).all()

@app.get("/api/v2/stats")
def get_kpi_stats(
    commodity: str = Query(...),
    db: Session = Depends(get_db)
):
    """
    KPIs with filtered averages to ignore NULL/Empty values.
    """
    latest = db.query(database.UnifiedCropPrice.report_date).order_by(database.UnifiedCropPrice.report_date.desc()).first()
    if not latest:
        return {"error": "No data found"}
    
    target_date = latest[0]

    base_query = db.query(database.UnifiedCropPrice).filter(
        database.UnifiedCropPrice.report_date == target_date,
        database.UnifiedCropPrice.commodity == commodity
    )
    
    terminal_rows = base_query.filter(database.UnifiedCropPrice.market_type == "Terminal").all()
    shipping_rows = base_query.filter(database.UnifiedCropPrice.market_type == "Shipping Point").all()
    
    # FILTERING NULLS: Only count records where price_avg is not None
    t_vals = [p.price_avg for p in terminal_rows if p.price_avg is not None]
    s_vals = [p.price_avg for p in shipping_rows if p.price_avg is not None]
    
    t_avg = sum(t_vals) / len(t_vals) if t_vals else 0
    s_avg = sum(s_vals) / len(s_vals) if s_vals else 0
    
    spread = t_avg - s_avg if (t_avg and s_avg) else None
    
    return {
        "current_terminal_avg": round(t_avg, 2),
        "terminal_count": len(t_vals),
        "current_shipping_avg": round(s_avg, 2),
        "shipping_count": len(s_vals),
        "spread": round(spread, 2) if spread else None,
        "date": target_date.strftime("%Y-%m-%d")
    }