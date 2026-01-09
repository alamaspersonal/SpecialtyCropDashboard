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

@app.get("/api/filters", response_model=FiltersSchema)
def get_filters(
    commodity: Optional[str] = Query(None),
    variety: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    package: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    organic: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Return unique values for each filterable field.
    Each filter shows ALL options available given OTHER filters (not itself).
    """
    
    def build_query_excluding(exclude_field: str):
        """Build a query with all filters EXCEPT the specified field."""
        query = db.query(database.CropPrice)
        if commodity and exclude_field != 'commodity':
            query = query.filter(database.CropPrice.commodity == commodity)
        if variety and exclude_field != 'variety':
            query = query.filter(database.CropPrice.variety == variety)
        if category and exclude_field != 'category':
            query = query.filter(database.CropPrice.category == category)
        if package and exclude_field != 'package':
            query = query.filter(database.CropPrice.package == package)
        if district and exclude_field != 'district':
            query = query.filter(database.CropPrice.district == district)
        if organic and exclude_field != 'organic':
            query = query.filter(database.CropPrice.organic == organic)
        if date and exclude_field != 'date':
            try:
                parsed_date = datetime.strptime(date, "%m/%d/%Y")
                query = query.filter(database.CropPrice.report_date == parsed_date)
            except ValueError:
                pass
        return query
    
    def get_distinct_for_field(field, field_name: str):
        """Get distinct values for a field, excluding itself from filter criteria."""
        base = build_query_excluding(field_name).with_entities(distinct(field)).filter(
            field.isnot(None), field != "N/A"
        )
        return sorted([r[0] for r in base.all()])
    
    # Get unique dates (excluding date filter from query)
    date_query = build_query_excluding('date').with_entities(
        distinct(database.CropPrice.report_date)
    ).filter(
        database.CropPrice.report_date.isnot(None)
    ).order_by(database.CropPrice.report_date.desc()).limit(30)
    
    return FiltersSchema(
        categories=get_distinct_for_field(database.CropPrice.category, 'category'),
        commodities=get_distinct_for_field(database.CropPrice.commodity, 'commodity'),
        varieties=get_distinct_for_field(database.CropPrice.variety, 'variety'),
        packages=get_distinct_for_field(database.CropPrice.package, 'package'),
        item_sizes=get_distinct_for_field(database.CropPrice.item_size, 'item_size'),
        districts=get_distinct_for_field(database.CropPrice.district, 'district'),
        organics=get_distinct_for_field(database.CropPrice.organic, 'organic'),
        dates=[d[0].strftime("%m/%d/%Y") for d in date_query.all() if d[0]],
    )

@app.get("/api/prices", response_model=List[CropPriceSchema])
def get_prices(
    commodity: Optional[str] = Query(None),
    variety: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    package: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    organic: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    days: Optional[int] = Query(None, description="Filter by last N days (e.g., 7 for weekly average)"),
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
    if package:
        query = query.filter(database.CropPrice.package == package)
    if district:
        query = query.filter(database.CropPrice.district == district)
    if organic:
        query = query.filter(database.CropPrice.organic == organic)
    
    # Date filtering: specific date OR date range
    if date:
        try:
            parsed_date = datetime.strptime(date, "%m/%d/%Y")
            query = query.filter(database.CropPrice.report_date == parsed_date)
        except ValueError:
            pass
    elif days:
        # Filter by last N days relative to the most recent data (not today)
        # First, get the max date in the dataset (with current filters applied)
        max_date_result = query.with_entities(func.max(database.CropPrice.report_date)).scalar()
        if max_date_result:
            cutoff_date = max_date_result - timedelta(days=days)
            query = query.filter(database.CropPrice.report_date >= cutoff_date)
    
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

@app.get("/api/v2/prices", response_model=List[UnifiedPriceSchema])
def get_unified_prices(
    commodity: str = Query(..., description="Target commodity"),
    variety: Optional[str] = Query(None),
    package: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Get unified time-series data for both Terminal and Shipping points.
    """
    query = db.query(database.UnifiedCropPrice)
    query = query.filter(database.UnifiedCropPrice.commodity == commodity)
    
    if variety:
        query = query.filter(database.UnifiedCropPrice.variety == variety)
    if package:
        query = query.filter(database.UnifiedCropPrice.package == package)
        
    if start_date:
        try:
            sd = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(database.UnifiedCropPrice.report_date >= sd)
        except ValueError:
            pass
            
    if end_date:
        try:
            ed = datetime.strptime(end_date, "%Y-%m-%d")
            query = query.filter(database.UnifiedCropPrice.report_date <= ed)
        except ValueError:
            pass
            
    # Return raw records
    return query.order_by(database.UnifiedCropPrice.report_date).limit(2000).all()

@app.get("/api/v2/stats")
def get_kpi_stats(
    commodity: str = Query(...),
    date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Get Key Performance Indicators: Current Price, % Change, Spread.
    """
    # 1. Determine Target Date (latest if not provided)
    if not date:
        latest = db.query(database.UnifiedCropPrice.report_date).order_by(database.UnifiedCropPrice.report_date.desc()).first()
        target_date = latest[0] if latest else datetime.now()
    else:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d")
        except:
            return {"error": "Invalid date format"}

    # 2. Get Current Prices (Terminal vs Shipping)
    base_query = db.query(database.UnifiedCropPrice).filter(
        database.UnifiedCropPrice.report_date == target_date,
        database.UnifiedCropPrice.commodity == commodity
    )
    
    terminal_prices = base_query.filter(database.UnifiedCropPrice.market_type == "Terminal").all()
    shipping_prices = base_query.filter(database.UnifiedCropPrice.market_type == "Shipping Point").all()
    
    t_avg = sum([p.price_avg for p in terminal_prices]) / len(terminal_prices) if terminal_prices else 0
    s_avg = sum([p.price_avg for p in shipping_prices]) / len(shipping_prices) if shipping_prices else 0
    
    # 3. Spread
    spread = t_avg - s_avg if (t_avg and s_avg) else None
    
    return {
        "current_terminal_avg": round(t_avg, 2),
        "current_shipping_avg": round(s_avg, 2),
        "spread": round(spread, 2) if spread else None,
        "date": target_date.strftime("%Y-%m-%d")
    }
