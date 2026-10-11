import os
import json
from datetime import date, datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, Date, Boolean
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from sqlalchemy.pool import NullPool
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

IST = timezone(timedelta(hours=5, minutes=30))

def today() -> date:
    return datetime.now(IST).date()

GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

TARGET_CALORIES = 2435
TARGET_PROTEIN = 100


def get_groq_client():
    return Groq(api_key=os.getenv("GROQ_API_KEY"))

database_url = os.getenv("DATABASE_URL", "sqlite:///./vtaper.db")
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)
elif database_url.startswith("postgresql://") and "+psycopg" not in database_url:
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)

is_sqlite = database_url.startswith("sqlite")
engine_kwargs = {"poolclass": NullPool}
if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(database_url, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class NutritionLog(Base):
    __tablename__ = "nutrition_logs"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, default=today)
    food_item = Column(String)
    calories = Column(Float)
    protein = Column(Float)
    carbs = Column(Float)
    fats = Column(Float)

class WorkoutLog(Base):
    __tablename__ = "workout_logs"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, default=today)
    exercise = Column(String)
    weight_kg = Column(Float)
    completed = Column(Boolean, default=False)

Base.metadata.create_all(bind=engine)

def nutrition_to_dict(log: NutritionLog):
    return {
        "id": log.id,
        "date": log.date.isoformat() if log.date else None,
        "food_item": log.food_item,
        "calories": log.calories,
        "protein": log.protein,
        "carbs": log.carbs,
        "fats": log.fats,
    }

def workout_to_dict(log: WorkoutLog):
    return {
        "id": log.id,
        "date": log.date.isoformat() if log.date else None,
        "exercise": log.exercise,
        "weight_kg": log.weight_kg,
        "completed": log.completed,
    }

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def extract_items(parsed):
    if isinstance(parsed, list):
        return parsed
    if isinstance(parsed, dict):
        for key in ("items", "foods", "data"):
            if isinstance(parsed.get(key), list):
                return parsed[key]
    raise ValueError("Unexpected AI JSON shape")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class MealInput(BaseModel):
    text: str

class WorkoutInput(BaseModel):
    exercise: str
    weight_kg: float
    completed: bool

@app.post("/api/nutrition")
def log_nutrition(meal: MealInput, db: Session = Depends(get_db)):
    if not os.getenv("GROQ_API_KEY"):
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not configured.")

    prompt = f"""
Analyze this meal: "{meal.text}"
Extract the foods and return JSON with an "items" array. Each object must use these exact keys:
"food_item" (string), "quantity_eaten" (float, in grams or units), "unit_type" (either "g" or "unit"),
"base_calories_per_100g_or_1unit" (float), "base_protein_per_100g_or_1unit" (float),
"base_carbs_per_100g_or_1unit" (float), "base_fats_per_100g_or_1unit" (float).
Do NOT calculate the totals. Only provide the base nutritional values.
"""

    try:
        completion = get_groq_client().chat.completions.create(
            model=GROQ_MODEL,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": "You extract nutrition facts. Return valid JSON only.",
                },
                {"role": "user", "content": prompt},
            ],
        )
        raw_text = completion.choices[0].message.content.replace("```json", "").replace("```", "").strip()
        parsed_data = extract_items(json.loads(raw_text))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Groq error: {type(e).__name__}: {str(e)}")

    saved_logs = []
    for item in parsed_data:
        multiplier = item["quantity_eaten"] / 100 if item["unit_type"] == "g" else item["quantity_eaten"]
        log = NutritionLog(
            date=today(),
            food_item=item["food_item"],
            calories=round(item["base_calories_per_100g_or_1unit"] * multiplier, 1),
            protein=round(item["base_protein_per_100g_or_1unit"] * multiplier, 1),
            carbs=round(item["base_carbs_per_100g_or_1unit"] * multiplier, 1),
            fats=round(item["base_fats_per_100g_or_1unit"] * multiplier, 1),
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        saved_logs.append(nutrition_to_dict(log))

    return saved_logs

@app.get("/api/nutrition/today")
def get_today_nutrition(db: Session = Depends(get_db)):
    logs = db.query(NutritionLog).filter(NutritionLog.date == today()).all()
    totals = {"calories": 0, "protein": 0, "carbs": 0, "fats": 0}
    for log in logs:
        totals["calories"] += log.calories or 0
        totals["protein"] += log.protein or 0
        totals["carbs"] += log.carbs or 0
        totals["fats"] += log.fats or 0
    return {
        "logs": [nutrition_to_dict(log) for log in logs],
        "totals": totals,
        "targets": {"calories": TARGET_CALORIES, "protein": TARGET_PROTEIN},
    }

@app.get("/api/nutrition/weekly")
def get_weekly_nutrition(db: Session = Depends(get_db)):
    week_ago = today() - timedelta(days=6)
    logs = db.query(NutritionLog).filter(NutritionLog.date >= week_ago).all()

    daily_totals = {}
    for i in range(7):
        d = (week_ago + timedelta(days=i)).strftime("%Y-%m-%d")
        daily_totals[d] = 0

    for log in logs:
        d_str = log.date.strftime("%Y-%m-%d")
        if d_str in daily_totals:
            daily_totals[d_str] += log.calories or 0

    return [{"date": k, "calories": v} for k, v in daily_totals.items()]

@app.post("/api/workout")
def log_workout(workout: WorkoutInput, db: Session = Depends(get_db)):
    existing = db.query(WorkoutLog).filter(
        WorkoutLog.date == today(),
        WorkoutLog.exercise == workout.exercise,
    ).first()
    if existing:
        existing.weight_kg = workout.weight_kg
        existing.completed = workout.completed
        db.commit()
        db.refresh(existing)
        return workout_to_dict(existing)

    log = WorkoutLog(
        date=today(),
        exercise=workout.exercise,
        weight_kg=workout.weight_kg,
        completed=workout.completed,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return workout_to_dict(log)

@app.get("/api/workout/monthly")
def get_monthly_workouts(db: Session = Depends(get_db)):
    month_ago = today() - timedelta(days=28)
    logs = db.query(WorkoutLog).filter(WorkoutLog.date >= month_ago).all()
    return [workout_to_dict(log) for log in logs]
