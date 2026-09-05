"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity, ChevronRight, CircleDollarSign, Clock3, DollarSign, Gauge, LayoutDashboard, LogOut, Menu, MessageSquare, Package, ShieldCheck, Target, TrendingDown, TrendingUp, User, Users, Zap } from "lucide-react";
import Link from "next/link";
import { BrandReset, resetAkumaState } from "@/components/brand-reset";
import { NegotiationBanner } from "@/components/negotiation-banner";

type User = { name: string; role: "MERCHANT" | "BUYER" } | null;
type MerchantProfile = { name: string } | null;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User>(null);
  const [merchant, setMerchant] = useState<MerchantProfile>(null);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<{ opportunities?: number; pendingApprovals?: number }>({});
  const [negotiationsCount, setNegotiationsCount] = useState(0);
  const [health, setHealth] = useState<{ razorpay?: string; webhook?: string } | null>(null);
  const [aiHealth, setAiHealth] = useState<{ status?: string } | null>(null);

  useEffect(() => {
    // Get or create tab-specific demo identity
    const getTabId = () => {
      let tabId = sessionStorage.getItem("akuma_tab_id");
      if (!tabId) {
        tabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        sessionStorage.setItem("akuma_tab_id", tabId);
      }
      return tabId;
    };

    const init = async () => {
      try {
        const tabId = getTabId();
        const [authRes, metricsRes, merchantRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/dashboard"),
          fetch("/api/merchant/profile")
        ]);
        const authData = await authRes.json() as { user: { name: string; role: "OWNER"; accountType?: "MERCHANT" | "CONSUMER" } | null };
        if (!authData.user) {
          router.push("/");
          return;
        }
        if (authData.user.accountType === "CONSUMER") {
          // Store consumer identity for this tab
          sessionStorage.setItem(`akuma_demo_role_${tabId}`, "CONSUMER");
          router.push("/shop");
          return;
        }
        // Store merchant identity for this tab
        sessionStorage.setItem(`akuma_demo_role_${tabId}`, "MERCHANT");
        const metricsData = await metricsRes.json() as { opportunities?: number; pendingApprovals?: number };
        setMetrics(metricsData);
        setUser({ name: authData.user.name, role: "MERCHANT" });

        // Fetch merchant profile for display name
        if (merchantRes.ok) {
          const merchantData = await merchantRes.json();
          setMerchant(merchantData);
        }

        setLoading(false);
      } catch {
        router.push("/");
      }
    };
    void init();
  }, [router]);

  // Poll for active negotiations count
  useEffect(() => {
    if (!user || user.role !== "MERCHANT") return;

    const fetchNegotiations = async () => {
      try {
        const res = await fetch("/api/negotiation/active");
        if (res.ok) {
          const data = await res.json();
          setNegotiationsCount(Array.isArray(data) ? data.length : 0);
        }
      } catch {
        // Silent fail
      }
    };

    fetchNegotiations();
    const interval = setInterval(fetchNegotiations, 3000);
    return () => clearInterval(interval);
  }, [user]);

  // System status panel reflects real configuration, never an assumed "all good".
  useEffect(() => {
    if (!user || user.role !== "MERCHANT") return;
    let cancelled = false;
    const loadHealth = async () => {
      try {
        const [healthRes, aiRes] = await Promise.all([fetch("/api/health"), fetch("/api/ai/health")]);
        if (!cancelled && healthRes.ok) setHealth(await healthRes.json());
        if (!cancelled && aiRes.ok) setAiHealth(await aiRes.json());
      } catch {
        // Leave status as "checking" rather than claiming a state we couldn't verify.
      }
    };
    void loadHealth();
    return () => { cancelled = true; };
  }, [user]);

  if (loading) return <main className="auth-loading"><span className="brand-mark">A</span><p>Securing your AKUMA session...</p></main>;

  return (
    <main className="shell">
      <aside className="sidebar">
        <BrandReset />
        <div className="workspace">
          <span className="avatar">{user?.name?.slice(0, 2).toUpperCase() || "NE"}</span>
          <div><strong>{user?.name || "Nova Electronics"}</strong><small>Merchant workspace</small></div>
          <ChevronRight size={15} />
        </div>
        <nav>
          <p className="nav-label">COMMAND CENTER</p>
          <Link href="/dashboard" className="nav-link"><LayoutDashboard size={17} /> Overview</Link>
          <Link href="/dashboard/daily" className="nav-link"><Zap size={17} /> What To Do Today</Link>
          <Link href="/dashboard/opportunities" className="nav-link"><Target size={17} /> Opportunities <b>{metrics.opportunities ?? 0}</b></Link>
          <Link href="/dashboard/acquisition" className="nav-link"><TrendingUp size={17} /> Acquisition</Link>
          <Link href="/dashboard/churn" className="nav-link"><Activity size={17} /> Churn & Win-Back</Link>
          <Link href="/dashboard/inventory" className="nav-link"><Package size={17} /> Inventory</Link>
          <Link href="/dashboard/negotiations" className="nav-link"><MessageSquare size={17} /> Negotiations <b className={negotiationsCount > 0 ? "amber" : ""}>{negotiationsCount}</b></Link>
          <Link href="/dashboard/pricing" className="nav-link"><DollarSign size={17} /> Pricing</Link>
          <Link href="/dashboard/segmentation" className="nav-link"><Users size={17} /> Segments</Link>
          <Link href="/dashboard/revenue-leaks" className="nav-link"><TrendingDown size={17} /> Revenue Leaks</Link>
          <Link href="/dashboard/agent" className="nav-link"><Activity size={17} /> Agent runs</Link>
          <Link href="/dashboard/catalog" className="nav-link"><Package size={17} /> Catalog</Link>
          <Link href="/dashboard/campaigns" className="nav-link"><CircleDollarSign size={17} /> Campaigns</Link>
          <p className="nav-label lower">CONTROL</p>
          <Link href="/dashboard/approvals" className="nav-link"><ShieldCheck size={17} /> Approvals {!!metrics.pendingApprovals && <b className="amber">{metrics.pendingApprovals}</b>}</Link>
          <Link href="/dashboard/audit" className="nav-link"><Clock3 size={17} /> Audit trail</Link>
          <Link href="/dashboard/policies" className="nav-link"><Gauge size={17} /> Policies</Link>
          <Link href="/dashboard/profile" className="nav-link"><User size={17} /> Profile</Link>
        </nav>
        <div className="system">
          <div className="system-head">
            <span>System status</span>
            {health && aiHealth ? (
              <span className="live-dot" style={{ color: aiHealth.status === "online" ? "var(--green)" : "var(--amber)" }}>
                ● {aiHealth.status === "online" ? "Operational" : "Limited (AI offline)"}
              </span>
            ) : (
              <span className="live-dot" style={{ color: "var(--muted)" }}>Checking...</span>
            )}
          </div>
          <div className="health">
            <span>Razorpay</span>
            <i>{!health ? "Checking..." : health.razorpay === "test_mode_configured" ? "Test API connected" : "Local simulation (no live keys)"}</i>
          </div>
          <div className="health">
            <span>Webhook</span>
            <i>{!health ? "Checking..." : health.webhook === "verification_ready" ? "Verified" : "Not configured"}</i>
          </div>
          <div className="health">
            <span>Agent</span>
            <i>{!aiHealth ? "Checking..." : aiHealth.status === "online" ? "Ready" : "Offline · deterministic fallback"}</i>
          </div>
        </div>
        <div className="profile" onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          resetAkumaState("/");
        }} style={{ cursor: "pointer" }}>
          <span className="avatar user">{user?.name?.slice(0, 2).toUpperCase() || "NL"}</span>
          <div><strong>{user?.name || "User"}</strong><small>Owner</small></div>
          <LogOut size={16} />
        </div>
      </aside>
      {children}
      <NegotiationBanner role="MERCHANT" />
    </main>
  );
}
