"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabase";

export default function AdminLayout({ children }) {
  const [admin, setAdmin] = useState(null);
  const [checking, setChecking] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    checkAdmin();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setAdmin(null);
        if (pathname !== "/admin/login") router.push("/admin/login");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkAdmin() {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      setChecking(false);
      if (pathname !== "/admin/login") router.push("/admin/login");
      return;
    }

    const { data: adminRow } = await supabase
      .from("admin_profiles")
      .select("id, full_name, role")
      .eq("id", session.user.id)
      .single();

    if (!adminRow) {
      await supabase.auth.signOut();
      setChecking(false);
      router.push("/admin/login");
      return;
    }

    setAdmin(adminRow);
    setChecking(false);
  }

  if (pathname === "/admin/login") {
    return children;
  }

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", color: "#e2e8f0" }}>
        Loading...
      </div>
    );
  }

  if (!admin) return null;

  const navItems = [
    { href: "/admin", label: "Dashboard", icon: "📊" },
    { href: "/admin/incidents", label: "Incidents", icon: "🚨" },
    { href: "/admin/users", label: "Users", icon: "👥" },
  ];

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.logoIcon} />
          <div>
            <div style={styles.brandName}>GTS Admin</div>
            <div style={styles.adminName}>{admin.full_name}</div>
          </div>
        </div>
        <nav style={styles.nav}>
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{ ...styles.navLink, ...(active ? styles.navLinkActive : {}) }}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div style={styles.sidebarFooter}>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/admin/login");
            }}
            style={styles.logoutBtn}
          >
            Logout
          </button>
        </div>
      </aside>
      <main style={styles.main}>{children}</main>
    </div>
  );
}

const styles = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    background: "#0f172a"
  },
  sidebar: {
    width: 240,
    background: "#1e293b",
    borderRight: "1px solid #334155",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0
  },
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "20px 16px",
    borderBottom: "1px solid #334155"
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "linear-gradient(135deg, #38bdf8, #6366f1)",
    flexShrink: 0
  },
  brandName: {
    fontWeight: 800,
    color: "#e2e8f0",
    fontSize: 15
  },
  adminName: {
    fontSize: 12,
    color: "#94a3b8"
  },
  nav: {
    flex: 1,
    padding: "12px 8px",
    display: "flex",
    flexDirection: "column",
    gap: 4
  },
  navLink: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 8,
    color: "#94a3b8",
    textDecoration: "none",
    fontSize: 14,
    transition: "background 150ms, color 150ms"
  },
  navLinkActive: {
    background: "rgba(56, 189, 248, 0.1)",
    color: "#e2e8f0"
  },
  sidebarFooter: {
    padding: "12px 16px",
    borderTop: "1px solid #334155"
  },
  logoutBtn: {
    width: "100%",
    padding: "8px 0",
    background: "#475569",
    border: "none",
    borderRadius: 6,
    color: "#e2e8f0",
    fontSize: 13,
    cursor: "pointer"
  },
  main: {
    flex: 1,
    overflow: "auto"
  }
};
