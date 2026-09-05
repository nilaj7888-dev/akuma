"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Sparkles, TrendingUp, Users, Target, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { MetricTile, MetricGrid } from "@/components/ui/metric-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { formatMoney } from "@/lib/format";
import { AgentConsole } from "@/components/agent-console";

type Metrics = { totalRevenue: number; orders: number; customers: number; opportunities: number; influencedRevenue: number; actionsExecuted: number; conversionLift: number };
type Opportunity = { id: string; title: string; description: string; type: string; confidence: number; expectedRevenue: number; expectedLift: number; riskScore: number; marginImpact: number; status: string; evidence: Record<string, unknown>; recommendedAction: string };

export default function OverviewPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedOppIndex, setSelectedOppIndex] = useState(0);
  const [notice, setNotice] = useState("Ready for a bounded decision.");
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState<{ name: string } | null>(null);

  const refresh = async () => {
    try {
      const meRes = await fetch("/api/auth/me");
      const meData = (await meRes.json()) as { user: { name: string } | null };
      if (meData.user) setUser(meData.user);

      // Try real API first
      const dashRes = await fetch("/api/dashboard");
      const dashData = await dashRes.json();
      setMetrics(dashData as Metrics);

      const oppRes = await fetch("/api/dashboard/opportunities");
      const oppData = await oppRes.json() as Opportunity[];
      setOpportunities(Array.isArray(oppData) ? oppData : []);
    } catch {
      setMetrics(null);
      setOpportunities([]);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const runAnalysis = async () => {
    setBusy(true);
    setNotice("AKUMA is analyzing purchase patterns and policy...");

    try {
      // Call the new AI analysis endpoint
      const analyzeRes = await fetch("/api/dashboard/analyze", { method: "POST" });
      const analyzeData = await analyzeRes.json();

      if (analyzeRes.ok && analyzeData.success) {
        setNotice(`${analyzeData.opportunitiesCreated} opportunities found by AI analysis.`);
      } else {
        setNotice(analyzeData.error?.message || "Analysis completed but no opportunities found.");
      }

      // Refresh to get the newly created opportunities
      await refresh();
    } catch (error) {
      console.error("Analysis failed:", error);
      setNotice("Analysis failed. Please try again.");
    }

    setBusy(false);
  };

  const now = new Date();
  const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  const dateString = `${dayNames[now.getDay()]}, ${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  const timeString = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} IST`;
  const greetHour = now.getHours();
  const greeting = greetHour < 12 ? "Good morning" : greetHour < 17 ? "Good afternoon" : "Good evening";

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
            <p className="subhead">AKUMA found a path to more revenue. One action is ready for your decision.</p>
          </FadeIn>
          <Button onClick={runAnalysis} disabled={busy} icon={<Sparkles size={16} />}>
            {busy ? "Analyzing..." : "Run analysis"}
          </Button>
        </div>

        <div className="notice">
          <span className="notice-icon">
            <ShieldCheck size={15} />
          </span>
          <span>
            <strong>Bounded autonomy is active.</strong> AI proposes, policy decides, you approve. No action can bypass merchant controls.
          </span>
          <span className="notice-status">
            <span style={{ color: "var(--green)" }}>●</span> {notice}
          </span>
        </div>

        <MetricGrid columns={4}>
          <MetricTile label="TOTAL REVENUE" value={metrics ? formatMoney(metrics.totalRevenue) : "—"} delta="+12.8%" trend="up" icon={TrendingUp} />
          <MetricTile label="AI-INFLUENCED REVENUE" value={metrics ? formatMoney(metrics.influencedRevenue) : "—"} delta="+8.4%" trend="up" icon={Sparkles} />
          <MetricTile label="OPPORTUNITIES" value={metrics?.opportunities ?? "—"} delta="4 new today" trend="up" icon={Target} />
          <MetricTile label="ACTIONS EXECUTED" value={metrics?.actionsExecuted ?? "—"} delta="+3 this week" trend="up" icon={ShieldCheck} />
        </MetricGrid>

        <div className="section-heading">
          <div>
            <p className="eyebrow">DECISION QUEUE</p>
            <h2>{opportunities.length} opportunities need review</h2>
          </div>
        </div>

        <section className="main-grid">
          <div className="opportunity-panel">
            {opportunities.length > 0 ? (
              <StaggerContainer>
                <div className="panel-top">
                  <div className="opportunity-type">
                    <span className="pulse" />
                    {opportunities[selectedOppIndex]?.type === "CROSS_SELL"
                      ? "CROSS-SELL OPPORTUNITY"
                      : opportunities[selectedOppIndex]?.type === "REACTIVATION"
                        ? "REACTIVATION OPPORTUNITY"
                        : opportunities[selectedOppIndex]?.type === "REVENUE_LEAK"
                          ? "REVENUE LEAK"
                          : "PRICE OPTIMIZATION"}
                  </div>
                  <span className="pending">AWAITING APPROVAL</span>
                </div>

                <div className="opportunity-title">
                  <div>
                    <h3>{opportunities[selectedOppIndex]?.title}</h3>
                    <p>{opportunities[selectedOppIndex]?.description}</p>
                  </div>
                  <div className="confidence">
                    <strong>{opportunities[selectedOppIndex]?.confidence}%</strong>
                    <span>confidence</span>
                  </div>
                </div>

                <div className="evidence-row">
                  <div>
                    <span>EXPECTED REVENUE</span>
                    <strong>{formatMoney(opportunities[selectedOppIndex]?.expectedRevenue ?? 0)}</strong>
                    <small>incremental impact</small>
                  </div>
                  <div>
                    <span>EXPECTED LIFT</span>
                    <strong>{opportunities[selectedOppIndex]?.expectedLift}%</strong>
                    <small>conversion estimate</small>
                  </div>
                  <div>
                    <span>MARGIN IMPACT</span>
                    <strong>{formatMoney(opportunities[selectedOppIndex]?.marginImpact ?? 0)}</strong>
                    <small>per transaction</small>
                  </div>
                  <div>
                    <span>RISK SCORE</span>
                    <strong style={{ color: "var(--green)" }}>LOW · {opportunities[selectedOppIndex]?.riskScore}</strong>
                    <small>bounded action</small>
                  </div>
                </div>

                <div className="action-preview">
                  <div>
                    <span className="preview-tag">RECOMMENDATION</span>
                    <h4>{opportunities[selectedOppIndex]?.recommendedAction}</h4>
                    <p>
                      Opportunity {selectedOppIndex + 1} of {opportunities.length}
                    </p>
                  </div>
                  <div className="guardrail">
                    <ShieldCheck size={16} />
                    <span>
                      <strong>POLICY COMPLIANT</strong>
                      <small>Risk score {opportunities[selectedOppIndex]?.riskScore} (low)</small>
                    </span>
                  </div>
                </div>

                <div className="panel-actions">
                  <Button variant="primary" icon={<ShieldCheck size={16} />} disabled={busy}>
                    Approve action
                  </Button>
                  <Button variant="ghost" icon={<ArrowRight size={16} />}>
                    View details
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
              <EmptyState icon={Sparkles} title="No opportunities detected yet." action={{ label: "Run AKUMA analysis", onClick: runAnalysis, icon: <ArrowRight size={14} /> }} />
            )}
          </div>
          <AgentConsole role="MERCHANT" />
        </section>

        <footer style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: "9px", marginTop: "32px" }}>
          <span>AKUMA / commerce intelligence</span>
          <span>Local deterministic demo · Razorpay Test Mode</span>
        </footer>
      </section>
    </PageTransition>
  );
}
