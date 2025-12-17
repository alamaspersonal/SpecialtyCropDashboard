# Specialty Crop Dashboard

A local web dashboard to display specialty crop pricing data, built with React and FastAPI.

## Project Structure

- **frontend/**: React + Vite application with Tailwind CSS.
- **backend/**: FastAPI application using SQLite.
- **specialty_crop.db**: SQLite database (created by backend).

## How to Run

### 1. Start the Backend

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Create and activate virtual environment (if not executing in one):
    ```bash
    python3 -m venv .venv
    source .venv/bin/activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Run the server:
    ```bash
    uvicorn main:app --reload
    ```
    The API will be available at `http://127.0.0.1:8000`.

### 2. Start the Frontend

1.  Open a new terminal and navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies (first time only):
    ```bash
    npm install
    ```
3.  Run the development server:
    ```bash
    npm run dev
    ```
4.  Open your browser and click the link provided (usually `http://localhost:5173`).

### 3. Verification

- You should see the "Specialty Crop Dashboard" header.
- The table should be populated with dummy data (e.g., Apples, Avocados).
- If the table is empty or loading fails, check the backend console for errors.
