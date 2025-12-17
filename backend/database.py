from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
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
    __tablename__ = "crop_prices"

    id = Column(Integer, primary_key=True, index=True)
    commodity = Column(String, index=True)
    variety = Column(String, nullable=True)
    date = Column(DateTime, default=datetime.datetime.utcnow)
    price_min = Column(Float, nullable=True)
    price_max = Column(Float, nullable=True)
    unit = Column(String, nullable=True)
    location = Column(String, nullable=True)

def init_db():
    Base.metadata.create_all(bind=engine)
