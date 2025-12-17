from database import SessionLocal, CropPrice, init_db
from datetime import datetime, timedelta
import random

def populate():
    init_db()
    db = SessionLocal()
    
    # Check if data exists
    if db.query(CropPrice).first():
        print("Database already contains data.")
        db.close()
        return

    print("Seeding database with dummy data...")
    
    commodities = ["Apples", "Avocados", "Blueberries", "Grapes", "Strawberries", "Tomatoes"]
    varieties = ["Red Delicious", "Hass", "Highbush", "Thompson Seedless", "Garden", "Roma"]
    locations = ["Los Angeles", "San Francisco", "New York", "Chicago", "Miami"]
    
    base_price = 1.50
    
    for i in range(50):
        # Generate random data
        comm_idx = random.randint(0, len(commodities)-1)
        
        crop = CropPrice(
            commodity=commodities[comm_idx],
            variety=varieties[comm_idx],
            date=datetime.now() - timedelta(days=random.randint(0, 30)),
            price_min=round(base_price + random.uniform(-0.5, 0.5), 2),
            price_max=round(base_price + random.uniform(0.6, 1.5), 2),
            unit="lb",
            location=random.choice(locations)
        )
        db.add(crop)

    db.commit()
    print("Database seeded successfully!")
    db.close()

if __name__ == "__main__":
    populate()
