
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Map, Route, Bell, ShieldAlert, PlusCircle,
  ClipboardCheck, UserRound, Truck, Settings, Search, Menu,
  Moon, Sun, MapPin, Clock, AlertTriangle, CheckCircle2,
  ArrowUpRight, Navigation, Siren, ShieldCheck, Activity,
  ChevronRight, X, Send, Phone, LogOut, LifeBuoy, Users,
  BarChart3, Filter, LocateFixed
} from "lucide-react";

import {
  MapContainer, TileLayer, Marker, Popup, CircleMarker, Circle,
  useMap, Polyline
} from "react-leaflet";

const API_BASE = "https://wakasafe-project.onrender.com";

const navigation = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Safety Map", icon: Map },
  { name: "Route Planner", icon: Route },
  { name: "Alerts & Updates", icon: Bell },
  { name: "Report Incident", icon: PlusCircle },
  { name: "Verification Centre", icon: ClipboardCheck },
  { name: "Logistics", icon: Truck },
  { name: "Moderator", icon: Settings },
];

function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

/* ==================================================
   LIVE COMMUNITY REPORTS
================================================== */

function useCommunityReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadReports() {
    try {
      const response = await fetch(`${API_BASE}/api/reports`);

      if (!response.ok) {
        throw new Error("Unable to retrieve community reports.");
      }

      const data = await response.json();

      const activeReports = (data.reports || []).filter(
        report => report.verification_status !== "Rejected"
      );

      setReports(activeReports);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to retrieve community reports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();

    const interval = setInterval(loadReports, 15000);

    return () => clearInterval(interval);
  }, []);

  return {
    reports,
    loading,
    error,
    refreshReports: loadReports
  };
}

/* ==================================================
   DASHBOARD
================================================== */

function Dashboard({ navigate, summary }) {
  const {
    reports,
    loading,
    error,
    refreshReports
  } = useCommunityReports();

  const recentReports = reports.slice(0, 3);

  return (
    <>
      <div className="welcome-banner">
        <div>
          <span className="eyebrow">YOUR JOURNEY. YOUR SAFETY.</span>
          <h1>Stay informed.<br />Travel safer.</h1>
          <p>Get road safety updates, understand potential risks and make more informed travel decisions.</p>
          <button className="btn-primary" onClick={() => navigate("Route Planner")}>
            Plan a journey <ArrowUpRight size={17} />
          </button>
        </div>

        <div className="banner-art">
          <div className="radar radar-one"></div>
          <div className="radar radar-two"></div>
          <div className="radar-pin"><MapPin size={35}/></div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon teal"><MapPin/></div>
          <span>Road assessments</span>
          <strong>{summary ? Number(summary.road_assessments ?? 0).toLocaleString() : "Loading..."}</strong>
          <small>Historical road-risk records</small>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange"><AlertTriangle/></div>
          <span>Recorded incidents</span>
          <strong>{summary ? Number(summary.incident_records ?? 0).toLocaleString() : "Loading..."}</strong>
          <small>Represented in the historical dataset</small>
        </div>

        <div className="stat-card">
          <div className="stat-icon green"><ShieldCheck/></div>
          <span>Very-high-risk roads</span>
          <strong>{summary ? Number(summary.very_high_risk_roads ?? 0).toLocaleString() : "Loading..."}</strong>
          <small>Based on historical risk assessment</small>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue"><Activity/></div>
          <span>Road reference records</span>
          <strong>{summary ? Number(summary.mapped_road_references ?? 0).toLocaleString() : "Loading..."}</strong>
          <small>OpenStreetMap road references</small>
        </div>
      </div>

      <div className="content-grid">
        <div className="panel recent-panel">
          <SectionTitle
            title="Recent road updates"
            subtitle="Latest community-reported road incidents"
            action={
              <button className="text-button" onClick={() => navigate("Alerts & Updates")}>
                View all <ChevronRight size={15}/>
              </button>
            }
          />

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px" }}>
            <button className="text-button" onClick={refreshReports}>
              <Activity size={14}/> Refresh
            </button>
          </div>

          {loading && (
            <p className="demo-note">Loading community reports...</p>
          )}

          {error && (
            <p className="demo-note">{error}</p>
          )}

          {!loading && !error && recentReports.length === 0 && (
            <p className="demo-note">
              No community road reports available yet.
            </p>
          )}

          {recentReports.map(report => {
            const isVerified =
              report.verification_status === "Verified";

            return (
              <div className="incident-row" key={report.id}>
                <div className="incident-symbol">
                  <AlertTriangle size={18}/>
                </div>

                <div className="incident-info">
                  <strong>{report.incident_type}</strong>

                  <span>
                    <MapPin size={13}/> {report.location_route}
                  </span>

                  <small>
                    {report.state} • {report.incident_date}
                    {report.incident_time
                      ? ` • ${report.incident_time}`
                      : ""}
                  </small>
                </div>

                <span className={`status-pill ${isVerified ? "verified" : "review"}`}>
                  {isVerified ? "Verified" : "Under review"}
                </span>
              </div>
            );
          })}

          <p className="demo-note">
            Community reports are displayed according to their verification status.
            Reports that have been rejected are excluded.
          </p>
        </div>

        <div className="panel quick-panel">
          <SectionTitle title="Quick actions" subtitle="What would you like to do?" />

          <button className="quick-action" onClick={() => navigate("Safety Map")}>
            <span className="quick-icon"><Map size={18}/></span>
            <span><b>Explore safety map</b><small>View mapped road information</small></span>
            <ChevronRight/>
          </button>

          <button className="quick-action" onClick={() => navigate("Report Incident")}>
            <span className="quick-icon"><PlusCircle size={18}/></span>
            <span><b>Report an incident</b><small>Share a road safety concern</small></span>
            <ChevronRight/>
          </button>
        </div>
      </div>
    </>
  );
}

/* ==================================================
   MAP RECENTER
================================================== */

function MapRecenter({ position }) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.setView(position, 15, { animate: true });
    }
  }, [map, position]);

  return null;
}

/* ==================================================
   SAFETY MAP
================================================== */

function SafetyMap() {
  const [roads, setRoads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isTracking, setIsTracking] = useState(false);
  const [userPosition, setUserPosition] = useState(null);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_BASE}/api/road-features?limit=500`, {
      signal: controller.signal
    })
      .then(response => {
        if (!response.ok) {
          throw new Error("Could not retrieve road data.");
        }
        return response.json();
      })
      .then(data => {
        setRoads(data.records || []);
      })
      .catch(err => {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!isTracking) return undefined;

    if (!navigator.geolocation) {
      setLocationError("Your browser does not support location tracking.");
      setIsTracking(false);
      return undefined;
    }

    setLocationError("");

    const watchId = navigator.geolocation.watchPosition(
      position => {
        setUserPosition([
          position.coords.latitude,
          position.coords.longitude,
          position.coords.accuracy
        ]);
        setLocationError("");
      },
      err => {
        const messages = {
          1: "Location permission was denied. Allow location access in Chrome settings.",
          2: "Your current location is unavailable. Check your device location settings.",
          3: "Location request timed out. Please try again."
        };

        setLocationError(
          messages[err.code] || "Unable to retrieve your location."
        );
        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 20000
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isTracking]);

  const toggleTracking = () => {
    setLocationError("");
    setIsTracking(value => !value);
  };

  return (
    <div className="panel page-panel">
      <SectionTitle
        title="Safety Map"
        subtitle="Explore mapped road locations and your current position."
        action={
          <button className="btn-outline" onClick={toggleTracking}>
            <LocateFixed size={16}/>
            {isTracking ? "Stop tracking" : "Locate me"}
          </button>
        }
      />

      <div className="map-legend">
        <span><i className="dot blue-dot"></i> Road reference points</span>
        <span><i className="dot" style={{background:"#2563eb"}}></i> Your location</span>
      </div>

      <div className="map-frame">
        <MapContainer
          center={[5.532, 7.486]}
          zoom={8}
          scrollWheelZoom
          style={{height:"100%",width:"100%"}}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {roads.map((road, index) => (
            <CircleMarker
              key={road.id ?? index}
              center={[Number(road.latitude), Number(road.longitude)]}
              radius={4}
              pathOptions={{
                color:"#0d9488",
                fillColor:"#14b8a6",
                fillOpacity:0.8
              }}
            >
              <Popup>
                <strong>{road.name || "Unnamed road"}</strong>
                <br/>
                Road type: {road.highway}
                <br/>
                Surface: {road.surface}
                <br/>
                Lanes: {road.lanes}
                <br/>
                Length: {road.length} metres
              </Popup>
            </CircleMarker>
          ))}

          {userPosition && (
            <>
              <MapRecenter position={[userPosition[0], userPosition[1]]}/>

              <Circle
                center={[userPosition[0], userPosition[1]]}
                radius={userPosition[2]}
                pathOptions={{
                  color:"#2563eb",
                  fillColor:"#60a5fa",
                  fillOpacity:0.12
                }}
              />

              <CircleMarker
                center={[userPosition[0], userPosition[1]]}
                radius={9}
                pathOptions={{
                  color:"#ffffff",
                  weight:3,
                  fillColor:"#2563eb",
                  fillOpacity:1
                }}
              >
                <Popup>
                  <strong>Your current location</strong>
                  <br/>
                  GPS accuracy: approximately {Math.round(userPosition[2])} metres
                </Popup>
              </CircleMarker>
            </>
          )}
        </MapContainer>
      </div>

      {loading && <p className="demo-note">Loading road-reference points...</p>}
      {error && <p className="demo-note">Map data error: {error}</p>}
      {locationError && <p className="demo-note">{locationError}</p>}

      {isTracking && !userPosition && !locationError && (
        <p className="demo-note">Requesting your location from Chrome...</p>
      )}

      {userPosition && (
        <p className="demo-note">
          Your location is being tracked. GPS accuracy: approximately {Math.round(userPosition[2])} metres.
        </p>
      )}

      {!loading && !error && (
        <p className="demo-note">
          Displaying {roads.length.toLocaleString()} OpenStreetMap road-reference
          points. These are not confirmed incident locations or live risk predictions.
        </p>
      )}
    </div>
  );
}

/* ==================================================
   ROUTE MAP
================================================== */

function RouteMapBounds({ positions }) {
  const map = useMap();

  useEffect(() => {
    if (positions && positions.length > 1) {
      map.fitBounds(positions, { padding: [30, 30] });
    }
  }, [map, positions]);

  return null;
}

function RouteMap({ route }) {
  const coordinates = route?.geometry?.coordinates || [];

  const positions = coordinates.map(([longitude, latitude]) => [
    latitude,
    longitude
  ]);

  if (!positions.length) {
    return <p className="demo-note">No route geometry was returned for this option.</p>;
  }

  return (
    <div className="route-map-container">
      <MapContainer
        key={route.route_number ?? positions.length}
        center={positions[0]}
        zoom={9}
        scrollWheelZoom
        style={{height:"420px",width:"100%"}}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <RouteMapBounds positions={positions}/>

        <Polyline
          positions={positions}
          pathOptions={{
            color:"#0d9488",
            weight:5,
            opacity:0.85
          }}
        />

        <CircleMarker
          center={positions[0]}
          radius={8}
          pathOptions={{
            color:"#ffffff",
            fillColor:"#16a34a",
            fillOpacity:1
          }}
        >
          <Popup>Starting point</Popup>
        </CircleMarker>

        <CircleMarker
          center={positions[positions.length - 1]}
          radius={8}
          pathOptions={{
            color:"#ffffff",
            fillColor:"#dc2626",
            fillOpacity:1
          }}
        >
          <Popup>Destination</Popup>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}

/* ==================================================
   HISTORICAL ROUTE COMPARISON
================================================== */

const HISTORICAL_STATES = ["Abia", "Anambra", "Ebonyi", "Enugu", "Imo"];

const HISTORICAL_ROUTES = [
  "Enugu-Onitsha Expressway",
  "Ihiala-Orlu Road",
  "Owerri-Umuahia Road",
  "Enugu-Port Harcourt Expressway",
  "Awka-Ekwulobia Road",
  "Nnewi-Okigwe Road",
  "Enugu-Abakaliki Expressway",
  "Owerri-Onitsha Road",
  "Umuahia-Ikot Ekpene Road",
  "Okigwe-Uturu Road"
];

function normalizeRoadName(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getHistoricalRoute(selectedRoute, startPoint, destinationPoint) {
  const directionText = (selectedRoute?.directions || [])
    .map(step => `${step.road_name || ""} ${step.instruction || ""}`)
    .join(" ");

  const journeyText = [
    directionText,
    startPoint?.name,
    startPoint?.display_name,
    destinationPoint?.name,
    destinationPoint?.display_name
  ].join(" ");

  const normalizedText = normalizeRoadName(journeyText);

  return HISTORICAL_ROUTES.find(road =>
    normalizedText.includes(normalizeRoadName(road))
  ) || "";
}

function getHistoricalState(point) {
  const locationText = [
    point?.state,
    point?.address?.state,
    point?.display_name,
    point?.name
  ].join(" ").toLowerCase();

  return HISTORICAL_STATES.find(state =>
    locationText.includes(state.toLowerCase())
  ) || "";
}

function RouteComparison({
  routes,
  startPoint,
  destinationPoint,
  onSelectRoute
}) {
  const [state, setState] = useState(
    () => getHistoricalState(startPoint) || getHistoricalState(destinationPoint)
  );

  const [timeOfDay, setTimeOfDay] = useState(() => {
    const hour = new Date().getHours();

    return hour >= 5 && hour < 12 ? "Morning"
      : hour >= 12 && hour < 17 ? "Afternoon"
      : hour >= 17 && hour < 21 ? "Evening"
      : "Night";
  });

  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const detectedState =
      getHistoricalState(startPoint) ||
      getHistoricalState(destinationPoint);

    if (detectedState) {
      setState(detectedState);
    }
  }, [startPoint, destinationPoint]);

  useEffect(() => {
    if (!routes.length || !state || !timeOfDay) {
      setAssessments([]);
      return undefined;
    }

    const controller = new AbortController();

    async function compareRoutes() {
      setLoading(true);
      setError("");
      setAssessments([]);

      try {
        const results = await Promise.all(
          routes.map(async (route, index) => {
            const historicalRoute = getHistoricalRoute(
              route,
              startPoint,
              destinationPoint
            );

            if (!historicalRoute) {
              return {
                routeIndex: index,
                status: "insufficient_data",
                message: "This route could not be matched to a known historical road corridor."
              };
            }

            const params = new URLSearchParams({
              state,
              route: historicalRoute,
              time_of_day: timeOfDay
            });

            const response = await fetch(
              `${API_BASE}/api/historical-risk?${params.toString()}`,
              { signal: controller.signal }
            );

            const data = await response.json();

            if (!response.ok || data.status !== "success") {
              return {
                routeIndex: index,
                status: "insufficient_data",
                corridor: historicalRoute,
                message: data.message || "No matching historical records."
              };
            }

            return {
              ...data,
              routeIndex: index,
              corridor: historicalRoute,
              status: "success"
            };
          })
        );

        if (!controller.signal.aborted) {
          setAssessments(results);
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setError("Unable to compare historical route activity. Check your backend connection.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    compareRoutes();

    return () => controller.abort();
  }, [routes, state, timeOfDay, startPoint, destinationPoint]);

  const allRoutesAssessed =
    routes.length > 0 &&
    assessments.length === routes.length &&
    assessments.every(item => item.status === "success");

  const recommendation = allRoutesAssessed
    ? [...assessments].sort((a, b) => {
        const rank = {
          Lower: 1,
          Moderate: 2,
          Higher: 3
        };

        const riskDifference =
          (rank[a.historical_activity_level] ?? 99) -
          (rank[b.historical_activity_level] ?? 99);

        if (riskDifference !== 0) return riskDifference;

        return routes[a.routeIndex].distance_km -
          routes[b.routeIndex].distance_km;
      })[0]
    : null;

  useEffect(() => {
    if (recommendation) {
      onSelectRoute(recommendation.routeIndex);
    }
  }, [recommendation?.routeIndex, onSelectRoute]);

  const allHigher =
    allRoutesAssessed &&
    assessments.every(item => item.historical_activity_level === "Higher");

  return (
    <div className="form-card activity-assessment">
      <h3>Compare available routes</h3>

      <p>
        IwakaSafe compares historical incident activity for each route.
        It does not measure live road conditions.
      </p>

      <label htmlFor="comparison-state">State for historical records</label>
      <select
        id="comparison-state"
        value={state}
        onChange={e => setState(e.target.value)}
      >
        <option value="">Select state</option>
        {HISTORICAL_STATES.map(item => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>

      <label htmlFor="comparison-time">Planned departure time</label>
      <select
        id="comparison-time"
        value={timeOfDay}
        onChange={e => setTimeOfDay(e.target.value)}
      >
        <option>Morning</option>
        <option>Afternoon</option>
        <option>Evening</option>
        <option>Night</option>
      </select>

      {loading && (
        <p className="demo-note">Comparing historical activity across routes...</p>
      )}

      {error && (
        <p className="report-status-message" role="alert">{error}</p>
      )}

      {!loading && !error && !state && (
        <p className="demo-note">
          Select the state where your journey begins to compare historical records.
        </p>
      )}

      {recommendation && (
        <div className="activity-assessment-result">
          <h4>
            Recommended: Route {recommendation.routeIndex + 1}
          </h4>

          <p>
            Historical activity: <strong>{recommendation.historical_activity_level}</strong>
          </p>

          <p>
            Recorded incidents in the selected period:{" "}
            <strong>{recommendation.incident_count}</strong>
          </p>

          <p>
            Distance:{" "}
            <strong>
              {Number(routes[recommendation.routeIndex].distance_km).toFixed(1)} km
            </strong>
          </p>

          <p>
            {allHigher
              ? "All compared routes have higher historical activity. This is the least elevated option among the available routes, not a guarantee of safety."
              : "This route has the lowest historical activity category. Where activity categories are equal, the shorter route is recommended."}
          </p>
        </div>
      )}

      {assessments.length > 0 && (
        <div className="route-comparison-list">
          <h4>Route-by-route comparison</h4>

          {routes.map((route, index) => {
            const result = assessments.find(
              item => item.routeIndex === index
            );

            return (
              <div className="route-option" key={route.route_number ?? index}>
                <b>Route {index + 1}</b>

                <span>
                  {Number(route.distance_km).toFixed(1)} km
                </span>

                <span>
                  {Math.round(route.duration_minutes)} min
                </span>

                {result?.status === "success" ? (
                  <span>
                    {result.historical_activity_level} activity
                    {" · "}
                    {result.incident_count} incidents
                  </span>
                ) : (
                  <span>Insufficient historical data</span>
                )}

                {recommendation?.routeIndex === index && (
                  <strong>Recommended</strong>
                )}

                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => onSelectRoute(index)}
                >
                  View this route
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="demo-note">
        Historical activity is not a live safety rating. A route with lower
        historical activity is not guaranteed to be safe. Routes without
        matching historical records cannot be reliably compared.
      </p>
    </div>
  );
}

/* ==================================================
   ROUTE PLANNER
================================================== */

function RoutePlanner() {
  const [start, setStart] = useState("");
  const [destination, setDestination] = useState("");

  const [startPoint, setStartPoint] = useState(null);
  const [destinationPoint, setDestinationPoint] = useState(null);

  const [startSuggestions, setStartSuggestions] = useState([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);

  const [routeData, setRouteData] = useState(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);

  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (startPoint || start.trim().length < 2) {
      setStartSuggestions([]);
      return undefined;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/locations/search?q=${encodeURIComponent(start)}`,
          {signal:controller.signal}
        );

        if (!response.ok) throw new Error("Location search failed");

        const data = await response.json();
        setStartSuggestions(data.locations || []);
      } catch (err) {
        if (err.name !== "AbortError") setStartSuggestions([]);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [start, startPoint]);

  useEffect(() => {
    if (destinationPoint || destination.trim().length < 2) {
      setDestinationSuggestions([]);
      return undefined;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/locations/search?q=${encodeURIComponent(destination)}`,
          {signal:controller.signal}
        );

        if (!response.ok) throw new Error("Location search failed");

        const data = await response.json();
        setDestinationSuggestions(data.locations || []);
      } catch (err) {
        if (err.name !== "AbortError") setDestinationSuggestions([]);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [destination, destinationPoint]);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Your browser does not support location services.");
      return;
    }

    setLocationLoading(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      position => {
        const point = {
          name: "My current location",
          display_name: "My current location",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };

        setStartPoint(point);
        setStart("My current location");
        setStartSuggestions([]);
        setRouteData(null);
        setLocationLoading(false);
      },
      err => {
        setLocationLoading(false);

        if (err.code === 1) {
          setError("Location permission was denied. Allow location access in Chrome and try again.");
        } else if (err.code === 2) {
          setError("Your current location could not be determined.");
        } else {
          setError("Location request timed out. Please try again.");
        }
      },
      {
        enableHighAccuracy:true,
        timeout:20000,
        maximumAge:5000
      }
    );
  }

  async function assessRoute() {
    setError("");
    setRouteData(null);

    if (!startPoint || !destinationPoint) {
      setError("Please select both locations from the search suggestions.");
      return;
    }

    setLoading(true);

    try {
      const parameters = new URLSearchParams({
        start_lat:String(startPoint.latitude),
        start_lon:String(startPoint.longitude),
        end_lat:String(destinationPoint.latitude),
        end_lon:String(destinationPoint.longitude)
      });

      const response = await fetch(
        `${API_BASE}/api/routes?${parameters.toString()}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to calculate this route.");
      }

      if (!data.routes || data.routes.length === 0) {
        throw new Error("No driving route was returned for these locations.");
      }

      setRouteData(data);
      setSelectedRouteIndex(0);

    } catch (err) {
      setError(err.message || "Something went wrong while calculating the route.");
    } finally {
      setLoading(false);
    }
  }

  const routes = routeData?.routes || [];
  const selectedRoute = routes[selectedRouteIndex];

  return (
    <div className="panel page-panel">
      <SectionTitle
        title="Route Planner"
        subtitle="Find road directions and explore available routes across Southeast Nigeria."
      />

      <div className="form-card route-planner-form">
        <label>Starting point</label>

        <div className="input-icon">
          <MapPin/>
          <input
            value={start}
            onChange={e => {
              setStart(e.target.value);
              setStartPoint(null);
              setRouteData(null);
            }}
            placeholder="Search a town, road or community"
          />
        </div>

        <button
          type="button"
          className="btn-location"
          onClick={useCurrentLocation}
          disabled={locationLoading}
        >
          <MapPin size={16}/>
          {locationLoading ? "Finding your location..." : "Use my current location"}
        </button>

        {startSuggestions.length > 0 && (
          <div className="location-suggestions">
            {startSuggestions.map((item,index) => (
              <button
                type="button"
                key={`${item.display_name}-${index}`}
                onClick={() => {
                  setStartPoint(item);
                  setStart(item.display_name);
                  setStartSuggestions([]);
                  setRouteData(null);
                }}
              >
                <MapPin size={16}/>
                <span>
                  <b>{item.name}</b>
                  <small>{item.display_name}</small>
                </span>
              </button>
            ))}
          </div>
        )}

        <label>Destination</label>

        <div className="input-icon">
          <Navigation/>
          <input
            value={destination}
            onChange={e => {
              setDestination(e.target.value);
              setDestinationPoint(null);
              setRouteData(null);
            }}
            placeholder="e.g. Owerri, Imo State"
          />
        </div>

        {destinationSuggestions.length > 0 && (
          <div className="location-suggestions">
            {destinationSuggestions.map((item,index) => (
              <button
                type="button"
                key={`${item.display_name}-${index}`}
                onClick={() => {
                  setDestinationPoint(item);
                  setDestination(item.display_name);
                  setDestinationSuggestions([]);
                  setRouteData(null);
                }}
              >
                <MapPin size={16}/>
                <span>
                  <b>{item.name}</b>
                  <small>{item.display_name}</small>
                </span>
              </button>
            ))}
          </div>
        )}

        <button
          className="btn-primary"
          onClick={assessRoute}
          disabled={loading || !startPoint || !destinationPoint}
        >
          {loading ? "Calculating route..." : "Find driving route"}
          {!loading && <ArrowUpRight size={17}/>}
        </button>

        {error && (
          <div className="route-error" role="alert">
            {error}
          </div>
        )}
      </div>

      {selectedRoute && (
        <div className="route-results">
          <div className="route-result-heading">
            <h3>Your driving route</h3>
            <p>
              {startPoint?.name || startPoint?.display_name}
              {" → "}
              {destinationPoint?.name || destinationPoint?.display_name}
            </p>
          </div>

          <div className="route-stat-grid">
            <div className="route-stat">
              <b>{Number(selectedRoute.distance_km).toFixed(1)} km</b>
              <small>Driving distance</small>
            </div>

            <div className="route-stat">
              <b>{Math.round(selectedRoute.duration_minutes)} min</b>
              <small>Estimated journey time</small>
            </div>

            <div className="route-stat">
              <b>{routes.length}</b>
              <small>Available route options</small>
            </div>
          </div>

          {routes.length > 1 && (
            <div className="route-options">
              <h4>Choose a route</h4>

              <div className="route-option-list">
                {routes.map((route, index) => (
                  <button
                    type="button"
                    key={route.route_number ?? index}
                    className={`route-option ${selectedRouteIndex === index ? "active" : ""}`}
                    style={{
                      border: `2px solid ${
                        index === 0 ? "#16a34a" :
                        index === 1 ? "#dc2626" :
                        index === 2 ? "#eab308" : "#d1d5db"
                      }`
                    }}
                    onClick={() => setSelectedRouteIndex(index)}
                  >
                    <b>Route {route.route_number || index + 1}</b>
                    <span>{Number(route.distance_km).toFixed(1)} km</span>
                    <span>{Math.round(route.duration_minutes)} min</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <h4>Route map</h4>
          <RouteMap route={selectedRoute}/>

          <div className="route-directions">
            <h4>Turn-by-turn directions</h4>

            <ol>
              {(selectedRoute.directions || []).map((step,index) => (
                <li key={index}>
                  <div>
                    <b>{step.instruction}</b>
                    <small>
                      {step.road_name && step.road_name !== "Unnamed road"
                        ? step.road_name + " · "
                        : ""}
                      {Number(step.distance_metres) >= 1000
                        ? (Number(step.distance_metres) / 1000).toFixed(1) + " km"
                        : step.distance_metres + " m"}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="route-notice">
            <ShieldCheck/>
            <div>
              <b>About these route results</b>
              <p>
                Driving directions are estimated from OpenStreetMap.
                Travel times do not include live traffic.
              </p>
            </div>
          </div>
        </div>
      )}

      {!routeData && (
        <div className="info-strip">
          <ShieldCheck/>
          <div>
            <b>Risk-aware route planning</b>
            <p>
              IwakaSafe is being designed to consider reported incidents,
              historical risk patterns and available road information.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==================================================
   ALERTS & UPDATES
================================================== */

function AlertsPage() {
  const {
    reports,
    loading,
    error,
    refreshReports
  } = useCommunityReports();

  return (
    <div className="panel page-panel">
      <SectionTitle
        title="Alerts & Updates"
        subtitle="Stay informed about community-reported road incidents and safety notices."
        action={
          <button className="btn-outline" onClick={refreshReports}>
            <Activity size={16}/> Refresh
          </button>
        }
      />

      {loading && (
        <p className="demo-note">Loading community reports...</p>
      )}

      {error && (
        <p className="demo-note">{error}</p>
      )}

      {!loading && !error && reports.length === 0 && (
        <div className="empty-state">
          <Bell size={42}/>
          <h3>No active road reports</h3>
          <p>Community reports will appear here when submitted.</p>
        </div>
      )}

      {reports.map(report => {
        const isVerified =
          report.verification_status === "Verified";

        return (
          <div className="incident-row" key={report.id}>
            <div className="incident-symbol">
              <Bell size={18}/>
            </div>

            <div className="incident-info">
              <strong>{report.incident_type}</strong>

              <span>
                <MapPin size={13}/> {report.location_route}
              </span>

              <small>
                {report.state} • {report.incident_date}
                {report.incident_time
                  ? ` • ${report.incident_time}`
                  : ""}
              </small>

              <small>
                Severity: {report.severity || "Unknown"}
              </small>

              {report.description && (
                <small>{report.description}</small>
              )}
            </div>

            <span className={`status-pill ${isVerified ? "verified" : "review"}`}>
              {isVerified ? "Verified" : "Under review"}
            </span>
          </div>
        );
      })}

      <p className="demo-note">
        Reports awaiting verification are labelled Under review.
        Only verified reports have been approved by a moderator.
        Rejected reports are not displayed in this feed.
      </p>
    </div>
  );
}

/* ==================================================
   SOS
================================================== */

function SosPage() {
  const [showOptions, setShowOptions] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  function toggleOptions() {
    const savedName = localStorage.getItem("iwakasafe_sos_contact_name") || "";
    const savedPhone = localStorage.getItem("iwakasafe_sos_contact_phone") || "";

    setContactName(savedName);
    setContactPhone(savedPhone);
    setShowOptions(value => !value);
  }

  return (
    <div style={{
      position: "fixed",
      right: "25px",
      bottom: "25px",
      zIndex: 2000
    }}>
      {showOptions && (
        <div style={{
          background: "white",
          color: "#222",
          padding: "18px",
          borderRadius: "12px",
          width: "260px",
          marginBottom: "12px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.2)"
        }}>
          <h3>Emergency assistance</h3>

          <a href="tel:112" className="sos-option">
            <Phone size={18}/> Call National Emergency (112)
          </a>

          {contactPhone ? (
            <a href={`tel:${contactPhone}`} className="sos-option">
              <Phone size={18}/> Call {contactName || "Emergency Contact"}
            </a>
          ) : (
            <p className="demo-note">
              Add your family contact in My Profile to enable the second call option.
            </p>
          )}
        </div>
      )}

      <button
        onClick={toggleOptions}
        style={{
          width: "70px",
          height: "70px",
          borderRadius: "50%",
          background: "#dc2626",
          color: "white",
          border: "none",
          fontSize: "19px",
          fontWeight: "bold",
          cursor: "pointer",
          boxShadow: "0 4px 15px rgba(220,38,38,0.4)"
        }}
      >
        SOS
      </button>
    </div>
  );
}

/* ==================================================
   REPORT INCIDENT
================================================== */

function ReportPage() {
  const [type,setType] = useState("Road accident");
  const [state,setState] = useState("Abia");
  const [location,setLocation] = useState("");
  const [details,setDetails] = useState("");
  const [incidentDate,setIncidentDate] = useState(new Date().toISOString().slice(0,10));
  const [incidentTime,setIncidentTime] = useState("");
  const [severity,setSeverity] = useState("");
  const [coordinates,setCoordinates] = useState(null);
  const [locating,setLocating] = useState(false);
  const [submitting,setSubmitting] = useState(false);
  const [message,setMessage] = useState("");

  function captureIncidentLocation() {
    if (!navigator.geolocation) {
      setMessage("Your browser does not support location services.");
      return;
    }

    setLocating(true);
    setMessage("");

    navigator.geolocation.getCurrentPosition(
      position => {
        setCoordinates({
          latitude:position.coords.latitude,
          longitude:position.coords.longitude
        });
        setLocation("Incident location captured using GPS");
        setLocating(false);
      },
      err => {
        setLocating(false);

        if (err.code === 1) {
          setMessage("Location permission denied. Allow location access in Chrome and try again.");
        } else if (err.code === 2) {
          setMessage("Your location could not be determined. Try moving to an area with better GPS or network reception.");
        } else {
          setMessage("Location request timed out. Please try again.");
        }
      },
      {
        enableHighAccuracy:true,
        timeout:20000,
        maximumAge:5000
      }
    );
  }

  async function submitIncident() {
    if (!location.trim() || !details.trim()) {
      setMessage("Please enter the incident location and describe what happened.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    const report = {
      state,
      location_route:location,
      incident_type:type,
      incident_date:incidentDate,
      incident_time:incidentTime,
      severity,
      description:details,
      latitude:coordinates?.latitude ?? null,
      longitude:coordinates?.longitude ?? null
    };

    try {
      const response = await fetch(`${API_BASE}/api/reports`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(report)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "The report could not be submitted.");
      }

      setMessage(
        `Your incident report (#${result.report_id}) was submitted successfully and is pending verification.`
      );

      setType("Road accident");
      setState("Abia");
      setLocation("");
      setDetails("");
      setIncidentDate(new Date().toISOString().slice(0,10));
      setIncidentTime("");
      setSeverity("");
      setCoordinates(null);

    } catch (err) {
      setMessage(err.message || "Unable to submit your report. Check that the IwakaSafe backend is running.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel page-panel">
      <SectionTitle
        title="Report an Incident"
        subtitle="Help other road users by sharing useful information."
      />

      <div className="form-card">
        <label>Incident category</label>
        <select value={type} onChange={e => setType(e.target.value)}>
          <option>Road accident</option>
          <option>Robbery</option>
          <option>Suspected fake checkpoint</option>
          <option>Traffic congestion</option>
          <option>Road hazard</option>
          <option>Flooding</option>
          <option>Other</option>
        </select>

        <label>Incident date</label>
        <input type="date" value={incidentDate} onChange={e => setIncidentDate(e.target.value)} required/>

        <label>Approximate incident time</label>
        <input type="time" value={incidentTime} onChange={e => setIncidentTime(e.target.value)} required/>

        <label>Incident severity</label>
        <select value={severity} onChange={e => setSeverity(e.target.value)} required>
          <option value="">Select severity</option>
          <option value="Minor">Minor</option>
          <option value="Moderate">Moderate</option>
          <option value="Serious">Serious</option>
          <option value="Critical">Critical</option>
        </select>

        <label>State</label>
        <select value={state} onChange={e => setState(e.target.value)}>
          <option>Abia</option>
          <option>Anambra</option>
          <option>Ebonyi</option>
          <option>Enugu</option>
          <option>Imo</option>
          <option>Other</option>
        </select>

        <label>Incident location</label>
        <input
          value={location}
          onChange={e => {
            setLocation(e.target.value);
            setCoordinates(null);
          }}
          placeholder="Enter road, town, community or landmark"
        />

        <button
          type="button"
          className="btn-location"
          onClick={captureIncidentLocation}
          disabled={locating}
        >
          <MapPin size={16}/>
          {locating ? "Detecting location..." : "Use my current location"}
        </button>

        {coordinates && (
          <div className="incident-location-preview">
            <div className="incident-location-details">
              <ShieldCheck size={17}/>
              <span>
                <b>GPS coordinates captured</b>
                <small>
                  Latitude: {coordinates.latitude.toFixed(6)} ·
                  Longitude: {coordinates.longitude.toFixed(6)}
                </small>
              </span>
            </div>

            <MapContainer
              center={[coordinates.latitude,coordinates.longitude]}
              zoom={15}
              scrollWheelZoom
              style={{height:"220px",width:"100%"}}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={[coordinates.latitude,coordinates.longitude]}>
                <Popup>Captured incident location</Popup>
              </Marker>
            </MapContainer>
          </div>
        )}

        <label>What happened?</label>
        <textarea
          value={details}
          onChange={e => setDetails(e.target.value)}
          placeholder="Describe what you observed, including useful details such as the road condition or direction of travel..."
          rows="5"
        />

        <button
          className="btn-primary"
          onClick={submitIncident}
          disabled={!location.trim() || !details.trim() || !incidentDate || !incidentTime || !severity || submitting}
        >
          <Send size={16}/>
          {submitting ? "Submitting report..." : "Submit report"}
        </button>

        {message && (
          <div className="report-status-message" role="status">
            {message}
          </div>
        )}

        <p className="demo-note">
          Do not submit sensitive personal information. GPS coordinates are
          optional. Reports remain pending verification until reviewed.
        </p>
      </div>
    </div>
  );
}

/* ==================================================
   VERIFICATION CENTRE
================================================== */

function VerificationPage() {
  const [reports,setReports] = useState([]);
  const [loading,setLoading] = useState(true);
  const [message,setMessage] = useState("");
  const [processingId,setProcessingId] = useState(null);

  async function loadReports() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/api/reports?status=Pending%20verification`
      );

      if (!response.ok) {
        throw new Error("Unable to retrieve community reports.");
      }

      const data = await response.json();
      setReports(data.reports || []);

    } catch (err) {
      setMessage(err.message || "Could not connect to IwakaSafe backend.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  async function reviewReport(reportId,status) {
    setProcessingId(reportId);
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/api/reports/${reportId}/verification?status=${encodeURIComponent(status)}`,
        {method:"PATCH"}
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Could not update report.");
      }

      setMessage(`Report #${reportId} marked as ${status}.`);
      await loadReports();

    } catch (err) {
      setMessage(err.message || "Verification failed.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="panel page-panel">
      <SectionTitle
        title="Verification Centre"
        subtitle="Review community reports before they become trusted safety information."
        action={<button className="btn-primary" onClick={loadReports}>Refresh reports</button>}
      />

      <div className="stats-grid">
        <div className="stat-card">
          <span>Pending reports</span>
          <strong>{reports.length}</strong>
        </div>
      </div>

      {message && (
        <div className="report-status-message" role="status">
          {message}
        </div>
      )}

      {loading ? (
        <div className="empty-state">
          <p>Loading community reports...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="empty-state">
          <ClipboardCheck size={42}/>
          <h3>No pending reports</h3>
          <p>New community reports awaiting review will appear here.</p>
        </div>
      ) : (
        <div className="verification-reports">
          {reports.map(report => (
            <div className="form-card" key={report.id}>
              <div className="section-title">
                <h3>Report #{report.id}</h3>
                <span>Pending verification</span>
              </div>

              <p><strong>Incident:</strong> {report.incident_type}</p>
              <p><strong>State:</strong> {report.state}</p>
              <p><strong>Location:</strong> {report.location_route}</p>
              <p><strong>Date:</strong> {report.incident_date || "Not provided"}</p>
              <p><strong>Time:</strong> {report.incident_time || "Not provided"}</p>
              <p><strong>Severity:</strong> {report.severity || "Unknown"}</p>
              <p><strong>Description:</strong> {report.description}</p>

              {report.latitude != null && report.longitude != null && (
                <p><strong>Coordinates:</strong> {report.latitude}, {report.longitude}</p>
              )}

              <div className="verification-actions">
                <button
                  className="btn-primary"
                  disabled={processingId === report.id}
                  onClick={() => reviewReport(report.id,"Verified")}
                >
                  <CheckCircle2 size={16}/>
                  {processingId === report.id ? "Processing..." : "Verify"}
                </button>

                <button
                  className="btn-danger"
                  disabled={processingId === report.id}
                  onClick={() => reviewReport(report.id,"Rejected")}
                >
                  <X size={16}/> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="demo-note">
        Development notice: Moderator authentication is not yet enabled.
        Verification decisions are currently accessible through this interface
        without a moderator login.
      </p>
    </div>
  );
}

/* ==================================================
   PROFILE
================================================== */

function ProfilePage() {
  const [name, setName] = useState(
    () => localStorage.getItem("iwakasafe_profile_name") || ""
  );
  const [email, setEmail] = useState(
    () => localStorage.getItem("iwakasafe_profile_email") || ""
  );
  const [phone, setPhone] = useState(
    () => localStorage.getItem("iwakasafe_profile_phone") || ""
  );
  const [contactName, setContactName] = useState(
    () => localStorage.getItem("iwakasafe_sos_contact_name") || ""
  );
  const [contactPhone, setContactPhone] = useState(
    () => localStorage.getItem("iwakasafe_sos_contact_phone") || ""
  );

  const [editingProfile, setEditingProfile] = useState(false);
  const [message, setMessage] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [showPremiumPlans, setShowPremiumPlans] = useState(false);
  const [browserNotifications, setBrowserNotifications] = useState(
    () => localStorage.getItem("iwakasafe_browser_notifications") === "true"
  );
  const [incidentAlerts, setIncidentAlerts] = useState(
    () => localStorage.getItem("iwakasafe_incident_alerts") !== "false"
  );
  const [safetyUpdates, setSafetyUpdates] = useState(
    () => localStorage.getItem("iwakasafe_safety_updates") !== "false"
  );

  function saveProfile() {
    if (!name.trim()) {
      setMessage("Please enter your full name.");
      return;
    }

    localStorage.setItem("iwakasafe_profile_name", name.trim());
    localStorage.setItem("iwakasafe_profile_email", email.trim());
    localStorage.setItem("iwakasafe_profile_phone", phone.trim());

    window.dispatchEvent(new Event("iwakasafe-profile-updated"));
    setEditingProfile(false);
    setMessage("Personal details saved.");
  }

  function saveEmergencyContact() {
    if (!contactName.trim() || !contactPhone.trim()) {
      setContactMessage("Enter both the contact name and phone number.");
      return;
    }

    localStorage.setItem("iwakasafe_sos_contact_name", contactName.trim());
    localStorage.setItem("iwakasafe_sos_contact_phone", contactPhone.trim());

    setContactMessage("Emergency contact saved.");
  }

  function removeEmergencyContact() {
    localStorage.removeItem("iwakasafe_sos_contact_name");
    localStorage.removeItem("iwakasafe_sos_contact_phone");
    setContactName("");
    setContactPhone("");
    setContactMessage("Emergency contact removed.");
  }

  function saveNotificationPreference(key, value, setter) {
    setter(value);
    localStorage.setItem(key, String(value));
  }

  return (
    <div className="panel page-panel">
      <SectionTitle
        title="My Profile"
        subtitle="Manage your personal information, emergency contacts and preferences."
      />

      <div className="form-card">
        <h3>Personal information</h3>

        <label>Full name</label>
        <input
          value={name}
          disabled={!editingProfile}
          onChange={e => setName(e.target.value)}
          placeholder="Enter your full name"
        />

        <label>Email address</label>
        <input
          type="email"
          value={email}
          disabled={!editingProfile}
          onChange={e => setEmail(e.target.value)}
          placeholder="Enter your email"
        />

        <label>Phone number</label>
        <input
          value={phone}
          disabled={!editingProfile}
          onChange={e => setPhone(e.target.value)}
          placeholder="Enter your phone number"
        />

        {editingProfile ? (
          <button className="btn-primary" onClick={saveProfile}>
            Save changes
          </button>
        ) : (
          <button
            className="btn-outline"
            onClick={() => {
              setMessage("");
              setEditingProfile(true);
            }}
          >
            Edit personal information
          </button>
        )}

        {message && <p className="demo-note">{message}</p>}
      </div>

      <div className="form-card">
        <h3>Emergency contact</h3>
        <p>Add a trusted family member for quick emergency calls.</p>

        <label>Contact name</label>
        <input
          value={contactName}
          onChange={e => setContactName(e.target.value)}
          placeholder="Enter contact name"
        />

        <label>Contact phone number</label>
        <input
          value={contactPhone}
          onChange={e => setContactPhone(e.target.value)}
          placeholder="Enter phone number"
        />

        <button className="btn-primary" onClick={saveEmergencyContact}>
          Save emergency contact
        </button>

        {contactPhone && (
          <button
            className="btn-danger"
            onClick={removeEmergencyContact}
          >
            Remove emergency contact
          </button>
        )}

        {contactMessage && (
          <p className="demo-note">{contactMessage}</p>
        )}
      </div>

      <div className="form-card">
        <h3>Notification preferences</h3>

        <label>
          <input
            type="checkbox"
            checked={browserNotifications}
            onChange={e =>
              saveNotificationPreference(
                "iwakasafe_browser_notifications",
                e.target.checked,
                setBrowserNotifications
              )
            }
          />
          Browser notifications
        </label>

        <label>
          <input
            type="checkbox"
            checked={incidentAlerts}
            onChange={e =>
              saveNotificationPreference(
                "iwakasafe_incident_alerts",
                e.target.checked,
                setIncidentAlerts
              )
            }
          />
          Road incident alerts
        </label>

        <label>
          <input
            type="checkbox"
            checked={safetyUpdates}
            onChange={e =>
              saveNotificationPreference(
                "iwakasafe_safety_updates",
                e.target.checked,
                setSafetyUpdates
              )
            }
          />
          General safety updates
        </label>

        <p className="demo-note">
          These preferences are saved locally. Automatic notifications are not connected yet.
        </p>
      </div>

      <div className="form-card">
        <h3>IwakaSafe Premium</h3>
        <p>Get access to enhanced road safety features and insights.</p>

        <button
          type="button"
          className="btn-primary"
          onClick={() => setShowPremiumPlans(value => !value)}
        >
          {showPremiumPlans ? "Close plans" : "Upgrade plan"}
        </button>

        {showPremiumPlans && (
          <div className="feature-grid">
            <div className="feature-card">
              <h3>Monthly Plan</h3>
              <h2>₦15,000 <small>/month</small></h2>
            </div>

            <div className="feature-card">
              <h3>Yearly Plan</h3>
              <h2>₦150,000 <small>/year</small></h2>
            </div>
          </div>
        )}

        <p className="demo-note">
          Subscription payment and activation are not available yet.
        </p>
      </div>

      <div className="form-card">
        <h3>Account security</h3>
        <p>Password management will be available when user authentication is implemented.</p>
        <button className="btn-outline" disabled>
          Change password
        </button>
      </div>
    </div>
  );
}

/* ==================================================
   LOGISTICS
================================================== */

function LogisticsPage() {
  return (
    <div className="panel page-panel">
      <SectionTitle title="Logistics" subtitle="Tools planned for fleet operators, delivery teams and professional drivers."/>

      <div className="feature-grid">
        <div className="feature-card"><Truck/><h3>Fleet overview</h3><p>Monitor registered vehicles and journey activity.</p></div>
        <div className="feature-card"><Route/><h3>Journey planning</h3><p>Plan journeys with road-risk information.</p></div>
        <div className="feature-card"><Users/><h3>Driver management</h3><p>Manage driver accounts and access.</p></div>
        <div className="feature-card"><BarChart3/><h3>Trip insights</h3><p>Review journey and incident summaries.</p></div>
      </div>
    </div>
  );
}

/* ==================================================
   MODERATOR
================================================== */

function ModeratorPage() {
  return (
    <div className="panel page-panel">
      <SectionTitle title="Moderator Dashboard" subtitle="Tools for reviewing reports and maintaining platform quality."/>

      <div className="feature-grid">
        <div className="feature-card"><ClipboardCheck/><h3>Review reports</h3><p>Inspect new submissions and supporting evidence.</p></div>
        <div className="feature-card"><ShieldCheck/><h3>Verify incidents</h3><p>Approve, reject or request more information.</p></div>
        <div className="feature-card"><Users/><h3>Manage users</h3><p>Review user accounts and permissions.</p></div>
        <div className="feature-card"><BarChart3/><h3>Platform activity</h3><p>Monitor reports and moderation statistics.</p></div>
      </div>
    </div>
  );
}

/* ==================================================
   MAIN APPLICATION
================================================== */

export default function App() {
  const [active,setActive] = useState("Dashboard");
  const [dark,setDark] = useState(false);
  const [mobileOpen,setMobileOpen] = useState(false);
  const [summary,setSummary] = useState(null);

  const [profileName, setProfileName] = useState(
    () => localStorage.getItem("iwakasafe_profile_name") || "IwakaSafe User"
  );

  useEffect(() => {
    const updateProfileName = () => {
      setProfileName(
        localStorage.getItem("iwakasafe_profile_name") || "IwakaSafe User"
      );
    };

    window.addEventListener("iwakasafe-profile-updated", updateProfileName);

    return () => {
      window.removeEventListener("iwakasafe-profile-updated", updateProfileName);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_BASE}/api/dashboard/summary`, {
      signal:controller.signal
    })
      .then(response => {
        if (!response.ok) {
          throw new Error("Dashboard API request failed");
        }
        return response.json();
      })
      .then(data => setSummary(data))
      .catch(err => {
        if (err.name !== "AbortError") {
          console.error("iwakasafe API error:",err);
        }
      });

    return () => controller.abort();
  }, []);

  const navigate = page => {
    setActive(page);
    setMobileOpen(false);
  };

  const pageContent = {
    "Dashboard": <Dashboard navigate={navigate} summary={summary}/>,
    "Safety Map": <SafetyMap/>,
    "Route Planner": <RoutePlanner/>,
    "Alerts & Updates": <AlertsPage/>,
    "Report Incident": <ReportPage/>,
    "Verification Centre": <VerificationPage/>,
    "My Profile": <ProfilePage/>,
    "Logistics": <LogisticsPage/>,
    "Moderator": <ModeratorPage/>
  };

  return (
    <div className={`app-shell ${dark ? "dark-theme" : ""}`}>
      {mobileOpen && (
        <div className="mobile-overlay" onClick={() => setMobileOpen(false)}></div>
      )}

      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><ShieldCheck size={23}/></div>
          <div><strong>iwakasafe</strong><small>SAFER JOURNEYS</small></div>
          <button className="mobile-close" onClick={() => setMobileOpen(false)}>
            <X/>
          </button>
        </div>

        <div className="nav-label">WORKSPACE</div>

        <nav>
          {navigation.map(item => {
            const Icon = item.icon;

            return (
              <button
                key={item.name}
                className={`nav-item ${active === item.name ? "active" : ""}`}
                onClick={() => navigate(item.name)}
              >
                <Icon size={19}/>
                <span>{item.name}</span>
                {item.name === "Alerts & Updates" && <i className="nav-indicator"></i>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><LifeBuoy size={19}/></div>
            <b>Need assistance?</b>
            <p>Find help using IwakaSafe.</p>
            <button onClick={() => alert("Help centre content will be added.")}>
              Help centre <ArrowUpRight size={14}/>
            </button>
          </div>

          <div className="sidebar-user">
            <div className="user-avatar">
              {profileName.charAt(0).toUpperCase()}
            </div>
            <div>
              <b>{profileName}</b>
              <small>Preview account</small>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-toggle" onClick={() => setMobileOpen(true)}>
              <Menu/>
            </button>
            <div className="breadcrumb">
              Workspace <ChevronRight size={14}/> <b>{active}</b>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="search-box">
              <Search size={16}/>
              <input
                placeholder="Search iwakasafe..."
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    alert("Search will be connected to IwakaSafe data.");
                  }
                }}
              />
            </div>

            <button
              className="theme-toggle"
              title="Switch theme"
              onClick={() => setDark(value => !value)}
            >
              {dark ? <Sun size={19}/> : <Moon size={19}/>}
            </button>

            <button
              className="notification-button"
              title="Notifications"
              onClick={() => navigate("Alerts & Updates")}
            >
              <Bell size={19}/><i></i>
            </button>

            <button
              type="button"
              onClick={() => navigate("My Profile")}
              title="Open My Profile"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: "5px"
              }}
            >
              <div className="top-avatar">
                {profileName.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontWeight: 600 }}>
                {profileName}
              </span>
            </button>
          </div>
        </header>

        <div className="page-content">{pageContent[active]}</div>

        <footer className="footer">
          <span>© 2026 IwakaSafe. Safer journeys through better information.</span>
          <span>Development preview</span>
        </footer>
      </main>

      <SosPage />
    </div>
  );
}
