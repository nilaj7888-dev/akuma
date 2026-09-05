"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, RefreshCw, Sparkles, ShieldCheck, Target, TrendingUp } from "lucide-react";
import { MetricTile, MetricGrid } from "@/components/ui/metric-tile";
import { MetricSkeleton, CardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { PageTransition, FadeIn, StaggerContainer } from "@/components/ui/animations";
import { formatMoney } from "@/lib/format";
import { showToast } from "@/components/toast";
import { AgentConsole } from "@/components/agent-console";

type Metrics = {
  totalRevenue: number;
  orders: number;
  customers: number;
  opportunities: number;
  pendingApprovals: number;
  influencedRevenue: number;
  actionsExecuted: number;
};
type Opportunity = {
  id: string;
  title: string;
  description: string;
  type: string;
  confidence: number;
  expectedRevenue: number;
  expectedLift: number;
  riskScore: number;
  marginImpact: number;
  status: string;
  evidence: Record<string, unknown>;
  recommendedAction: string;
};

const TYPE_LABEL: Record<string, string> = {
  CROSS_SELL: "CROSS-SELL OPPORTUNITY",
  UPSELL: "UPSELL OPPORTUNITY",
  BUNDLE: "BUNDLE OPPORTUNITY",
  REACTIVATION: "REACTIVATION OPPORTUNITY",
  CAMPAIGN: "CAMPAIGN OPPORTUNITY",
  BUYER_DEMAND_MATCH: "BUYER DEMAND MATCH",
};

export default function OverviewPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedOppIndex, setSelectedOppIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [user, setUser] = useState<{ name: string } | null>(null);

  const refresh = async () => {
    setLoadError(false);
    try {
      const [meRes, dashRes, oppRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/dashboard"),
        fetch("/api/dashboard/opportunities"),
      ]);
      if (!dashRes.ok) throw new Error("dashboard request failed");

      const meData = (await meRes.json()) as { user: { name: string } | null };
      if (meData.user) setUser(meData.user);

      const dashData = (await dashRes.json()) as Metrics;
      setMetrics(dashData);

      const oppData = (await oppRes.json()) as Opportunity[];
      const list = Array.isArray(oppData) ? oppData : [];
      setOpportunities(list);
      setSelectedOppIndex((i) => Math.min(i, Math.max(list.length - 1, 0)));
    } catch {
      setMetrics(null);
      setOpportunities([]);
      setLoadError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const analyzeRes = await fetch("/api/dashboard/analyze", { method: "POST" });
      const analyzeData = await analyzeRes.json();
      if (analyzeRes.ok && analyzeData.success) {
        showToast(
          analyzeData.opportunitiesCreated > 0
            ? `Found ${analyzeData.opportunitiesCreated} new opportunit${analyzeData.opportunitiesCreated === 1 ? "y" : "ies"}.`
            : "Analysis ran, but found nothing new to recommend right now.",
          analyzeData.opportunitiesCreated > 0 ? "success" : "info"
        );
      } else {
        showToast(analyzeData.error?.message || "Analysis could not run.", "error");
      }
      await refresh();
    } catch {
      showToast("Analysis failed. Please try again.", "error");
    }
    setAnalyzing(false);
  };

  const selected = opportunities[selectedOppIndex];
  const isPersisted = !!selected && !selected.id.startsWith("rec-");

  const approveSelected = async () => {
    if (!selected || !isPersisted) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/opportunities/${selected.id}/approve`, { method: "POST" });
      if (res.ok) {
        showToast("Approved. AKUMA created the campaign and logged it to the audit trail.", "success");
        await refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error?.message || data.error || "Couldn't approve this action.", "error");
      }
    } catch {
      showToast("Couldn't approve this action. Check your connection.", "error");
    }
    setApproving(false);
  };

  const now = new Date();
  const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  const dateString = `${dayNames[now.getDay()]}, ${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  const timeString = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} IST`;
  const greetHour = now.getHours();
  const greeting = greetHour < 12 ? "Good morning" : greetHour < 17 ? "Good afternoon" : "Good evening";

  const headline = loading
    ? "Checking your store for new opportunities..."
    : loadError
      ? "Couldn't reach your workspace just now."
      : opportunities.length > 0
        ? `AKUMA found ${opportunities.length} opportunit${opportunities.length === 1 ? "y" : "ies"} worth reviewing.`
        : "No open opportunities right now — run an analysis to look for one.";

  return (
    <PageTransition>
      <section className="content">
        <header className="topbar">
          <div className="crumb">
            <span>Workspace</span>
            <span>/</span>
            <strong>Overview</strong>
          </div>
        </header>

        <div className="page-head">
          <FadeIn>
            <p className="eyebrow">
              {dateString} <span>•</span> {timeString}
            </p>
            <h1>{greeting}, {user?.name ?? "there"}.</h1>
            <p className="subhead">{headline}</p>
          </FadeIn>
          <Button onClick={runAnalysis} disabled={analyzing} icon={<Sparkles size={16} />}>
            {analyzing ? "Analyzing..." : "Run analysis"}
          </Button>
        </div>

        <div className="notice">
          <span className="notice-icon">
            <ShieldCheck size={15} />
          </span>
          <span>
            <strong>Bounded autonomy is active.</strong> AI proposes, policy decides, you approve. No action can bypass merchant controls.
          </span>
        </div>

        {loading ? (
          <MetricGrid columns={4}>
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </MetricGrid>
        ) : loadError ? null : metrics ? (
          <MetricGrid columns={4}>
            <MetricTile label="TOTAL REVENUE" value={formatMoney(metrics.totalRevenue)} icon={TrendingUp} delta={`${metrics.orders} order${metrics.orders === 1 ? "" : "s"} total`} trend="neutral" />
            <MetricTile label="AI-INFLUENCED REVENUE" value={formatMoney(metrics.influencedRevenue)} icon={Sparkles} delta="From approved actions" trend={metrics.influencedRevenue > 0 ? "up" : "neutral"} />
            <MetricTile label="OPEN OPPORTUNITIES" value={metrics.opportunities} icon={Target} delta={metrics.pendingApprovals > 0 ? `${metrics.pendingApprovals} awaiting approval` : "None awaiting approval"} trend="neutral" />
            <MetricTile label="ACTIONS EXECUTED" value={metrics.actionsExecuted} icon={ShieldCheck} delta="All-time, approved by you" trend="neutral" />
          </MetricGrid>
        ) : null}

        <div className="section-heading">
          <div>
            <p className="eyebrow">DECISION QUEUE</p>
            <h2>{loading ? "Loading..." : `${opportunities.length} opportunit${opportunities.length === 1 ? "y" : "ies"} need review`}</h2>
          </div>
        </div>

        <section className="main-grid">
          <div className="opportunity-panel">
            {loading ? (
              <CardSkeleton />
            ) : loadError ? (
              <EmptyState icon={AlertTriangle} title="Couldn't load your workspace" description="The request failed. Check your connection and try again." action={{ label: "Retry", onClick: refresh, icon: <RefreshCw size={14} /> }} />
            ) : selected ? (
              <StaggerContainer>
                <div className="panel-top">
                  <div className="opportunity-type">
                    <span className="pulse" />
                    {TYPE_LABEL[selected.type] ?? selected.type.replace(/_/g, " ")}
                  </div>
                  <span className="pending">{isPersisted ? "AWAITING APPROVAL" : "RECOMMENDATION"}</span>
                </div>

                <div className="opportunity-title">
                  <div>
                    <h3>{selected.title}</h3>
                    <p>{selected.description}</p>
                  </div>
                  <div className="confidence">
                    <strong>{selected.confidence}%</strong>
                    <span>confidence</span>
                  </div>
                </div>

                <div className="evidence-row">
                  <div>
                    <span>EXPECTED REVENUE</span>
                    <strong>{formatMoney(selected.expectedRevenue)}</strong>
                    <small>incremental impact</small>
                  </div>
                  <div>
                    <span>EXPECTED LIFT</span>
                    <strong>{selected.expectedLift}%</strong>
                    <small>conversion estimate</small>
                  </div>
                  <div>
                    <span>MARGIN IMPACT</span>
                    <strong>{formatMoney(selected.marginImpact)}</strong>
                    <small>per transaction</small>
                  </div>
                  <div>
                    <span>RISK SCORE</span>
                    <strong style={{ color: selected.riskScore >= 60 ? "#ef4444" : selected.riskScore >= 30 ? "var(--amber)" : "var(--green)" }}>
                      {selected.riskScore >= 60 ? "HIGH" : selected.riskScore >= 30 ? "MEDIUM" : "LOW"} · {selected.riskScore}
                    </strong>
                    <small>bounded action</small>
                  </div>
                </div>

                <div className="action-preview">
                  <div>
                    <span className="preview-tag">RECOMMENDATION</span>
                    <h4>{selected.recommendedAction}</h4>
                    <p>
                      Opportunity {selectedOppIndex + 1} of {opportunities.length}
                    </p>
                  </div>
                  <div className="guardrail">
                    <ShieldCheck size={16} />
                    <span>
                      <strong>POLICY COMPLIANT</strong>
                      <small>Risk score {selected.riskScore}</small>
                    </span>
                  </div>
                </div>

                <div className="panel-actions">
                  {isPersisted ? (
                    <Button variant="primary" icon={<ShieldCheck size={16} />} disabled={approving} onClick={approveSelected}>
                      {approving ? "Approving..." : "Approve action"}
                    </Button>
                  ) : (
                    <Button variant="secondary" icon={<Sparkles size={16} />} disabled={analyzing} onClick={runAnalysis}>
                      Turn into a proposal
                    </Button>
                  )}
                  <Button variant="ghost" icon={<ArrowRight size={16} />} onClick={() => (window.location.href = "/dashboard/opportunities")}>
                    View all opportunities
                  </Button>
                </div>

                {opportunities.length > 1 && (
                  <div className="opportunity-nav" style={{ display: "flex", gap: "12px", justifyContent: "space-between", marginTop: "20px" }}>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedOppIndex(Math.max(0, selectedOppIndex - 1))} disabled={selectedOppIndex === 0}>
                      ← Previous
                    </Button>
                    <span style={{ fontSize: "10px", color: "var(--muted)", alignSelf: "center" }}>
                      {selectedOppIndex + 1} / {opportunities.length}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedOppIndex(Math.min(opportunities.length - 1, selectedOppIndex + 1))} disabled={selectedOppIndex === opportunities.length - 1}>
                      Next →
                    </Button>
                  </div>
                )}
              </StaggerContainer>
            ) : (
              <EmptyState icon={Sparkles} title="No opportunities detected yet." description="AKUMA looks at your orders, inventory, and customer activity. Run an analysis to see what it finds." action={{ label: "Run AKUMA analysis", onClick: runAnalysis, icon: <ArrowRight size={14} /> }} />
            )}
          </div>
          <AgentConsole role="MERCHANT" />
        </section>
      </section>
    </PageTransition>
  );
}
