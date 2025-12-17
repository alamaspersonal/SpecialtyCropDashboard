from datetime import datetime
from typing import List
from pydantic import BaseModel


# --- Pydantic Models ---
class CropPriceSchema(BaseModel):
    id: int
    report_date: datetime | None
    market_type: str | None
    market_location_name: str | None
    district: str | None
    origin: str | None
    category: str | None
    commodity: str | None
    variety: str | None
    package: str | None
    item_size: str | None
    organic: str | None
    low_price: float | None
    high_price: float | None
    mostly_low_price: float | None
    mostly_high_price: float | None
    market_tone_comments: str | None

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
    variety: str | None
    avg_low_price: float | None
    avg_high_price: float | None
    count: int
    market_tone: str | None