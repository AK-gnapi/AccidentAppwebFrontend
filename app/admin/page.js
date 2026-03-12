"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  clearSessionRole,
  getSessionRole,
  setSessionRole
} from "../lib/sessionRole";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4001";

// Frontend-visible copy of important backend envs, sourced from next-app/.env
const FRONTEND_CONFIG = {
  accidentHighSpeedKmh: Number(
    process.env.NEXT_PUBLIC_ACCIDENT_HIGH_SPEED_KMH || 20
  ),
  accidentStopSpeedKmh: Number(
    process.env.NEXT_PUBLIC_ACCIDENT_STOP_SPEED_KMH || 1
  ),
  accidentDropWindowMs: Number(
    process.env.NEXT_PUBLIC_ACCIDENT_DROP_WINDOW_MS || 5000
  ),
  accidentConfirmTimeoutMs: Number(
    process.env.NEXT_PUBLIC_ACCIDENT_CONFIRM_TIMEOUT_MS || 45000
  ),
  hospitalSearchRadiusM: Number(
    process.env.NEXT_PUBLIC_HOSPITAL_SEARCH_RADIUS_M || 5000
  ),
  fastSpeedThresholdKmh: Number(
    process.env.NEXT_PUBLIC_FAST_SPEED_THRESHOLD_KMH || 5
  )
};

function resolveApiBase() {
  if (typeof window === "undefined") {
    return API_BASE;
  }

  try {
    const configured = new URL(API_BASE);
    const pageHost = window.location.hostname;
    const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
    const isIpHost = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(pageHost);

    // Rewrite only for LAN/mobile access by IP, not for public hostnames (e.g. ngrok).
    if (localHosts.has(configured.hostname) && isIpHost) {
      configured.hostname = pageHost;
      return configured.toString().replace(/\/$/, "");
    }

    return API_BASE;
  } catch {
    return API_BASE;
  }
}

export default function AdminPage() {
  const [adminToken, setAdminToken] = useState("");
  const [socketStatus, setSocketStatus] = useState("Socket: disconnected");
  const [socketColor, setSocketColor] = useState("#7f1d1d");
  const [statusText, setStatusText] = useState("Connecting...");
  const [users, setUsers] = useState(new Map());
  const [incidents, setIncidents] = useState(new Map());

  const totalUsers = Array.from(users.values()).length;
  const fastUsers = Array.from(users.values()).filter(
    (u) => u.isRunningFast
  ).length;

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(new Map());
  const socketRef = useRef(null);
  const leafletRef = useRef(null);
  const [isLockedByRole, setIsLockedByRole] = useState(false);
  const [apiBaseDisplay, setApiBaseDisplay] = useState("");

  useEffect(() => {
    const session = getSessionRole();
    if (session.role === "user") {
      setIsLockedByRole(true);
      setStatusText(
        "User tracking is active in this browser. Stop tracking or clear session to open admin here."
      );
    }
    setApiBaseDisplay(resolveApiBase());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!mapRef.current) return;
      const { default: L } = await import("leaflet");
      if (cancelled) return;
      leafletRef.current = L;

      // Avoid "Map container is already initialized" (e.g. React Strict Mode remount)
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const mapCenter = [20.5937, 78.9629];
      const map = L.map(mapRef.current).setView(mapCenter, 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map);
      if (cancelled) {
        map.remove();
        return;
      }
      mapInstanceRef.current = map;
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  function markerColor(user) {
    const incident = incidents.get(user.userId);
    if (incident?.status === "accident_confirmed") return "#b91c1c";
    if (incident?.status === "pending_confirmation") return "#f59e0b";
    if (user.isStale) return "#64748b";
    if (user.isRunningFast) return "#ef4444";
    return "#22c55e";
  }

  function htmlMarker(color) {
    const L = leafletRef.current;
    if (!L) return null;
    return L.divIcon({
      className: "",
      html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.4);"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
  }

  function upsertUser(user) {
    setUsers((prev) => {
      const next = new Map(prev);
      next.set(user.userId, user);
      return next;
    });
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;
    const latLng = [user.lat, user.lng];
    const color = markerColor(user);
    const popup = `
      <strong>${user.userId}</strong><br/>
      Speed: ${user.speedKmh.toFixed(2)} km/h<br/>
      Updated: ${new Date(user.timestamp).toLocaleTimeString()}<br/>
      State: ${user.isStale ? "stale" : user.isRunningFast ? "fast" : "normal"}
    `;
    const existing = markersRef.current.get(user.userId);
    if (existing) {
      const icon = htmlMarker(color);
      if (icon) {
        existing.setLatLng(latLng);
        existing.setIcon(icon);
      } else {
        existing.setLatLng(latLng);
      }
      existing.bindPopup(popup);
    } else {
      const icon = htmlMarker(color);
      const marker = L.marker(latLng, icon ? { icon } : undefined).addTo(map).bindPopup(popup);
      markersRef.current.set(user.userId, marker);
    }
  }

  function removeUser(userId) {
    setUsers((prev) => {
      const next = new Map(prev);
      next.delete(userId);
      return next;
    });
    const marker = markersRef.current.get(userId);
    if (marker) {
      marker.remove();
      markersRef.current.delete(userId);
    }
  }

  function upsertIncident(incident) {
    setIncidents((prev) => {
      const next = new Map(prev);
      if (incident.status === "cleared") {
        next.delete(incident.userId);
      } else {
        next.set(incident.userId, incident);
      }
      return next;
    });
  }

  async function loadAdminToken() {
    if (isLockedByRole) return;
    const res = await fetch(`${resolveApiBase()}/api/config?role=admin`);
    if (!res.ok) throw new Error("Failed to load admin token");
    const data = await res.json();
    setAdminToken(data.token);
  }

  async function loadActiveIncidents(token) {
    const res = await fetch(`${resolveApiBase()}/api/incidents/active`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    setIncidents(() => {
      const map = new Map();
      (data.incidents || []).forEach((i) => {
        map.set(i.userId, i);
      });
      return map;
    });
  }

  useEffect(() => {
    if (isLockedByRole) return;
    loadAdminToken()
      .then(() => {
        setSessionRole("admin");
      })
      .catch((e) => {
        setStatusText(e.message);
      });
  }, [isLockedByRole]);

  useEffect(() => {
    if (!adminToken || isLockedByRole) return;

    loadActiveIncidents(adminToken).catch(() => {});

    const socket = io(resolveApiBase(), {
      auth: {
        role: "admin",
        token: adminToken
      },
      reconnection: true,
      reconnectionAttempts: Infinity
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketStatus("Socket: connected");
      setSocketColor("#14532d");
      setStatusText("Live updates active");
    });

    socket.on("disconnect", (reason) => {
      setSocketStatus("Socket: disconnected");
      setSocketColor("#7f1d1d");
      setStatusText(`Disconnected (${reason}), reconnecting...`);
    });

    socket.on("snapshot", (snapshot) => {
      setUsers(() => {
        const map = new Map();
        snapshot.forEach((u) => map.set(u.userId, u));
        return map;
      });
      // markers updated lazily on render pass
    });

    socket.on("incident-snapshot", (snapshot) => {
      setIncidents(() => {
        const map = new Map();
        snapshot.forEach((i) => map.set(i.userId, i));
        return map;
      });
    });

    socket.on("user-update", (user) => {
      upsertUser(user);
    });

    socket.on("user-removed", ({ userId }) => {
      removeUser(userId);
    });

    socket.on("incident-update", (incident) => {
      upsertIncident(incident);
    });

    return () => {
      socket.disconnect();
    };
  }, [adminToken]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    Array.from(users.values()).forEach((u) => upsertUser(u));
  }, [users, incidents]);

  const userCards = Array.from(users.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .map((u) => {
      const incident = incidents.get(u.userId);
      const cls = u.isStale
        ? "user-item stale"
        : u.isRunningFast
        ? "user-item fast"
        : "user-item";
      return (
        <div key={u.userId} className={cls}>
          <div>
            <strong>{u.userId}</strong>
          </div>
          <div>speed: {u.speedKmh.toFixed(2)} km/h</div>
          <div>updated: {new Date(u.timestamp).toLocaleTimeString()}</div>
          <div>
            state: {u.isStale ? "stale" : u.isRunningFast ? "fast (>5)" : "normal"}
          </div>
          {incident && (
            <div>incident: {incident.status.replaceAll("_", " ")}</div>
          )}
        </div>
      );
    });

  const incidentCards = Array.from(incidents.values())
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((incident) => {
      const isConfirmed = incident.status === "accident_confirmed";
      const remaining = Math.max(
        Math.ceil((incident.timeRemainingMs || 0) / 1000),
        0
      );
      const hospitals = (incident.hospitals || []).map((h) => (
        <li key={`${incident.incidentId}-${h.name}-${h.phone}`}>
          {h.name} ({h.distanceKm} km) -{" "}
          <a href={`tel:${h.phone}`}>{h.phone}</a>
        </li>
      ));
      return (
        <div
          key={incident.incidentId}
          className={`user-item ${isConfirmed ? "fast" : ""}`}
        >
          <div>
            <strong>{incident.userId}</strong>
          </div>
          <div>status: {incident.status.replaceAll("_", " ")}</div>
          {incident.status === "pending_confirmation" && (
            <div>user response wait: {remaining}s</div>
          )}
          {isConfirmed && (
            <div style={{ marginTop: 6 }}>
              <strong>Nearby hospitals:</strong>
              <ul style={{ paddingLeft: 16 }}>
                {hospitals.length ? hospitals : <li>No hospitals found</li>}
              </ul>
            </div>
          )}
        </div>
      );
    });

  return (
    <div className="container">
      <div className="topbar">
        <strong>Admin Interface (Next.js)</strong>
        <span className="badge" style={{ background: socketColor }}>
          {socketStatus}
        </span>
        <span className="badge">Users: {totalUsers}</span>
        <span className="badge">Fast: {fastUsers}</span>
        <span className="status">{statusText}</span>
        <span className="status" style={{ fontSize: "0.85rem", color: "#64748b" }}>
          API: {apiBaseDisplay || "—"}
        </span>
        <button
          className="btn secondary"
          style={{ marginLeft: "auto" }}
          onClick={() => {
            clearSessionRole();
            window.location.href = "/";
          }}
        >
          Clear session
        </button>
      </div>
      <div className="grid">
        <aside className="panel">
          <h3 style={{ marginTop: 0 }}>Live Users</h3>
          <div className="status" style={{ fontSize: "0.8rem", marginBottom: 8 }}>
            Config (from next-app .env): fast &gt;{" "}
            {FRONTEND_CONFIG.fastSpeedThresholdKmh} km/h, accident high &gt;{" "}
            {FRONTEND_CONFIG.accidentHighSpeedKmh} km/h, confirm timeout{" "}
            {Math.round(FRONTEND_CONFIG.accidentConfirmTimeoutMs / 1000)}s
          </div>
          <div id="usersList">
            {userCards.length ? (
              userCards
            ) : (
              <div className="status">No active users</div>
            )}
          </div>
          <h3>Incident Alerts</h3>
          <div id="incidentsList">
            {incidentCards.length ? (
              incidentCards
            ) : (
              <div className="status">No active incidents</div>
            )}
          </div>
        </aside>
        <main ref={mapRef} className="map" />
      </div>
    </div>
  );
}

