import joblib
from pathlib import Path
from typing import Optional
from datetime import datetime, timezone
import sqlite3
import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# PROJECT PATHS

PROJECT_DIR = Path(__file__).resolve().parents[1]

RISK_FILE = PROJECT_DIR / "processed" / "wakasafe_road_risk_assessment.csv"
ROADS_FILE = PROJECT_DIR / "processed" / "wakasafe_road_features_cleaned.csv"

DB_FILE = Path(__file__).resolve().parent / "wakasafe.db"


# LOAD EXISTING WAKASAFE DATA

if not RISK_FILE.exists():
    raise FileNotFoundError(f"Risk dataset not found: {RISK_FILE}")

if not ROADS_FILE.exists():
    raise FileNotFoundError(f"Road features dataset not found: {ROADS_FILE}")

risk_df = pd.read_csv(RISK_FILE)
roads_df = pd.read_csv(ROADS_FILE)
HISTORICAL_ACTIVITY_FILE = (
    PROJECT_DIR / "processed" / "wakasafe_historical_time_risk.csv"
)

ACTIVITY_MODEL_FILE = (
    PROJECT_DIR / "backend" / "models" / "wakasafe_historical_activity_model.pkl"
)
roads_df = pd.read_csv(ROADS_FILE)
# LOAD HISTORICAL ACTIVITY MODEL

if not HISTORICAL_ACTIVITY_FILE.exists():
    raise FileNotFoundError(f"Historical activity data not found: {HISTORICAL_ACTIVITY_FILE}")

if not ACTIVITY_MODEL_FILE.exists():
    raise FileNotFoundError(f"Activity model not found: {ACTIVITY_MODEL_FILE}")

historical_activity_df = pd.read_csv(HISTORICAL_ACTIVITY_FILE)
activity_model = joblib.load(ACTIVITY_MODEL_FILE)

# DATABASE

def get_connection():
    connection = sqlite3.connect(DB_FILE)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS community_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                state TEXT NOT NULL,
                location_route TEXT NOT NULL,
                incident_type TEXT NOT NULL,
                incident_date TEXT NOT NULL,
                description TEXT NOT NULL,
                latitude REAL,
                longitude REAL,
                verification_status TEXT NOT NULL DEFAULT 'Pending verification',
                created_at TEXT NOT NULL
            )
        """)
        connection.commit()


initialize_database()

# FASTAPI APPLICATION

app = FastAPI(
    title="WakaSafe API",
    description="Road Safety Intelligence and Risk Assessment API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# REPORT REQUEST MODEL


class IncidentReport(BaseModel):
    state: str = Field(min_length=2, max_length=50)
    location_route: str = Field(min_length=2, max_length=200)
    incident_type: str = Field(min_length=2, max_length=100)
    incident_date: str
    incident_time: Optional[str] = None
    severity: str = Field(default="Unknown", max_length=30)
    description: str = Field(min_length=5, max_length=3000)
    latitude: Optional[float] = None
    longitude: Optional[float] = None


# HEALTH CHECK


@app.get("/")
def home():
    return {
        "message": "Welcome to WakaSafe API",
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "risk_records": len(risk_df),
        "road_reference_records": len(roads_df),
        "database": "connected"
    }


# DASHBOARD SUMMARY


@app.get("/api/dashboard/summary")
def dashboard_summary():

    return {
        "road_assessments": int(len(risk_df)),
        "incident_records": int(risk_df["Incident_Count"].sum()),
        "very_high_risk_roads": int(
            (risk_df["Risk_Level"] == "Very High").sum()
        ),
        "mapped_road_references": int(len(roads_df))
    }


# HISTORICAL ROAD RISK


@app.get("/api/road-risks")
def get_road_risks(
    state: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=500)
):

    result = risk_df.copy()

    if state:
        result = result[
            result["State"].str.lower() == state.lower()
        ]

    if search:
        result = result[
            result["Location_Route"].str.contains(
                search, case=False, na=False
            )
        ]

    result = result.sort_values(
        "Risk_Score", ascending=False
    ).head(limit)

    return {
        "count": len(result),
        "records": result.to_dict(orient="records")
    }


# --------------------------------------------------
# GEOGRAPHICAL ROAD REFERENCES
# --------------------------------------------------

@app.get("/api/road-features")
def get_road_features(
    west: Optional[float] = None,
    south: Optional[float] = None,
    east: Optional[float] = None,
    north: Optional[float] = None,
    limit: int = Query(default=1200, ge=1, le=5000)
):

    result = roads_df

    # Filter by map boundaries when supplied.
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

    # Limit map points to keep the browser responsive.
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

    records = result[columns].to_dict(orient="records")

    return {
        "total_matching": int(total_matching),
        "returned": len(records),
        "records": records,
        "description": (
            "OpenStreetMap road reference points, "
            "not confirmed incident locations."
        )
    }




# WAKASAFE LOCATION SEARCH AND ROAD ROUTING

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OSRM_URL = "https://router.project-osrm.org/route/v1/driving"

# Broad geographic boundary for Southeast Nigeria.
SE_VIEWBOX = "6.5,7.5,8.9,4.5"


@app.get("/api/locations/search")
def search_locations(
    q: str = Query(min_length=2, max_length=120),
    limit: int = Query(default=8, ge=1, le=10)
):
    """
    Search for places in the Southeast Nigeria region.
    Returns coordinates for use in route planning.
    """

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
            "User-Agent": "WakaSafe/1.0 (development route planner)",
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
                "name": item.get("name") or item.get("display_name"),
                "display_name": item.get("display_name"),
                "latitude": float(item["lat"]),
                "longitude": float(item["lon"]),
                "state": address.get("state", "Not specified"),
                "type": item.get("type", "place")
            })

        return {
            "count": len(locations),
            "locations": locations,
            "region": "Southeast Nigeria search area"
        }

    except (HTTPError, URLError, TimeoutError, ValueError) as error:
        raise HTTPException(
            status_code=502,
            detail=f"Location search service unavailable: {error}"
        )


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
        instruction = f"Turn {modifier}" if modifier else "Turn"

    elif maneuver_type == "merge":
        instruction = f"Merge {modifier}".strip()

    elif maneuver_type == "fork":
        instruction = f"At the fork, keep {modifier}".strip()

    elif maneuver_type == "on ramp":
        instruction = "Take the ramp"

    elif maneuver_type == "off ramp":
        instruction = "Take the exit ramp"

    elif maneuver_type == "end of road":
        instruction = f"At the end of the road, turn {modifier}".strip()

    elif maneuver_type == "new name":
        instruction = "Continue"

    else:
        instruction = "Continue straight"

    if road_name and maneuver_type != "arrive":
        instruction += f" onto {road_name}"

    return instruction


@app.get("/api/routes")
def calculate_routes(
    start_lat: float,
    start_lon: float,
    end_lat: float,
    end_lon: float
):
    """
    Calculate driving routes using the OpenStreetMap road network.
    Returns route geometry and turn-by-turn instructions.
    """

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
            "User-Agent": "WakaSafe/1.0 (development route planner)",
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
                detail="No driving route was found between these locations."
            )

        formatted_routes = []

        for index, route in enumerate(data["routes"]):
            directions = []

            for leg in route.get("legs", []):
                for step in leg.get("steps", []):
                    directions.append({
                        "instruction": format_route_instruction(step),
                        "road_name": step.get("name") or "Unnamed road",
                        "distance_metres": round(step.get("distance", 0)),
                        "duration_seconds": round(step.get("duration", 0)),
                        "maneuver": step.get("maneuver", {})
                    })

            formatted_routes.append({
                "route_number": index + 1,
                "distance_km": round(route["distance"] / 1000, 2),
                "duration_minutes": round(route["duration"] / 60),
                "geometry": route["geometry"],
                "directions": directions
            })

        return {
            "status": "success",
            "route_count": len(formatted_routes),
            "routes": formatted_routes,
            "routing_source": "OpenStreetMap road network via OSRM",
            "notice": (
                "Estimated driving routes and durations. "
                "Live traffic conditions are not included."
            )
        }

    except HTTPException:
        raise

    except (HTTPError, URLError, TimeoutError, ValueError) as error:
        raise HTTPException(
            status_code=502,
            detail=f"Routing service unavailable: {error}"
        )


# SUBMIT COMMUNITY INCIDENT REPORT


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
                report.severity,
                report.description.strip(),
                report.latitude,
                report.longitude,
                "Pending verification",
                created_at
            ))

            report_id = cursor.lastrowid
            connection.commit()

        return {
            "message": "Report received successfully.",
            "report_id": report_id,
            "verification_status": "Pending verification"
        }

    except sqlite3.Error as error:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to save report: {error}"
        )


# VIEW COMMUNITY REPORTS

@app.get("/api/reports")
def get_reports(
    status: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=500)
):

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


# COMMUNITY REPORT VERIFICATION

from fastapi import HTTPException

@app.patch("/api/reports/{report_id}/verification")
def verify_report(report_id: int, status: str):

    if status not in ["Verified", "Rejected"]:
        raise HTTPException(
            status_code=400,
            detail="Status must be Verified or Rejected."
        )

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

        connection.commit()

    return {
        "message": f"Report successfully marked as {status}.",
        "report_id": report_id,
        "verification_status": status
    }
import pandas as pd
from pathlib import Path
from fastapi import Query

HISTORICAL_RISK_FILE = (
    Path(__file__).resolve().parent.parent
    / "processed"
    / "wakasafe_historical_time_risk.csv"
)

@app.get("/api/historical-risk")
def get_historical_risk(
    state: str = Query(...),
    route: str = Query(...),
    time_of_day: str = Query(...)
):
    if not HISTORICAL_RISK_FILE.exists():
        return {"status": "error", "message": "Historical dataset not found"}

    data = pd.read_csv(HISTORICAL_RISK_FILE)

    result = data[
        (data["State"].str.lower() == state.lower()) &
        (data["Location_Route"].str.lower() == route.lower()) &
        (data["Time_of_Day"].str.lower() == time_of_day.lower())
    ]

    if result.empty:
        return {
            "status": "insufficient_data",
            "message": "No historical records for this route and time."
        }

    record = result.iloc[0]

    return {
        "status": "success",
        "state": record["State"],
        "route": record["Location_Route"],
        "time_of_day": record["Time_of_Day"],
        "incident_count": int(record["Incident_Count"]),
        "historical_activity_score": float(record["Historical_Activity_Score"]),
        "historical_activity_level": str(record["Historical_Activity_Level"]),
        "total_fatalities": int(record["Total_Fatalities"]),
        "total_injuries": int(record["Total_Injuries"])
    }
    # HISTORICAL ACTIVITY PREDICTION

@app.get("/api/predict-historical-activity")
def predict_historical_activity(
    state: str = Query(...),
    route: str = Query(...),
    time_of_day: str = Query(...)
):
    # Check whether this route and time exist in historical records
    match = historical_activity_df[
        (historical_activity_df["State"].astype(str).str.strip().str.casefold() == state.strip().casefold()) &
        (historical_activity_df["Location_Route"].astype(str).str.strip().str.casefold() == route.strip().casefold()) &
        (historical_activity_df["Time_of_Day"].astype(str).str.strip().str.casefold() == time_of_day.strip().casefold())
    ]

    if match.empty:
        return {
            "status": "insufficient_historical_data",
            "message": "No matching historical records are available for this route and time.",
            "state": state,
            "route": route,
            "time_of_day": time_of_day
        }

    input_data = pd.DataFrame([{
        "State": state,
        "Location_Route": route,
        "Time_of_Day": time_of_day
    }])

    predicted_level = activity_model.predict(input_data)[0]
    probabilities = activity_model.predict_proba(input_data)[0]
    confidence = float(max(probabilities) * 100)

    record = match.iloc[0]

    return {
        "status": "success",
        "state": state,
        "route": route,
        "time_of_day": time_of_day,
        "predicted_activity_level": str(predicted_level),
        "model_confidence": round(confidence, 2),
        "recorded_incidents": int(record["Incident_Count"]),
        "historical_activity_score": float(record["Historical_Activity_Score"]),
        "explanation": "This is an experimental classification of historical incident activity, not a guarantee of current road safety or a probability of an incident."
    }
