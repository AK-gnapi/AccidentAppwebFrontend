"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";

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
  } catch { return API_BASE; }
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [incidents, setIncidents] = useState([]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    let url = `${resolveApiBase()}/api/users?limit=100`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users || []);
    }
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    if (!selectedId) { setProfile(null); setIncidents([]); return; }
    loadUserProfile(selectedId);
    loadUserIncidents(selectedId);
  }, [selectedId]);

  async function loadUserProfile(userId) {
    setProfileLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch(`${resolveApiBase()}/api/user/${userId}/profile`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    if (res.ok) {
      setProfile(await res.json());
    }
    setProfileLoading(false);
  }

  async function loadUserIncidents(userId) {
    const { data } = await supabase
      .from("incidents")
      .select("id, status, severity, detection_method, created_at, speed_at_incident, user_response")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    setIncidents(data || []);
  }

  const prof = profile?.profile;
  const contacts = profile?.contacts || [];
  const insurance = profile?.insurance || [];

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <h2 style={styles.pageTitle}>Users</h2>
        <div style={styles.searchWrap}>
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <span style={{ ...styles.muted, marginLeft: "auto" }}>{users.length} users</span>
      </div>

      <div style={styles.content}>
        <div style={styles.list}>
          {loading && <p style={styles.muted}>Loading...</p>}
          {!loading && users.length === 0 && <p style={styles.muted}>No users found</p>}
          {users.map((u) => (
            <div
              key={u.id}
              onClick={() => setSelectedId(u.id)}
              style={{
                ...styles.userRow,
                borderColor: selectedId === u.id ? "#38bdf8" : "#334155"
              }}
            >
              <div style={styles.userAvatar}>{(u.fullName || "?")[0].toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{u.fullName || "—"}</div>
                <div style={styles.muted}>{u.phone} · {u.vehicleType?.replace(/_/g, " ")} · {u.bloodGroup}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={styles.detailPanel}>
          {!selectedId && <p style={styles.muted}>Select a user to view details</p>}
          {profileLoading && <p style={styles.muted}>Loading...</p>}
          {prof && !profileLoading && (
            <>
              <div style={styles.profileHeader}>
                <div style={styles.bigAvatar}>{(prof.fullName || "?")[0].toUpperCase()}</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18 }}>{prof.fullName}</h3>
                  <div style={styles.muted}>{prof.phone} · {prof.gender} · {prof.bloodGroup}</div>
                </div>
              </div>

              <div style={styles.section}>
                <div style={styles.sectionTitle}>Personal</div>
                <InfoRow label="Vehicle" value={prof.vehicleType?.replace(/_/g, " ")} />
                <InfoRow label="DOB" value={prof.dateOfBirth} />
                <InfoRow label="Aadhaar" value={prof.aadhaarLastFour ? `XXXX-XXXX-${prof.aadhaarLastFour}` : null} />
                <InfoRow label="Joined" value={new Date(prof.createdAt).toLocaleDateString()} />
              </div>

              <div style={styles.section}>
                <div style={styles.sectionTitle}>Medical</div>
                <InfoRow label="Conditions" value={prof.medicalConditions?.length ? prof.medicalConditions.join(", ") : "None"} />
                <InfoRow label="Allergies" value={prof.allergies?.length ? prof.allergies.join(", ") : "None"} highlight={prof.allergies?.length > 0} />
                <InfoRow label="Medications" value={prof.currentMedications?.length ? prof.currentMedications.join(", ") : "None"} />
              </div>

              {contacts.length > 0 && (
                <div style={styles.section}>
                  <div style={styles.sectionTitle}>Emergency Contacts</div>
                  {contacts.map((c) => (
                    <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "4px 0", fontSize: 13 }}>
                      <span>{c.name}</span>
                      <span style={styles.muted}>{c.relationship}</span>
                      <a href={`tel:${c.phone}`} style={{ color: "#38bdf8", marginLeft: "auto", textDecoration: "none" }}>{c.phone}</a>
                    </div>
                  ))}
                </div>
              )}

              {insurance.length > 0 && (
                <div style={styles.section}>
                  <div style={styles.sectionTitle}>Insurance</div>
                  {insurance.map((ins) => (
                    <div key={ins.id} style={{ fontSize: 13, padding: "2px 0" }}>
                      <strong>{ins.type?.toUpperCase()}</strong>: {ins.provider} — {ins.policyNumber}
                      {ins.expiryDate && <span style={styles.muted}> (exp: {ins.expiryDate})</span>}
                    </div>
                  ))}
                </div>
              )}

              <div style={styles.section}>
                <div style={styles.sectionTitle}>Incident History ({incidents.length})</div>
                {incidents.length === 0 && <p style={styles.muted}>No incidents</p>}
                {incidents.map((inc) => (
                  <div key={inc.id} style={styles.incidentHistoryRow}>
                    <span style={{
                      ...styles.dot,
                      background: inc.severity === "critical" ? "#dc2626" : inc.severity === "high" ? "#f97316" : inc.severity === "low" ? "#22c55e" : "#eab308"
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13 }}>
                        {inc.severity} · {inc.status.replace(/_/g, " ")} · {inc.detection_method}
                      </div>
                      <div style={styles.muted}>
                        {new Date(inc.created_at).toLocaleString()} · {inc.speed_at_incident?.toFixed(1)} km/h
                        {inc.user_response && ` · Response: ${inc.user_response}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 13, padding: "2px 0" }}>
      <span style={{ color: "#64748b", minWidth: 90 }}>{label}</span>
      <span style={highlight ? { color: "#f87171", fontWeight: 700 } : {}}>{value}</span>
    </div>
  );
}

const styles = {
  page: { padding: 24, color: "#e2e8f0" },
  topBar: { display: "flex", alignItems: "center", gap: 16, marginBottom: 20, flexWrap: "wrap" },
  pageTitle: { margin: 0, fontSize: 22, fontWeight: 800 },
  searchWrap: { flex: "1 1 200px", maxWidth: 360 },
  searchInput: {
    width: "100%", padding: "8px 12px", borderRadius: 8,
    border: "1px solid #475569", background: "#0f172a",
    color: "#e2e8f0", fontSize: 14, outline: "none"
  },
  muted: { color: "#64748b", fontSize: 12, margin: 0 },
  content: { display: "grid", gridTemplateColumns: "340px 1fr", gap: 16 },
  list: { maxHeight: "calc(100vh - 160px)", overflow: "auto" },
  userRow: {
    display: "flex", alignItems: "center", gap: 12,
    padding: 12, marginBottom: 6, borderRadius: 8,
    background: "#1e293b", border: "1px solid #334155",
    cursor: "pointer", transition: "border-color 150ms"
  },
  userAvatar: {
    width: 40, height: 40, borderRadius: "50%",
    background: "linear-gradient(135deg, #38bdf8, #6366f1)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 800, fontSize: 16, color: "#0f172a", flexShrink: 0
  },
  detailPanel: {
    background: "#1e293b", border: "1px solid #334155",
    borderRadius: 12, padding: 20, overflow: "auto",
    maxHeight: "calc(100vh - 160px)"
  },
  profileHeader: { display: "flex", alignItems: "center", gap: 16, marginBottom: 20 },
  bigAvatar: {
    width: 56, height: 56, borderRadius: "50%",
    background: "linear-gradient(135deg, #38bdf8, #6366f1)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 800, fontSize: 24, color: "#0f172a", flexShrink: 0
  },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 12, fontWeight: 700, color: "#94a3b8",
    marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5
  },
  dot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  incidentHistoryRow: {
    display: "flex", alignItems: "flex-start", gap: 8,
    padding: "8px 0", borderBottom: "1px solid #1e293b"
  }
};
