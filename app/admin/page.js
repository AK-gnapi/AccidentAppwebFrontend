"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { supabase } from "../lib/supabase";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4001";

function resolveApiBase() {
  if (typeof window === "undefined") return API_BASE;
  try {
    const configured = new URL(API_BASE);
    const pageHost = window.location.hostname;
    const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
    const isIpHost = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(pageHost);
    if (localHosts.has(configured.hostname) && isIpHost) {
      configured.hostname = pageHost;
      return configured.toString().replace(/\/$/, "");
    }
    return API_BASE;
  } catch {
    return API_BASE;
  }
}

const SEVERITY_COLORS = {
  critical: "#dc2626",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e"
};

export default function AdminDashboard() {
  const [users, setUsers] = useState(new Map());
  const [incidents, setIncidents] = useState(new Map());
  const [socketStatus, setSocketStatus] = useState("Disconnected");
  const [apiBase, setApiBase] = useState("");

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(new Map());
  const leafletRef = useRef(null);
  const socketRef = useRef(null);

  const totalUsers = Array.from(users.values()).length;
  const fastUsers = Array.from(users.values()).filter((u) => u.isRunningFast).length;
  const activeIncidents = Array.from(incidents.values());
  const confirmedCount = activeIncidents.filter((i) => i.status === "accident_confirmed").length;

  useEffect(() => {
    setApiBase(resolveApiBase());
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function initMap() {
      if (!mapRef.current) return;
      const { default: L } = await import("leaflet");
      if (cancelled) return;
      leafletRef.current = L;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      const map = L.map(mapRef.current).setView([20.5937, 78.9629], 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map);
      if (cancelled) { map.remove(); return; }
      mapInstanceRef.current = map;
    }
    initMap();
    return () => {
      cancelled = true;
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, []);

  function markerColor(user) {
    const incident = incidents.get(user.userId);
    if (incident?.status === "accident_confirmed") return "#dc2626";
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
    const popup = `<strong>${user.userId.slice(0, 8)}...</strong><br/>Speed: ${user.speedKmh.toFixed(1)} km/h`;
    const existing = markersRef.current.get(user.userId);
    if (existing) {
      const icon = htmlMarker(color);
      if (icon) { existing.setLatLng(latLng); existing.setIcon(icon); }
      else existing.setLatLng(latLng);
      existing.bindPopup(popup);
    } else {
      const icon = htmlMarker(color);
      const marker = L.marker(latLng, icon ? { icon } : undefined).addTo(map).bindPopup(popup);
      markersRef.current.set(user.userId, marker);
    }
  }

  function removeUser(userId) {
    setUsers((prev) => { const next = new Map(prev); next.delete(userId); return next; });
    const marker = markersRef.current.get(userId);
    if (marker) { marker.remove(); markersRef.current.delete(userId); }
  }

  function upsertIncident(incident) {
    setIncidents((prev) => {
      const next = new Map(prev);
      if (incident.status === "cleared" || incident.status === "false_alarm" || incident.status === "resolved") {
        next.delete(incident.userId);
      } else {
        next.set(incident.userId, incident);
      }
      return next;
    });
  }

  useEffect(() => {
    let socket = null;

    async function connect() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      socket = io(resolveApiBase(), {
        auth: { role: "admin", token: session.access_token },
        reconnection: true,
        reconnectionAttempts: Infinity
      });
      socketRef.current = socket;

      socket.on("connect", () => setSocketStatus("Connected"));
      socket.on("disconnect", () => setSocketStatus("Disconnected"));
      socket.on("snapshot", (snap) => {
        setUsers(() => { const m = new Map(); snap.forEach((u) => m.set(u.userId, u)); return m; });
      });
      socket.on("incident-snapshot", (snap) => {
        setIncidents(() => { const m = new Map(); snap.forEach((i) => m.set(i.userId, i)); return m; });
      });
      socket.on("user-update", (u) => upsertUser(u));
      socket.on("user-removed", ({ userId }) => removeUser(userId));
      socket.on("incident-update", (i) => upsertIncident(i));
    }

    connect();
    return () => { if (socket) socket.disconnect(); };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    Array.from(users.values()).forEach((u) => upsertUser(u));
  }, [users, incidents]);

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <h2 style={styles.pageTitle}>Dashboard</h2>
        <span style={{ ...styles.badge, background: socketStatus === "Connected" ? "#065f46" : "#7f1d1d" }}>
          {socketStatus}
        </span>
        <span style={styles.apiLabel}>API: {apiBase || "—"}</span>
      </div>

      <div style={styles.statsRow}>
        <StatCard label="Active Users" value={totalUsers} color="#38bdf8" />
        <StatCard label="Fast Users" value={fastUsers} color="#f97316" />
        <StatCard label="Active Incidents" value={activeIncidents.length} color="#ef4444" />
        <StatCard label="Confirmed" value={confirmedCount} color="#dc2626" />
      </div>

      <div style={styles.content}>
        <div ref={mapRef} style={styles.map} />
        <div style={styles.incidentPanel}>
          <h3 style={styles.panelTitle}>Active Incidents</h3>
          {activeIncidents.length === 0 && (
            <p style={styles.muted}>No active incidents</p>
          )}
          {activeIncidents
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((inc) => (
              <Link
                key={inc.incidentId}
                href={`/admin/incidents?id=${inc.incidentId}`}
                style={styles.incidentCard}
              >
                <div style={styles.incidentHeader}>
                  <span style={{ ...styles.severityDot, background: SEVERITY_COLORS[inc.severity] || "#eab308" }} />
                  <strong>{inc.userId.slice(0, 8)}...</strong>
                  <span style={styles.incidentBadge}>{inc.status.replace(/_/g, " ")}</span>
                </div>
                <div style={styles.incidentMeta}>
                  {inc.severity} severity · {inc.detectionMethod || "behavior"} detection
                </div>
                {inc.status === "pending_confirmation" && (
                  <div style={styles.countdown}>
                    Response wait: {Math.max(Math.ceil((inc.timeRemainingMs || 0) / 1000), 0)}s
                  </div>
                )}
              </Link>
            ))}
          <Link href="/admin/incidents" style={styles.viewAllLink}>
            View all incidents →
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statValue, color }}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

const styles = {
  page: {
    padding: 24,
    color: "#e2e8f0"
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
    flexWrap: "wrap"
  },
  pageTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800
  },
  badge: {
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    color: "#e2e8f0"
  },
  apiLabel: {
    fontSize: 12,
    color: "#64748b",
    marginLeft: "auto"
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 16,
    marginBottom: 24
  },
  statCard: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 12,
    padding: "16px 20px"
  },
  statValue: {
    fontSize: 28,
    fontWeight: 800,
    lineHeight: 1
  },
  statLabel: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4
  },
  content: {
    display: "grid",
    gridTemplateColumns: "1fr 340px",
    gap: 16,
    minHeight: 0
  },
  map: {
    height: "calc(100vh - 280px)",
    borderRadius: 12,
    border: "1px solid #334155",
    overflow: "hidden",
    minHeight: 400
  },
  incidentPanel: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 12,
    padding: 16,
    overflow: "auto",
    maxHeight: "calc(100vh - 280px)"
  },
  panelTitle: {
    margin: "0 0 12px",
    fontSize: 15,
    fontWeight: 700
  },
  muted: {
    color: "#64748b",
    fontSize: 13
  },
  incidentCard: {
    display: "block",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    textDecoration: "none",
    color: "#e2e8f0",
    transition: "border-color 150ms"
  },
  incidentHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13
  },
  severityDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    flexShrink: 0
  },
  incidentBadge: {
    marginLeft: "auto",
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 999,
    background: "#334155",
    textTransform: "capitalize"
  },
  incidentMeta: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 4
  },
  countdown: {
    fontSize: 12,
    color: "#f59e0b",
    marginTop: 4
  },
  viewAllLink: {
    display: "block",
    marginTop: 12,
    fontSize: 13,
    color: "#38bdf8",
    textDecoration: "none",
    textAlign: "center"
  }
};
