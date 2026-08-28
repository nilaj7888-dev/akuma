"use client";

import { useEffect, useState } from "react";
import { AuthScreen } from "@/components/auth-screen";
import { OnboardingScreen } from "@/components/onboarding-screen";
import { LandingScreen } from "@/components/landing-screen";
import { AgentConsole } from "@/components/agent-console";
import { Activity, ArrowUpRight, Check, ChevronRight, CircleDollarSign, Clock3, Eye, Gauge, LayoutDashboard, LockKeyhole, Menu, Package, RefreshCw, Search, ShieldCheck, Sparkles, Target, X, type LucideIcon } from "lucide-react";

type Metrics = { totalRevenue: number; orders: number; customers: number; opportunities: number; influencedRevenue: number; actionsExecuted: number; conversionLift: number };
type Opportunity = { id: string; title: string; description: string; confidence: number; expectedRevenue: number; expectedLift: number; riskScore: number; status: string; evidence: { coPurchaseRate: number; orders: number; customers: number; window: string } };
type Audit = { id: string; actor: string; action: string; detail: string; time: string; status: string };
const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;

export default function Home() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [notice, setNotice] = useState("Ready for a bounded decision.");
  const [showWhy, setShowWhy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState<{ name: string; role: "MERCHANT" | "BUYER" } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [showLanding, setShowLanding] = useState(true);

  const refresh = async () => {
    const [m, o, a] = await Promise.all([fetch("/api/dashboard"), fetch("/api/opportunities"), fetch("/api/audit")]);
    setMetrics(await m.json());
    const items = await o.json() as Opportunity[];
    setOpportunity(items[0] ?? null);
    setAudit(await a.json());
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([fetch("/api/auth/me"), fetch("/api/onboarding")]).then(async ([authResponse, onboardingResponse]) => {
        const result = await authResponse.json() as { user: { name: string; role: "OWNER" } | null };
        const onboarding = await onboardingResponse.json() as { context: { role: "MERCHANT" | "BUYER" } | null };
        setUser(result.user ? { name: result.user.name, role: onboarding.context?.role ?? "MERCHANT" } : null);
        setOnboardingDone(Boolean(onboarding.context));
        setAuthLoading(false);
        if (result.user && onboarding.context) void refresh();
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const runAnalysis = async () => {
    setBusy(true);
    setNotice("AKUMA is analyzing purchase patterns and policy...");
    await fetch("/api/opportunities", { method: "POST" });
    await refresh();
    setBusy(false);
    setNotice("Opportunity found. The action is bounded and awaiting your approval.");
  };

  const approve = async () => {
    if (!opportunity) return;
    setBusy(true);
    const response = await fetch(`/api/opportunities/${opportunity.id}/approve`, { method: "POST" });
    setBusy(false);
    setNotice(response.ok ? "Approved. Campaign activated and audit trail updated." : "Approval could not be completed.");
    await refresh();
  };

  if (authLoading) return <main className="auth-loading"><span className="brand-mark">A</span><p>Securing your AKUMA session...</p></main>;
  if (!user) return showLanding ? <LandingScreen onStart={() => setShowLanding(false)} /> : <AuthScreen onAuthenticated={(authenticatedUser) => { setUser(authenticatedUser); setOnboardingDone(false); }} />;
  if (!onboardingDone) return <OnboardingScreen role={user.role} onComplete={() => setOnboardingDone(true)} />;

  const metricCards: Array<[string, string | number, string, LucideIcon]> = [
    ["TOTAL REVENUE", metrics ? money(metrics.totalRevenue) : "—", "+12.8%", CircleDollarSign],
    ["AI-INFLUENCED REVENUE", metrics ? money(metrics.influencedRevenue) : "—", "+8.4%", Sparkles],
    ["OPPORTUNITIES", metrics?.opportunities ?? "—", "4 new today", Target],
    ["ACTIONS EXECUTED", metrics?.actionsExecuted ?? "—", "+3 this week", ShieldCheck],
  ];

  const now = new Date();
  const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  const dateString = `${dayNames[now.getDay()]}, ${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  const timeString = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} IST`;
  const greetHour = now.getHours();
  const greeting = greetHour < 12 ? "Good morning" : greetHour < 17 ? "Good afternoon" : "Good evening";

  return (
    <main className="shell">
      {/* ── Sidebar ────────────────────────────────── */}
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">A</span><span>AKUMA</span></div>
        <div className="workspace">
          <span className="avatar">NE</span>
          <div><strong>Nova Electronics</strong><small>Merchant workspace</small></div>
          <ChevronRight size={15} />
        </div>
        <nav>
          <p className="nav-label">COMMAND CENTER</p>
          <a className="active"><LayoutDashboard size={17} /> Overview</a>
          <a href="/opportunities"><Target size={17} /> Opportunities <b>{metrics?.opportunities ?? 0}</b></a>
          <a href="/agent"><Activity size={17} /> Agent runs</a>
          <a href="/catalog"><Package size={17} /> Catalog</a>
          <a href="/campaigns"><CircleDollarSign size={17} /> Campaigns</a>
          <p className="nav-label lower">CONTROL</p>
          <a href="/approvals"><ShieldCheck size={17} /> Approvals <b className="amber">1</b></a>
          <a href="/audit"><Clock3 size={17} /> Audit trail</a>
          <a href="/policies"><Gauge size={17} /> Policies</a>
        </nav>
        <div className="system">
          <div className="system-head"><span>System status</span><span className="live-dot">● Operational</span></div>
          <div className="health"><span>Razorpay</span><i>Test API connected</i></div>
          <div className="health"><span>Webhook</span><i>Listening</i></div>
          <div className="health"><span>Agent</span><i>Ready</i></div>
        </div>
        <div className="profile">
          <span className="avatar user">NL</span>
          <div><strong>Nilaj</strong><small>Owner</small></div>
          <Menu size={16} />
        </div>
      </aside>

      {/* ── Main Content ───────────────────────────── */}
      <section className="content">
        <header className="topbar">
          <div className="crumb"><span>Workspace</span><ChevronRight size={14} /><strong>Overview</strong></div>
          <div className="top-actions">
            <span className="mode"><span className="tiny-dot" /> DEMO MODE</span>
            <button className="icon-button" title="Search disabled in demo mode" disabled><Search size={17} /></button>
            <button className="icon-button" title="Activity disabled in demo mode" disabled><Activity size={17} /></button>
          </div>
        </header>

        <div className="page-head">
          <div>
            <p className="eyebrow">{dateString} <span>•</span> {timeString}</p>
            <h1>{greeting}, {user.name}.</h1>
            <p className="subhead">AKUMA found a path to more revenue. One action is ready for your decision.</p>
          </div>
          <button className="primary-button" onClick={runAnalysis} disabled={busy}>
            <Sparkles size={16} /> {busy ? "Analyzing..." : "Run analysis"}
          </button>
        </div>

        <div className="notice">
          <span className="notice-icon"><LockKeyhole size={15} /></span>
          <span><strong>Bounded autonomy is active.</strong> AI proposes, policy decides, you approve. No action can bypass merchant controls.</span>
          <span className="notice-status"><Check size={14} /> {notice}</span>
        </div>

        {/* ── Metrics ───────────────────────────────── */}
        <section className="metric-grid">
          {metricCards.map(([label, value, delta, Icon]) => (
            <div className="metric" key={label}>
              <div className="metric-label"><span>{label}</span><Icon size={16} /></div>
              <strong>{value}</strong>
              <small><ArrowUpRight size={13} /> {delta}</small>
            </div>
          ))}
        </section>

        {/* ── Decision Queue ─────────────────────────── */}
        <div className="section-heading">
          <div>
            <p className="eyebrow">DECISION QUEUE</p>
            <h2>One opportunity needs you</h2>
          </div>
          <button className="text-button" onClick={() => setShowWhy(true)}>View evidence <ArrowUpRight size={15} /></button>
        </div>

        <section className="main-grid">
          {/* Opportunity Panel */}
          <div className="opportunity-panel">
            <div className="panel-top">
              <div className="opportunity-type"><span className="pulse" /> CROSS-SELL OPPORTUNITY</div>
              <span className="pending">AWAITING APPROVAL</span>
            </div>
            {opportunity ? (<>
              <div className="opportunity-title">
                <div>
                  <h3>{opportunity.title}</h3>
                  <p>{opportunity.description}</p>
                </div>
                <div className="confidence"><strong>{opportunity.confidence}%</strong><span>confidence</span></div>
              </div>
              <div className="evidence-row">
                <div><span>CO-PURCHASE RATE</span><strong>{opportunity.evidence.coPurchaseRate}%</strong><small>within {opportunity.evidence.window}</small></div>
                <div><span>EXPECTED LIFT</span><strong>{opportunity.expectedLift}%</strong><small>conversion estimate</small></div>
                <div><span>INCREMENTAL REVENUE</span><strong>{money(opportunity.expectedRevenue)}</strong><small>modelled impact</small></div>
                <div><span>RISK SCORE</span><strong className="green">LOW · {opportunity.riskScore}</strong><small>bounded action</small></div>
              </div>
              <div className="action-preview">
                <div>
                  <span className="preview-tag">ACTION PREVIEW</span>
                  <h4>Launch an 8% bundle offer</h4>
                  <p>Sonic Pro Headphones + Protective Case · 382 high-value customers</p>
                </div>
                <div className="guardrail">
                  <ShieldCheck size={16} />
                  <span><strong>GUARDRAIL PASSED</strong><small>8% requested ≤ 10% maximum</small></span>
                </div>
              </div>
              <div className="panel-actions">
                <button className="approve-button" onClick={approve} disabled={busy || opportunity.status !== "AWAITING_APPROVAL"}>
                  <Check size={16} /> {opportunity.status === "ACTIVE" ? "Campaign active" : "Approve action"}
                </button>
                <button className="why-button" onClick={() => setShowWhy(true)}><Eye size={16} /> Why?</button>
              </div>
            </>) : (
              <div className="empty">
                <Sparkles size={25} />
                <p>No analysis run yet.</p>
                <button className="text-button" onClick={runAnalysis}>Run AKUMA analysis <ArrowUpRight size={15} /></button>
              </div>
            )}
          </div>

          {/* ── Agent Console (replaces old shopping panel) ── */}
          <AgentConsole role={user.role} />
        </section>

        {/* ── Audit Trail ────────────────────────────── */}
        <div className="section-heading audit-heading">
          <div>
            <p className="eyebrow">TRACEABILITY</p>
            <h2>Agent activity</h2>
          </div>
          <button className="text-button" onClick={refresh}><RefreshCw size={14} /> Refresh</button>
        </div>

        <section className="audit-panel">
          {audit.slice(0, 5).map((event) => (
            <div className="audit-row" key={event.id}>
              <span className={`audit-marker ${event.actor.toLowerCase()}`} />
              <span className="audit-time">{event.time}</span>
              <span className="audit-actor">{event.actor}</span>
              <div><strong>{event.action}</strong><p>{event.detail}</p></div>
              <span className={`event-status ${event.status.toLowerCase()}`}>{event.status}</span>
            </div>
          ))}
        </section>

        <footer>
          <span>AKUMA / commerce intelligence</span>
          <span>Local deterministic demo · Razorpay Test Mode</span>
        </footer>

        {/* ── Evidence Modal ──────────────────────────── */}
        {showWhy && opportunity && (
          <div className="modal-backdrop" onClick={() => setShowWhy(false)}>
            <div className="modal" onClick={(event) => event.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowWhy(false)}><X size={18} /></button>
              <p className="eyebrow">DECISION EVIDENCE</p>
              <h2>Why AKUMA recommended this</h2>
              <p className="modal-copy">The recommendation is based on observed co-purchase behavior, not generated numbers.</p>
              <div className="why-grid">
                <div><span>Evidence</span><strong>{opportunity.evidence.coPurchaseRate}% confidence</strong><small>Headphone buyers add a case within {opportunity.evidence.window}</small></div>
                <div><span>Historical orders</span><strong>{opportunity.evidence.orders.toLocaleString("en-IN")}</strong><small>Analyzed from Nova Electronics</small></div>
                <div><span>Relevant customers</span><strong>{opportunity.evidence.customers}</strong><small>High-value audience</small></div>
                <div><span>Expected conversion</span><strong>{opportunity.expectedLift}%</strong><small>Estimated incremental lift</small></div>
              </div>
              <div className="policy-box">
                <ShieldCheck size={18} />
                <div>
                  <strong>Policy decision: RECOMMEND</strong>
                  <p>8% discount is within the configured 10% maximum. Approval is required above ₹1,000.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
