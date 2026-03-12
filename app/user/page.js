"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { clearSessionRole, getSessionRole, setSessionRole } from "../lib/sessionRole";

const ENV_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4001";

function resolveApiBase() {
  if (typeof window === "undefined") {
    return ENV_API_BASE;
  }

  try {
    const configured = new URL(ENV_API_BASE);
    const pageHost = window.location.hostname;
    const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
    const isIpHost = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(pageHost);

    // Rewrite only for LAN/mobile access by IP, not for public hostnames (e.g. ngrok).
    if (localHosts.has(configured.hostname) && isIpHost) {
      configured.hostname = pageHost;
      return configured.toString().replace(/\/$/, "");
    }

    return ENV_API_BASE;
  } catch {
    return ENV_API_BASE;
  }
}

export default function UserPage() {
  const [userId, setUserId] = useState(
    () => `user-${Math.floor(Math.random() * 9000 + 1000)}`
  );
  const [userToken, setUserToken] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState(
    "Ready. Enter user id and click Start Tracking."
  );
  const [detail, setDetail] = useState("No tracking started.");
  const [connLabel, setConnLabel] = useState("Disconnected");
  const [connColor, setConnColor] = useState("#334155");
  const [isLockedByRole, setIsLockedByRole] = useState(false);
  const [apiBaseDisplay, setApiBaseDisplay] = useState("");

  const watchIdRef = useRef(null);
  const lastPositionRef = useRef(null);
  const nextSendAtRef = useRef(0);
  const socketRef = useRef(null);
  const isRunningRef = useRef(false);
  const userIdRef = useRef(userId);
  const userTokenRef = useRef(userToken);

  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [safetyCountdown, setSafetyCountdown] = useState(45);
  const [safetyStatus, setSafetyStatus] = useState("");
  const [sliderValue, setSliderValue] = useState(0);
  const activeIncidentIdRef = useRef(null);
  const safetyDeadlineRef = useRef(0);
  const safetyTimerRef = useRef(null);

  useEffect(() => {
    const session = getSessionRole();
    if (session.role === "admin") {
      setIsLockedByRole(true);
      setStatus(
        "Admin dashboard is active in this browser. Close admin or clear session to use user mode here."
      );
    } else if (session.role === "user" && session.userId) {
      setUserId(session.userId);
      setStatus(`Existing user session detected (${session.userId}).`);
    }
    setApiBaseDisplay(resolveApiBase());
  }, []);

  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { userTokenRef.current = userToken; }, [userToken]);

  useEffect(() => {
    async function fetchToken() {
      try {
        const res = await fetch(`${resolveApiBase()}/api/config?role=user`);
        if (!res.ok) throw new Error("Failed to load user token");
        const data = await res.json();
        setUserToken(data.token);
      } catch (e) {
        setStatus(e.message);
      }
    }
    fetchToken();
  }, []);

  function computeSpeedKmh(prev, current) {
    if (!prev) return 0;
    const toRad = (v) => (v * Math.PI) / 180;
    const dLat = toRad(current.lat - prev.lat);
    const dLng = toRad(current.lng - prev.lng);
    const rLat1 = toRad(prev.lat);
    const rLat2 = toRad(current.lat);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) ** 2;
    const distM = 2 * 6371000 * Math.asin(Math.sqrt(a));
    const dtMs = current.timestamp - prev.timestamp;
    if (dtMs <= 0) return 0;
    return (distM / (dtMs / 1000)) * 3.6;
  }

  function getAdaptiveIntervalMs(speedKmh) {
    if (speedKmh > 5) return 1000;
    return 5000;
  }

  async function sendLocation(position) {
    if (!isRunningRef.current) return;

    const trimmedUserId = userIdRef.current.trim();
    if (!trimmedUserId) {
      setStatus("User ID is required");
      return;
    }

    const token = userTokenRef.current;
    if (!token) return;

    const now = Date.now();
    const currentPoint = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      timestamp: now
    };
    const speedKmh = computeSpeedKmh(lastPositionRef.current, currentPoint);
    const intervalMs = getAdaptiveIntervalMs(speedKmh);
    if (now < nextSendAtRef.current) return;
    nextSendAtRef.current = now + intervalMs;
    lastPositionRef.current = currentPoint;

    try {
      const res = await fetch(`${resolveApiBase()}/api/location`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: trimmedUserId,
          lat: currentPoint.lat,
          lng: currentPoint.lng,
          timestamp: currentPoint.timestamp,
          accuracy: position.coords.accuracy
        })
      });
      if (!res.ok) {
        throw new Error(`Upload failed with status ${res.status}`);
      }
      setConnLabel("Connected");
      setConnColor("#14532d");
      setDetail(
        `Last update: ${new Date(
          now
        ).toLocaleTimeString()} | speed~ ${speedKmh.toFixed(
          2
        )} km/h | interval ${intervalMs / 1000}s`
      );
    } catch (e) {
      setConnLabel("Error");
      setConnColor("#7f1d1d");
      setStatus(e.message);
    }
  }

  async function notifyStop(trimmedUserId, keepalive = false) {
    if (!trimmedUserId) return;
    await fetch(`${resolveApiBase()}/api/location/stop`, {
      method: "POST",
      keepalive,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`
      },
      body: JSON.stringify({ userId: trimmedUserId })
    });
  }

  function clearSafetyTimer() {
    if (safetyTimerRef.current) {
      clearInterval(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }

  function openSafetyModal(timeoutSeconds) {
    clearSafetyTimer();
    setIsSafetyModalOpen(true);
    setSliderValue(0);
    setSafetyStatus("");
    safetyDeadlineRef.current = Date.now() + timeoutSeconds * 1000;
    setSafetyCountdown(timeoutSeconds);

    safetyTimerRef.current = setInterval(() => {
      const remainingMs = Math.max(
        safetyDeadlineRef.current - Date.now(),
        0
      );
      const seconds = Math.ceil(remainingMs / 1000);
      setSafetyCountdown(seconds);
      if (remainingMs <= 0) {
        clearSafetyTimer();
        setSafetyStatus("No response sent. Admin has been alerted.");
      }
    }, 250);
  }

  function hideSafetyModal() {
    clearSafetyTimer();
    setIsSafetyModalOpen(false);
    setSliderValue(0);
    setSafetyStatus("");
    activeIncidentIdRef.current = null;
  }

  async function sendIncidentResponse(response) {
    const trimmedUserId = userId.trim();
    if (!trimmedUserId || !activeIncidentIdRef.current) return;
    const res = await fetch(`${resolveApiBase()}/api/incident/response`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`
      },
      body: JSON.stringify({
        userId: trimmedUserId,
        incidentId: activeIncidentIdRef.current,
        response
      })
    });
    if (!res.ok) {
      throw new Error(`Incident response failed with status ${res.status}`);
    }
  }

  function connectSocket() {
    const trimmedUserId = userId.trim();
    if (!trimmedUserId || !userToken || isLockedByRole) return;

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket = io(resolveApiBase(), {
      auth: {
        role: "user",
        token: userToken,
        userId: trimmedUserId
      }
    });
    socketRef.current = socket;

    socket.on("safety-check", ({ incidentId, timeoutSeconds }) => {
      activeIncidentIdRef.current = incidentId;
      openSafetyModal(timeoutSeconds || 45);
    });
  }

  function startTracking() {
    if (isRunning || isLockedByRole) return;
    const session = getSessionRole();
    const trimmedUserId = userId.trim();
    if (session.role === "admin") {
      setIsLockedByRole(true);
      setStatus("Admin session is active in this browser.");
      return;
    }
    if (session.role === "user" && session.userId && session.userId !== trimmedUserId) {
      setIsLockedByRole(true);
      setStatus(
        `User session (${session.userId}) is active. Stop it first to start ${trimmedUserId}.`
      );
      return;
    }

    setIsRunning(true);
    setConnLabel("Starting");
    setConnColor("#334155");
    setStatus("Requesting location permission...");
    setSessionRole("user", trimmedUserId);
    connectSocket();

    const geoOptions = {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 30000
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setStatus("Tracking active");
        sendLocation(position);
      },
      (error) => {
        if (error.code === error.TIMEOUT) {
          setStatus("GPS timed out, retrying with lower accuracy...");
          navigator.geolocation.clearWatch(watchIdRef.current);
          const fallbackId = navigator.geolocation.watchPosition(
            (position) => {
              setStatus("Tracking active (low accuracy)");
              sendLocation(position);
            },
            (err2) => {
              setStatus(`GPS error: ${err2.message}`);
              setConnLabel("GPS failed");
              setConnColor("#7f1d1d");
            },
            { enableHighAccuracy: false, maximumAge: 5000, timeout: 60000 }
          );
          watchIdRef.current = fallbackId;
        } else {
          setStatus(`GPS error: ${error.message}`);
          setConnLabel("Permission denied");
          setConnColor("#7f1d1d");
        }
      },
      geoOptions
    );
    watchIdRef.current = watchId;
  }

  async function stopTracking() {
    const trimmedUserId = userId.trim();
    setIsRunning(false);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    lastPositionRef.current = null;
    nextSendAtRef.current = 0;
    try {
      await notifyStop(trimmedUserId);
    } catch (e) {
      setStatus(`Stopped locally (server notify failed: ${e.message})`);
    }
    hideSafetyModal();
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setConnLabel("Stopped");
    setConnColor("#334155");
    setStatus("Tracking stopped");
    setDetail("No tracking started.");
    clearSessionRole();
  }

  useEffect(() => {
    const handleBeforeUnload = () => {
      const trimmedUserId = userId.trim();
      if (!trimmedUserId || !userToken) return;
      notifyStop(trimmedUserId, true).catch(() => {});
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [userId, userToken]);

  return (
    <div className="container">
      <div className="topbar">
        <strong>User Interface (Next.js)</strong>
        <span className="badge" style={{ background: connColor }}>
          {connLabel}
        </span>
        <span className="status">{status}</span>
      </div>
      <div style={{ padding: 16, maxWidth: 680 }}>
        <p>
          Allow GPS, then this page will send location updates in
          near-real-time. Running users (&gt; 5 km/h) are marked red on admin
          dashboard.
        </p>
        <div className="controls-row">
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={isRunning}
            placeholder="Enter user id"
          />
          <button className="btn" onClick={startTracking}>
            Start Tracking
          </button>
          <button className="btn secondary" onClick={stopTracking}>
            Stop
          </button>
        </div>
        <div className="status">{detail}</div>
        <div className="status" style={{ fontSize: "0.85rem", color: "#64748b" }}>
          API: {apiBaseDisplay || "—"}
        </div>
      </div>

      {isSafetyModalOpen && (
        <div className="modal">
          <div className="modal-card">
            <h3 style={{ marginTop: 0 }}>Possible accident detected</h3>
            <p>
              Please confirm your safety in{" "}
              <span>{safetyCountdown}</span> seconds.
            </p>
            <input
              type="range"
              min={0}
              max={100}
              value={sliderValue}
              onChange={(e) => setSliderValue(Number(e.target.value))}
            />
            <div className="status">
              Slide fully right, then click &quot;I&apos;m safe&quot;.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                className="btn"
                onClick={async () => {
                  if (sliderValue < 100) {
                    setSafetyStatus(
                      "Slide fully to confirm you are safe."
                    );
                    return;
                  }
                  try {
                    await sendIncidentResponse("safe");
                    hideSafetyModal();
                    setStatus("Safety confirmed. No accident alert sent.");
                  } catch (e) {
                    setSafetyStatus(e.message);
                  }
                }}
              >
                I&apos;m safe
              </button>
              <button
                className="btn secondary"
                onClick={async () => {
                  try {
                    await sendIncidentResponse("hurt");
                    hideSafetyModal();
                    setStatus("Help request sent to admin.");
                  } catch (e) {
                    setSafetyStatus(e.message);
                  }
                }}
              >
                I need help
              </button>
            </div>
            <div className="status">{safetyStatus}</div>
          </div>
        </div>
      )}
    </div>
  );
}

