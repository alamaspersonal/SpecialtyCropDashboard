from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


# --- Pydantic Models ---
class CropPriceSchema(BaseModel):
    id: int
    report_date: Optional[datetime]
    market_type: Optional[str]
    market_location_name: Optional[str]
    district: Optional[str]
    origin: Optional[str]
    category: Optional[str]
    commodity: Optional[str]
    variety: Optional[str]
    package: Optional[str]
    item_size: Optional[str]
    organic: Optional[str]
    low_price: Optional[float]
    high_price: Optional[float]
    mostly_low_price: Optional[float]
    mostly_high_price: Optional[float]
    market_tone_comments: Optional[str]

    class Config:
        from_attributes = True

class FiltersSchema(BaseModel):
    categories: List[str]
    commodities: List[str]
    varieties: List[str]
    packages: List[str]
    item_sizes: List[str]
    districts: List[str]
    organics: List[str]
    dates: List[str]

class PriceSummary(BaseModel):
    commodity: str
    variety: Optional[str]
    avg_low_price: Optional[float]
    avg_high_price: Optional[float]
    count: int
    market_tone: Optional[str]