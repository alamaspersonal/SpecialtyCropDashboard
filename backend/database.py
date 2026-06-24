from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime

# Database URL - creating the DB in the parent directory
SQLALCHEMY_DATABASE_URL = "sqlite:///../specialty_crop.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class CropPrice(Base):
    """
    Model for specialty crop price data from USDA reports.
    """
    __tablename__ = "crop_prices"

    id = Column(Integer, primary_key=True, index=True)
    
    # Date fields
    report_date = Column(DateTime, index=True)
    
    # Location fields
    market_type = Column(String, index=True)  # Terminal, Shipping Point, etc.
    market_location_name = Column(String)
    district = Column(String, index=True)
    origin = Column(String)
    
    # Product fields
    category = Column(String, index=True)
    commodity = Column(String, index=True)
    variety = Column(String, index=True)
    package = Column(String, index=True)
    item_size = Column(String, index=True)
    organic = Column(String, index=True)
    
    # Price fields
    low_price = Column(Float, nullable=True)
    high_price = Column(Float, nullable=True)
    mostly_low_price = Column(Float, nullable=True)
    mostly_high_price = Column(Float, nullable=True)
    wtd_avg_price = Column(Float, nullable=True)
    
    # Notes
    market_tone_comments = Column(Text, nullable=True)

class UnifiedCropPrice(Base):
    __tablename__ = "unified_prices"

    id = Column(Integer, primary_key=True, index=True)
    report_date = Column(DateTime, index=True)
    market_type = Column(String, index=True)  # "Terminal" or "Shipping Point"
    district = Column(String, index=True)
    commodity = Column(String, index=True)
    variety = Column(String, index=True)
    package = Column(String, index=True)
    price_min = Column(Float)
    price_max = Column(Float)
    price_retail = Column(Float)

def init_db():
    Base.metadata.create_all(bind=engine)
