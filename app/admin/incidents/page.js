"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";
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
  } catch { return API_BASE; }
}

const SEVERITY_COLORS = { critical: "#dc2626", high: "#f97316", medium: "#eab308", low: "#22c55e" };
const STATUS_LABELS = {
  pending_confirmation: "Pending",
  accident_confirmed: "Confirmed",
  action_taken: "Action Taken",
  resolved: "Resolved",
  false_alarm: "False Alarm"
};

const EMERGENCY_NUMBERS = [
  { label: "112 Unified Emergency", number: "112" },
  { label: "108 Ambulance", number: "108" },
  { label: "102 Govt Ambulance", number: "102" },
  { label: "100 Police", number: "100" },
  { label: "1033 NHAI Highway", number: "1033" },
  { label: "101 Fire", number: "101" },
];

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    let url = `${resolveApiBase()}/api/incidents?limit=100`;
    if (filterStatus) url += `&status=${filterStatus}`;
    if (filterSeverity) url += `&severity=${filterSeverity}`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
    if (res.ok) {
      const data = await res.json();
      setIncidents(data.incidents || []);
    }
    setLoading(false);
  }, [filterStatus, filterSeverity]);

  useEffect(() => { fetchIncidents(); }, [fetchIncidents]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) setSelectedId(id);
  }, []);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    loadDetail(selectedId);
  }, [selectedId]);

  async function loadDetail(id) {
    setDetailLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch(`${resolveApiBase()}/api/incidents/${id}`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    if (res.ok) {
      setDetail(await res.json());
    }
    setDetailLoading(false);
  }

  async function doAction(actionType, details = null) {
    if (!selectedId) return;
    setActionLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await fetch(`${resolveApiBase()}/api/incidents/${selectedId}/action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ action_type: actionType, details })
    });

    await loadDetail(selectedId);
    await fetchIncidents();
    setActionLoading(false);
  }

  const profile = detail?.incident?.profile;
  const contacts = detail?.contacts || [];
  const insurance = detail?.insurance || [];
  const actions = detail?.actions || detail?.incident?.actions || [];
  const inc = detail?.incident;

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <h2 style={styles.pageTitle}>Incidents</h2>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={styles.select}>
          <option value="">All Status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} style={styles.select}>
          <option value="">All Severity</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button onClick={fetchIncidents} style={styles.refreshBtn}>Refresh</button>
      </div>

      <div style={styles.content}>
        <div style={styles.list}>
          {loading && <p style={styles.muted}>Loading...</p>}
          {!loading && incidents.length === 0 && <p style={styles.muted}>No incidents found</p>}
          {incidents.map((inc) => (
            <div
              key={inc.id}
              onClick={() => setSelectedId(inc.id)}
              style={{
                ...styles.incidentRow,
                borderColor: selectedId === inc.id ? "#38bdf8" : "#334155"
              }}
            >
              <div style={styles.rowHeader}>
                <span style={{ ...styles.dot, background: SEVERITY_COLORS[inc.severity] || "#eab308" }} />
                <strong style={{ fontSize: 13 }}>{inc.profile?.fullName || inc.userId?.slice(0, 8)}</strong>
                <span style={styles.statusBadge}>{STATUS_LABELS[inc.status] || inc.status}</span>
              </div>
              <div style={styles.rowMeta}>
                {inc.severity} · {inc.detectionMethod} · {new Date(inc.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        <div style={styles.detailPanel}>
          {!selectedId && <p style={styles.muted}>Select an incident to view details</p>}
          {detailLoading && <p style={styles.muted}>Loading...</p>}
          {inc && !detailLoading && (
            <>
              <div style={styles.detailHeader}>
                <span style={{ ...styles.dot, background: SEVERITY_COLORS[inc.severity] || "#eab308" }} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{STATUS_LABELS[inc.status] || inc.status}</h3>
                <span style={styles.severityBadge}>{inc.severity}</span>
              </div>

              <div style={styles.section}>
                <div style={styles.sectionTitle}>Location</div>
                <div style={styles.muted}>
                  {inc.locationLat?.toFixed(5)}, {inc.locationLng?.toFixed(5)} · {inc.speedAtIncident?.toFixed(1)} km/h
                </div>
                <div style={styles.muted}>{new Date(inc.createdAt).toLocaleString()}</div>
                <div style={styles.muted}>Detection: {inc.detectionMethod}</div>
              </div>

              {profile && (
                <div style={styles.section}>
                  <div style={styles.sectionTitle}>Patient Info</div>
                  <div style={styles.infoGrid}>
                    <InfoRow label="Name" value={profile.fullName} />
                    <InfoRow label="Phone" value={profile.phone} href={`tel:${profile.phone}`} />
                    <InfoRow label="Blood Group" value={profile.bloodGroup} highlight />
                    <InfoRow label="Vehicle" value={profile.vehicleType?.replace(/_/g, " ")} />
                    <InfoRow label="Gender" value={profile.gender} />
                    {profile.medicalConditions?.length > 0 && (
                      <InfoRow label="Conditions" value={profile.medicalConditions.join(", ")} />
                    )}
                    {profile.allergies?.length > 0 && (
                      <InfoRow label="Allergies" value={profile.allergies.join(", ")} highlight />
                    )}
                    {profile.currentMedications?.length > 0 && (
                      <InfoRow label="Medications" value={profile.currentMedications.join(", ")} />
                    )}
                  </div>
                </div>
              )}

              {contacts.length > 0 && (
                <div style={styles.section}>
                  <div style={styles.sectionTitle}>Emergency Contacts</div>
                  {contacts.map((c) => (
                    <div key={c.id} style={styles.contactRow}>
                      <div>
                        <strong>{c.name}</strong>
                        <span style={styles.muted}> · {c.relationship}</span>
                      </div>
                      <a href={`tel:${c.phone}`} style={styles.callLink}>{c.phone}</a>
                      <button
                        onClick={() => doAction("contacted_family", `Called ${c.name} (${c.phone})`)}
                        disabled={actionLoading}
                        style={styles.miniBtn}
                      >
                        Mark Called
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {insurance.length > 0 && (
                <div style={styles.section}>
                  <div style={styles.sectionTitle}>Insurance</div>
                  {insurance.map((ins) => (
                    <div key={ins.id} style={styles.muted}>
                      {ins.type?.toUpperCase()}: {ins.provider} — {ins.policyNumber}
                    </div>
                  ))}
                </div>
              )}

              {inc.nearbyHospitals?.length > 0 && (
                <div style={styles.section}>
                  <div style={styles.sectionTitle}>Nearby Hospitals</div>
                  {inc.nearbyHospitals.map((h, i) => (
                    <div key={i} style={styles.contactRow}>
                      <div>{h.name} ({h.distanceKm} km)</div>
                      <a href={`tel:${h.phone}`} style={styles.callLink}>{h.phone}</a>
                      <button
                        onClick={() => doAction("contacted_hospital", `Called ${h.name} (${h.phone})`)}
                        disabled={actionLoading}
                        style={styles.miniBtn}
                      >
                        Mark Called
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={styles.section}>
                <div style={styles.sectionTitle}>Emergency Services (India)</div>
                <div style={styles.emergencyGrid}>
                  {EMERGENCY_NUMBERS.map((svc) => (
                    <a key={svc.number} href={`tel:${svc.number}`} style={styles.emergencyBtn}>
                      <strong>{svc.number}</strong>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{svc.label.split(" ").slice(1).join(" ")}</span>
                    </a>
                  ))}
                </div>
              </div>

              <div style={styles.section}>
                <div style={styles.sectionTitle}>Actions</div>
                <div style={styles.actionRow}>
                  {inc.status !== "false_alarm" && inc.status !== "resolved" && (
                    <>
                      <button onClick={() => doAction("dispatched_ambulance", "Ambulance dispatched")} disabled={actionLoading} style={{ ...styles.actionBtn, background: "#dc2626" }}>
                        Dispatch Ambulance
                      </button>
                      <button onClick={() => doAction("marked_false_alarm")} disabled={actionLoading} style={{ ...styles.actionBtn, background: "#475569" }}>
                        False Alarm
                      </button>
                      <button onClick={() => doAction("resolved", "Resolved by admin")} disabled={actionLoading} style={{ ...styles.actionBtn, background: "#059669" }}>
                        Resolve
                      </button>
                    </>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <input
                    type="text"
                    placeholder="Add a note..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    style={styles.noteInput}
                  />
                  <button
                    onClick={() => { if (noteText.trim()) { doAction("added_note", noteText.trim()); setNoteText(""); } }}
                    disabled={actionLoading || !noteText.trim()}
                    style={styles.miniBtn}
                  >
                    Add
                  </button>
                </div>
              </div>

              {actions.length > 0 && (
                <div style={styles.section}>
                  <div style={styles.sectionTitle}>Timeline</div>
                  {actions.map((a) => (
                    <div key={a.id} style={styles.timelineItem}>
                      <div style={styles.muted}>{new Date(a.createdAt).toLocaleString()}</div>
                      <div style={{ fontSize: 13 }}>
                        <strong>{a.actionType.replace(/_/g, " ")}</strong>
                        {a.details && <span style={styles.muted}> — {a.details}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>
                        by {a.admin?.fullName || "Admin"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, href, highlight }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 13, padding: "2px 0" }}>
      <span style={{ color: "#64748b", minWidth: 90 }}>{label}</span>
      {href ? (
        <a href={href} style={{ color: "#38bdf8" }}>{value}</a>
      ) : (
        <span style={highlight ? { color: "#f87171", fontWeight: 700 } : {}}>{value}</span>
      )}
    </div>
  );
}

const styles = {
  page: { padding: 24, color: "#e2e8f0" },
  topBar: { display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" },
  pageTitle: { margin: 0, fontSize: 22, fontWeight: 800 },
  select: {
    padding: "6px 10px", borderRadius: 6, border: "1px solid #475569",
    background: "#1e293b", color: "#e2e8f0", fontSize: 13
  },
  refreshBtn: {
    padding: "6px 14px", borderRadius: 6, border: "none",
    background: "#334155", color: "#e2e8f0", fontSize: 13, cursor: "pointer"
  },
  content: { display: "grid", gridTemplateColumns: "380px 1fr", gap: 16, minHeight: 0 },
  list: { maxHeight: "calc(100vh - 160px)", overflow: "auto" },
  muted: { color: "#64748b", fontSize: 12, margin: 0 },
  incidentRow: {
    padding: 12, marginBottom: 6, borderRadius: 8,
    background: "#1e293b", border: "1px solid #334155",
    cursor: "pointer", transition: "border-color 150ms"
  },
  rowHeader: { display: "flex", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  statusBadge: {
    marginLeft: "auto", fontSize: 11, padding: "2px 8px",
    borderRadius: 999, background: "#334155"
  },
  rowMeta: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
  detailPanel: {
    background: "#1e293b", border: "1px solid #334155",
    borderRadius: 12, padding: 20, overflow: "auto",
    maxHeight: "calc(100vh - 160px)"
  },
  detailHeader: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 },
  severityBadge: {
    marginLeft: "auto", fontSize: 12, padding: "3px 10px",
    borderRadius: 999, background: "#334155", textTransform: "capitalize"
  },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  infoGrid: { display: "flex", flexDirection: "column", gap: 2 },
  contactRow: { display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 13, flexWrap: "wrap" },
  callLink: { color: "#38bdf8", textDecoration: "none" },
  miniBtn: {
    padding: "4px 10px", borderRadius: 4, border: "none",
    background: "#334155", color: "#e2e8f0", fontSize: 11, cursor: "pointer"
  },
  emergencyGrid: {
    display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8
  },
  emergencyBtn: {
    display: "flex", flexDirection: "column", alignItems: "center",
    padding: "10px 8px", borderRadius: 8, background: "#0f172a",
    border: "1px solid #334155", textDecoration: "none", color: "#e2e8f0", fontSize: 16
  },
  actionRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  actionBtn: {
    padding: "8px 14px", borderRadius: 6, border: "none",
    color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer"
  },
  noteInput: {
    flex: 1, padding: "6px 10px", borderRadius: 6,
    border: "1px solid #475569", background: "#0f172a",
    color: "#e2e8f0", fontSize: 13
  },
  timelineItem: {
    padding: "8px 0", borderBottom: "1px solid #334155"
  }
};
