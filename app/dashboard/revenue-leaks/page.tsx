"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, TrendingDown } from "lucide-react";
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { MetricTile, MetricGrid } from "@/components/ui/metric-tile";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { formatMoney } from "@/lib/format";

type LeakType = "UNSOLD_INVENTORY" | "LOW_MARGIN_PRODUCT" | "INACTIVE_CUSTOMER" | "DECLINING_SALES" | "EXCESS_DISCOUNTING";
type Severity = "CRITICAL" | "HIGH" | "MEDIUM";
type RevenueLeak = {
  id: string;
  type: LeakType;
  title: string;
  description: string;
  severity: Severity;
  estimatedLossAmount: number;
  evidence: Record<string, unknown>;
  recommendedAction: string;
  actionPriority: number;
};

const SEVERITY_VARIANT: Record<Severity, "error" | "warning" | "info"> = {
  CRITICAL: "error",
  HIGH: "warning",
  MEDIUM: "info",
};

export default function RevenueLeaksPage() {
  const [leaks, setLeaks] = useState<RevenueLeak[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setError(false);
    try {
      const res = await fetch("/api/revenue-leaks/leaks");
      if (!res.ok) throw new Error("request failed");
      const data = (await res.json()) as RevenueLeak[];
      setLeaks(Array.isArray(data) ? data.sort((a, b) => b.actionPriority - a.actionPriority) : []);
    } catch {
      setLeaks([]);
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const totalImpact = leaks.reduce((sum, leak) => sum + leak.estimatedLossAmount, 0);
  const critical = leaks.filter((l) => l.severity === "CRITICAL").length;

  return (
    <PageTransition>
      <section className="content">
        <header className="topbar">
          <div className="crumb">
            <span>Dashboard</span>
            <span>/</span>
            <strong>Revenue Leaks</strong>
          </div>
        </header>

        <div className="page-head">
          <FadeIn>
            <p className="eyebrow">REVENUE RECOVERY</p>
            <h1>Revenue Leaks</h1>
            <p className="subhead">Operational issues quietly costing you money — found by scanning stock, margins, and customer activity.</p>
          </FadeIn>
        </div>

        {!loading && !error && leaks.length > 0 && (
          <MetricGrid columns={3}>
            <MetricTile label="Total Identified" value={formatMoney(totalImpact)} delta={`${leaks.length} leak${leaks.length === 1 ? "" : "s"}`} trend="down" icon={TrendingDown} />
            <MetricTile label="Critical" value={critical} delta="Needs attention first" trend={critical > 0 ? "down" : "neutral"} icon={AlertTriangle} />
            <MetricTile label="Avg Impact" value={formatMoney(Math.round(totalImpact / Math.max(leaks.length, 1)))} delta="Per leak" trend="down" />
          </MetricGrid>
        )}

        {loading ? (
          <div style={{ display: "grid", gap: "12px" }}>
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : error ? (
          <EmptyState icon={TrendingDown} title="Couldn't load revenue leaks" description="The request failed. Check your connection and try again." action={{ label: "Retry", onClick: load }} />
        ) : leaks.length > 0 ? (
          <StaggerContainer delay={0.08}>
            <div style={{ display: "grid", gap: "12px" }}>
              {leaks.map((leak) => (
                <StaggerItem key={leak.id}>
                  <Card hover>
                    <CardBody style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: "240px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                          <AlertTriangle size={16} style={{ color: "#ef4444" }} />
                          <h3 style={{ margin: 0, fontSize: "14px" }}>{leak.title}</h3>
                          <Badge variant={SEVERITY_VARIANT[leak.severity]} size="sm">{leak.severity}</Badge>
                        </div>
                        <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 8px 0" }}>{leak.description}</p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontSize: "10px", color: "var(--muted)", margin: "0 0 4px 0" }}>Estimated Loss</p>
                          <p style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#ef4444" }}>{formatMoney(leak.estimatedLossAmount)}</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", color: "var(--amber)", maxWidth: "180px", textAlign: "right" }}>
                          <ArrowRight size={12} />
                          <span>{leak.recommendedAction}</span>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </StaggerItem>
              ))}
            </div>
          </StaggerContainer>
        ) : (
          <EmptyState icon={TrendingDown} title="No revenue leaks detected" description="Your inventory, margins, and customer retention all look healthy right now." />
        )}
      </section>
    </PageTransition>
  );
}
