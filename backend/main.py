import json
import logging
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# ==================================================
# LOGGING
# ==================================================

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("iwakasafe")


# ==================================================
# PROJECT PATHS
# ==================================================

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BACKEND_DIR.parent

PROCESSED_DIR = PROJECT_DIR / "processed"
MODELS_DIR = BACKEND_DIR / "models"

RISK_FILE = PROCESSED_DIR / "wakasafe_road_risk_assessment.csv"
ROADS_FILE = PROCESSED_DIR / "wakasafe_road_features_cleaned.csv"

HISTORICAL_ACTIVITY_FILE = (
    PROCESSED_DIR / "wakasafe_historical_time_risk.csv"
)

ACTIVITY_MODEL_FILE = (
    MODELS_DIR / "wakasafe_historical_activity_model.pkl"
)

DB_FILE = BACKEND_DIR / "wakasafe.db"


# ==================================================
# LOAD EXISTING DATASETS
# ==================================================

required_files = {
    "Risk dataset": RISK_FILE,
    "Road features dataset": ROADS_FILE,
    "Historical activity dataset": HISTORICAL_ACTIVITY_FILE,
}

for file_description, file_path in required_files.items():
    if not file_path.is_file():
        raise FileNotFoundError(
            f"{file_description} not found: {file_path}"
        )

risk_df = pd.read_csv(RISK_FILE)
roads_df = pd.read_csv(ROADS_FILE)
historical_activity_df = pd.read_csv(HISTORICAL_ACTIVITY_FILE)


# ==================================================
# LOAD ACTIVITY MODEL
# ==================================================

activity_model = None
ACTIVITY_MODEL_ERROR = None

if ACTIVITY_MODEL_FILE.is_file():
    try:
        activity_model = joblib.load(ACTIVITY_MODEL_FILE)
        logger.info(
            "Historical activity model loaded successfully: %s",
            ACTIVITY_MODEL_FILE
        )

    except Exception as error:
        ACTIVITY_MODEL_ERROR = str(error)
        logger.exception("Unable to load historical activity model.")

else:
    ACTIVITY_MODEL_ERROR = (
        f"Activity model not found: {ACTIVITY_MODEL_FILE}"
    )

    logger.warning(ACTIVITY_MODEL_ERROR)


# ==================================================
# DATABASE CONNECTION
# ==================================================

@contextmanager
def get_connection():
    connection = sqlite3.connect(DB_FILE)
    connection.row_factory = sqlite3.Row

    try:
        yield connection
        connection.commit()

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ==================================================
# DATABASE INITIALIZATION AND MIGRATION
# ==================================================

def initialize_database():

    with get_connection() as connection:

        connection.execute("""
            CREATE TABLE IF NOT EXISTS community_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                state TEXT NOT NULL,
                location_route TEXT NOT NULL,
                incident_type TEXT NOT NULL,
                incident_date TEXT NOT NULL,
                incident_time TEXT,
                severity TEXT NOT NULL DEFAULT 'Unknown',
                description TEXT NOT NULL,
                latitude REAL,
                longitude REAL,
                verification_status TEXT NOT NULL
                    DEFAULT 'Pending verification',
                created_at TEXT NOT NULL
            )
        """)

        existing_columns = {
            row["name"]
            for row in connection.execute(
                "PRAGMA table_info(community_reports)"
            ).fetchall()
        }

        if "incident_time" not in existing_columns:
            connection.execute("""
                ALTER TABLE community_reports
                ADD COLUMN incident_time TEXT
            """)

            logger.info("Added incident_time column.")

        if "severity" not in existing_columns:
            connection.execute("""
                ALTER TABLE community_reports
                ADD COLUMN severity TEXT NOT NULL DEFAULT 'Unknown'
            """)

            logger.info("Added severity column.")


initialize_database()


# ==================================================
# FASTAPI APPLICATION
# ==================================================

app = FastAPI(
    title="IwakaSafe API",
    description="Road Safety Intelligence and Risk Assessment API",
    version="1.0.0"
)


# ==================================================
# CORS CONFIGURATION
# ==================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://iwakasafe.vercel.app",
        "https://frontend-sage-five-22.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# ==================================================
# REPORT REQUEST MODEL
# ==================================================

class IncidentReport(BaseModel):

    state: str = Field(min_length=2, max_length=50)

    location_route: str = Field(
        min_length=2,
        max_length=200
    )

    incident_type: str = Field(
        min_length=2,
        max_length=100
    )

    incident_date: str

    incident_time: Optional[str] = None

    severity: str = Field(
        default="Unknown",
        max_length=30
    )

    description: str = Field(
        min_length=5,
        max_length=3000
    )

    latitude: Optional[float] = None
    longitude: Optional[float] = None


# ==================================================
# HOME
# ==================================================

@app.get("/")
def home():

    return {
        "message": "Welcome to IwakaSafe API",
        "status": "running",
        "version": "1.0.0"
    }


# ==================================================
# HEALTH CHECK
# ==================================================

@app.get("/api/health")
def health_check():

    try:
        with get_connection() as connection:
            connection.execute("SELECT 1").fetchone()

        database_status = "connected"

    except sqlite3.Error:
        database_status = "disconnected"

    return {
        "status": (
            "healthy"
            if database_status == "connected"
            else "degraded"
        ),
        "risk_records": len(risk_df),
        "road_reference_records": len(roads_df),
        "historical_activity_records": len(historical_activity_df),
        "database": database_status,
        "activity_model": (
            "loaded" if activity_model is not None else "unavailable"
        ),
        "activity_model_path": str(ACTIVITY_MODEL_FILE)
    }


# ==================================================
# DASHBOARD SUMMARY
# ==================================================

@app.get("/api/dashboard/summary")
def dashboard_summary():

    incident_count = pd.to_numeric(
        risk_df["Incident_Count"],
        errors="coerce"
    ).fillna(0).sum()

    return {
        "road_assessments": int(len(risk_df)),
        "incident_records": int(incident_count),
        "very_high_risk_roads": int(
            (risk_df["Risk_Level"] == "Very High").sum()
        ),
        "mapped_road_references": int(len(roads_df))
    }


# ==================================================
# HISTORICAL ROAD RISK
# ==================================================

@app.get("/api/road-risks")
def get_road_risks(
    state: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=500)
):

    result = risk_df.copy()

    if state:
        result = result[
            result["State"].astype(str).str.strip().str.casefold()
            == state.strip().casefold()
        ]

    if search:
        result = result[
            result["Location_Route"].astype(str).str.contains(
                search,
                case=False,
                na=False,
                regex=False
            )
        ]

    result = result.sort_values(
        "Risk_Score",
        ascending=False
    ).head(limit)

    records = (
        result.astype(object)
        .where(pd.notna(result), None)
        .to_dict(orient="records")
    )

    return {
        "count": len(records),
        "records": records
    }


# ==================================================
# GEOGRAPHICAL ROAD REFERENCES
# ==================================================

@app.get("/api/road-features")
def get_road_features(
    west: Optional[float] = None,
    south: Optional[float] = None,
    east: Optional[float] = None,
    north: Optional[float] = None,
    limit: int = Query(default=1200, ge=1, le=5000)
):

    result = roads_df.copy()

    bounds_supplied = all(
        value is not None
        for value in [west, south, east, north]
    )

    if bounds_supplied:

        result = result[
            (result["longitude"] >= west) &
            (result["longitude"] <= east) &
            (result["latitude"] >= south) &
            (result["latitude"] <= north)
        ]

    total_matching = len(result)

    if len(result) > limit:
        result = result.sample(
            n=limit,
            random_state=42
        )

    columns = [
        "name",
        "highway",
        "maxspeed",
        "lanes",
        "surface",
        "length",
        "longitude",
        "latitude"
    ]

    records = (
        result[columns]
        .astype(object)
        .where(pd.notna(result[columns]), None)
        .to_dict(orient="records")
    )

    return {
        "total_matching": int(total_matching),
        "returned": len(records),
        "records": records,
        "description": (
            "OpenStreetMap road reference points, "
            "not confirmed incident locations."
        )
    }


# ==================================================
# LOCATION SEARCH AND ROAD ROUTING
# ==================================================

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

OSRM_URL = "https://router.project-osrm.org/route/v1/driving"

SE_VIEWBOX = "6.5,7.5,8.9,4.5"


@app.get("/api/locations/search")
def search_locations(
    q: str = Query(min_length=2, max_length=120),
    limit: int = Query(default=8, ge=1, le=10)
):

    params = {
        "q": q + ", Nigeria",
        "format": "jsonv2",
        "addressdetails": 1,
        "limit": limit,
        "countrycodes": "ng",
        "viewbox": SE_VIEWBOX,
        "bounded": 1
    }

    url = NOMINATIM_URL + "?" + urlencode(params)

    request = Request(
        url,
        headers={
            "User-Agent": "IwakaSafe/1.0 (road safety application)",
            "Accept": "application/json"
        }
    )

    try:

        with urlopen(request, timeout=20) as response:
            results = json.loads(
                response.read().decode("utf-8")
            )

        locations = []

        for item in results:

            address = item.get("address", {})

            locations.append({
                "name": (
                    item.get("name")
                    or item.get("display_name")
                ),
                "display_name": item.get("display_name"),
                "latitude": float(item["lat"]),
                "longitude": float(item["lon"]),
                "state": address.get(
                    "state",
                    "Not specified"
                ),
                "type": item.get("type", "place")
            })

        return {
            "count": len(locations),
            "locations": locations,
            "region": "Southeast Nigeria search area"
        }

    except (
        HTTPError,
        URLError,
        TimeoutError,
        ValueError,
        KeyError
    ) as error:

        logger.exception("Location search failed.")

        raise HTTPException(
            status_code=502,
            detail=f"Location search service unavailable: {error}"
        )


# ==================================================
# ROUTE INSTRUCTION FORMATTER
# ==================================================

def format_route_instruction(step):

    maneuver = step.get("maneuver", {})

    maneuver_type = maneuver.get("type", "continue")

    modifier = maneuver.get("modifier", "")

    road_name = step.get("name") or ""

    if maneuver_type == "depart":
        instruction = "Start your journey"

    elif maneuver_type == "arrive":
        instruction = "You have arrived at your destination"

    elif maneuver_type == "roundabout":

        exit_number = maneuver.get("exit")

        instruction = (
            f"At the roundabout, take exit {exit_number}"
            if exit_number
            else "Continue through the roundabout"
        )

    elif maneuver_type == "turn":

        instruction = (
            f"Turn {modifier}"
            if modifier
            else "Turn"
        )

    elif maneuver_type == "merge":

        instruction = (
            f"Merge {modifier}".strip()
            if modifier
            else "Merge"
        )

    elif maneuver_type == "fork":

        instruction = (
            f"At the fork, keep {modifier}".strip()
            if modifier
            else "Continue at the fork"
        )

    elif maneuver_type == "on ramp":
        instruction = "Take the ramp"

    elif maneuver_type == "off ramp":
        instruction = "Take the exit ramp"

    elif maneuver_type == "end of road":

        instruction = (
            f"At the end of the road, turn {modifier}".strip()
            if modifier
            else "Continue at the end of the road"
        )

    else:
        instruction = "Continue straight"

    if road_name and maneuver_type != "arrive":
        instruction += f" onto {road_name}"

    return instruction


# ==================================================
# CALCULATE DRIVING ROUTES
# ==================================================

@app.get("/api/routes")
def calculate_routes(
    start_lat: float,
    start_lon: float,
    end_lat: float,
    end_lon: float
):

    if not (
        -90 <= start_lat <= 90
        and -180 <= start_lon <= 180
        and -90 <= end_lat <= 90
        and -180 <= end_lon <= 180
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid latitude or longitude coordinates."
        )

    coordinates = (
        f"{start_lon},{start_lat};{end_lon},{end_lat}"
    )

    url = (
        f"{OSRM_URL}/{coordinates}"
        "?overview=full"
        "&geometries=geojson"
        "&steps=true"
        "&alternatives=2"
    )

    request = Request(
        url,
        headers={
            "User-Agent": "IwakaSafe/1.0 (road safety application)",
            "Accept": "application/json"
        }
    )

    try:

        with urlopen(request, timeout=25) as response:
            data = json.loads(
                response.read().decode("utf-8")
            )

        if data.get("code") != "Ok" or not data.get("routes"):

            raise HTTPException(
                status_code=404,
                detail=(
                    "No driving route was found "
                    "between these locations."
                )
            )

        formatted_routes = []

        for index, route in enumerate(data["routes"]):

            directions = []

            for leg in route.get("legs", []):

                for step in leg.get("steps", []):

                    directions.append({
                        "instruction": format_route_instruction(step),
                        "road_name": step.get("name") or "Unnamed road",
                        "distance_metres": round(
                            step.get("distance", 0)
                        ),
                        "duration_seconds": round(
                            step.get("duration", 0)
                        ),
                        "maneuver": step.get("maneuver", {})
                    })

            formatted_routes.append({
                "route_number": index + 1,
                "distance_km": round(
                    route["distance"] / 1000,
                    2
                ),
                "duration_minutes": round(
                    route["duration"] / 60
                ),
                "geometry": route["geometry"],
                "directions": directions
            })

        return {
            "status": "success",
            "route_count": len(formatted_routes),
            "routes": formatted_routes,
            "routing_source": (
                "OpenStreetMap road network via OSRM"
            ),
            "notice": (
                "Estimated driving routes and durations. "
                "Live traffic conditions are not included."
            )
        }

    except HTTPException:
        raise

    except (
        HTTPError,
        URLError,
        TimeoutError,
        ValueError
    ) as error:

        logger.exception("Route calculation failed.")

        raise HTTPException(
            status_code=502,
            detail=f"Routing service unavailable: {error}"
        )


# ==================================================
# SUBMIT COMMUNITY INCIDENT REPORT
# ==================================================

@app.post("/api/reports")
def submit_report(report: IncidentReport):

    created_at = datetime.now(timezone.utc).isoformat()

    try:

        with get_connection() as connection:

            cursor = connection.execute("""
                INSERT INTO community_reports (
                    state,
                    location_route,
                    incident_type,
                    incident_date,
                    incident_time,
                    severity,
                    description,
                    latitude,
                    longitude,
                    verification_status,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                report.state.strip(),
                report.location_route.strip(),
                report.incident_type.strip(),
                report.incident_date,
                report.incident_time,
                report.severity.strip(),
                report.description.strip(),
                report.latitude,
                report.longitude,
                "Pending verification",
                created_at
            ))

            report_id = cursor.lastrowid

        return {
            "message": "Report received successfully.",
            "report_id": report_id,
            "verification_status": "Pending verification"
        }

    except sqlite3.Error as error:

        logger.exception("Unable to save community report.")

        raise HTTPException(
            status_code=500,
            detail=f"Unable to save report: {error}"
        )


# ==================================================
# VIEW COMMUNITY REPORTS
# ==================================================

@app.get("/api/reports")
def get_reports(
    status: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=500)
):

    try:

        with get_connection() as connection:

            if status:

                rows = connection.execute("""
                    SELECT * FROM community_reports
                    WHERE verification_status = ?
                    ORDER BY created_at DESC
                    LIMIT ?
                """, (status, limit)).fetchall()

            else:

                rows = connection.execute("""
                    SELECT * FROM community_reports
                    ORDER BY created_at DESC
                    LIMIT ?
                """, (limit,)).fetchall()

        return {
            "count": len(rows),
            "reports": [dict(row) for row in rows]
        }

    except sqlite3.Error as error:

        logger.exception("Unable to retrieve community reports.")

        raise HTTPException(
            status_code=500,
            detail=f"Unable to retrieve reports: {error}"
        )


# ==================================================
# COMMUNITY REPORT VERIFICATION
# ==================================================

@app.patch("/api/reports/{report_id}/verification")
def verify_report(
    report_id: int,
    status: str = Query(...)
):

    if status not in ["Verified", "Rejected"]:

        raise HTTPException(
            status_code=400,
            detail="Status must be Verified or Rejected."
        )

    try:

        with get_connection() as connection:

            report = connection.execute(
                "SELECT id FROM community_reports WHERE id = ?",
                (report_id,)
            ).fetchone()

            if report is None:

                raise HTTPException(
                    status_code=404,
                    detail="Community report not found."
                )

            connection.execute("""
                UPDATE community_reports
                SET verification_status = ?
                WHERE id = ?
            """, (status, report_id))

        return {
            "message": (
                f"Report successfully marked as {status}."
            ),
            "report_id": report_id,
            "verification_status": status
        }

    except sqlite3.Error as error:

        logger.exception("Unable to verify community report.")

        raise HTTPException(
            status_code=500,
            detail=f"Unable to update report: {error}"
        )


# ==================================================
# HISTORICAL RISK
# ==================================================

@app.get("/api/historical-risk")
def get_historical_risk(
    state: str = Query(...),
    route: str = Query(...),
    time_of_day: str = Query(...)
):

    result = historical_activity_df[
        (
            historical_activity_df["State"]
            .astype(str)
            .str.strip()
            .str.casefold()
            == state.strip().casefold()
        ) &
        (
            historical_activity_df["Location_Route"]
            .astype(str)
            .str.strip()
            .str.casefold()
            == route.strip().casefold()
        ) &
        (
            historical_activity_df["Time_of_Day"]
            .astype(str)
            .str.strip()
            .str.casefold()
            == time_of_day.strip().casefold()
        )
    ]

    if result.empty:

        return {
            "status": "insufficient_data",
            "message": (
                "No historical records for this route and time."
            )
        }

    record = result.iloc[0]

    return {
        "status": "success",
        "state": record["State"],
        "route": record["Location_Route"],
        "time_of_day": record["Time_of_Day"],
        "incident_count": int(record["Incident_Count"]),
        "historical_activity_score": float(
            record["Historical_Activity_Score"]
        ),
        "historical_activity_level": str(
            record["Historical_Activity_Level"]
        ),
        "total_fatalities": int(
            record["Total_Fatalities"]
        ),
        "total_injuries": int(
            record["Total_Injuries"]
        )
    }


# ==================================================
# HISTORICAL ACTIVITY PREDICTION
# ==================================================

@app.get("/api/predict-historical-activity")
def predict_historical_activity(
    state: str = Query(...),
    route: str = Query(...),
    time_of_day: str = Query(...)
):

    if activity_model is None:

        raise HTTPException(
            status_code=503,
            detail=(
                "Historical activity prediction is unavailable. "
                "The activity model could not be loaded. "
                f"Model path: {ACTIVITY_MODEL_FILE}"
            )
        )

    match = historical_activity_df[
        (
            historical_activity_df["State"]
            .astype(str)
            .str.strip()
            .str.casefold()
            == state.strip().casefold()
        ) &
        (
            historical_activity_df["Location_Route"]
            .astype(str)
            .str.strip()
            .str.casefold()
            == route.strip().casefold()
        ) &
        (
            historical_activity_df["Time_of_Day"]
            .astype(str)
            .str.strip()
            .str.casefold()
            == time_of_day.strip().casefold()
        )
    ]

    if match.empty:

        return {
            "status": "insufficient_historical_data",
            "message": (
                "No matching historical records are available "
                "for this route and time."
            ),
            "state": state,
            "route": route,
            "time_of_day": time_of_day
        }

    input_data = pd.DataFrame([{
        "State": state,
        "Location_Route": route,
        "Time_of_Day": time_of_day
    }])

    try:

        predicted_level = activity_model.predict(input_data)[0]

        confidence = None

        if hasattr(activity_model, "predict_proba"):

            probabilities = activity_model.predict_proba(
                input_data
            )[0]

            confidence = round(
                float(max(probabilities) * 100),
                2
            )

        record = match.iloc[0]

        return {
            "status": "success",
            "state": state,
            "route": route,
            "time_of_day": time_of_day,
            "predicted_activity_level": str(predicted_level),
            "model_confidence": confidence,
            "recorded_incidents": int(
                record["Incident_Count"]
            ),
            "historical_activity_score": float(
                record["Historical_Activity_Score"]
            ),
            "explanation": (
                "This is an experimental classification of "
                "historical incident activity, not a guarantee "
                "of current road safety or a probability "
                "of an incident."
            )
        }

    except Exception as error:

        logger.exception("Historical activity prediction failed.")

        raise HTTPException(
            status_code=500,
            detail=(
                "Historical activity prediction failed. "
                "Check that the model supports the supplied "
                "input features. "
                f"Details: {error}"
            )
        )
