"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (authError) throw authError;

      const { data: adminRow } = await supabase
        .from("admin_profiles")
        .select("id, role")
        .eq("id", data.user.id)
        .single();

      if (!adminRow) {
        await supabase.auth.signOut();
        throw new Error("This account is not an admin.");
      }

      window.location.href = "/admin";
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <form onSubmit={handleLogin} style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.logoIcon} />
          <h1 style={styles.title}>GTS Admin</h1>
        </div>
        <p style={styles.subtitle}>Sign in to the admin dashboard</p>

        <label style={styles.label}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={styles.input}
          placeholder="admin@company.com"
        />

        <label style={styles.label}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={styles.input}
          placeholder="••••••••"
        />

        {error && <div style={styles.error}>{error}</div>}

        <button type="submit" disabled={loading} style={styles.btn}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0f172a",
    padding: 24
  },
  card: {
    width: "100%",
    maxWidth: 380,
    background: "#1e293b",
    borderRadius: 16,
    padding: 32,
    border: "1px solid #334155"
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 8
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: "linear-gradient(135deg, #38bdf8, #6366f1)"
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
    color: "#e2e8f0"
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 14,
    marginBottom: 24,
    marginTop: 4
  },
  label: {
    display: "block",
    color: "#94a3b8",
    fontSize: 13,
    marginBottom: 6,
    marginTop: 16
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #475569",
    background: "#0f172a",
    color: "#e2e8f0",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box"
  },
  error: {
    marginTop: 12,
    color: "#f87171",
    fontSize: 13,
    textAlign: "center"
  },
  btn: {
    marginTop: 24,
    width: "100%",
    padding: "12px 0",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(135deg, #38bdf8, #6366f1)",
    color: "#0f172a",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer"
  }
};
