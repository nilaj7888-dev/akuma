"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle } from "lucide-react";
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { MetricTile, MetricGrid } from "@/components/ui/metric-tile";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { formatMoney } from "@/lib/format";

type ExperimentVariant = {
  id: string;
  name: string;
  impressions: number;
  conversions: number;
  revenue: number;
  conversionRate: number;
  revenuePerImpression: number;
  isWinner: boolean;
};
type Experiment = {
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "RUNNING" | "COMPLETED" | "CANCELLED";
  variants: ExperimentVariant[];
  winnerId: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

const STATUS_VARIANT: Record<Experiment["status"], "success" | "warning" | "info" | "error"> = {
  RUNNING: "warning",
  COMPLETED: "success",
  DRAFT: "info",
  CANCELLED: "error",
};

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setError(false);
    try {
      const res = await fetch("/api/experiments");
      if (!res.ok) throw new Error("request failed");
      const data = (await res.json()) as Experiment[];
      setExperiments(Array.isArray(data) ? data : []);
    } catch {
      setExperiments([]);
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const running = experiments.filter((e) => e.status === "RUNNING").length;
  const completed = experiments.filter((e) => e.status === "COMPLETED").length;
  const decided = experiments.filter((e) => e.status === "COMPLETED" && e.winnerId);
  const avgLift = decided.length
    ? Math.round(
        decided.reduce((sum, exp) => {
          const winner = exp.variants.find((v) => v.id === exp.winnerId);
          const baseline = exp.variants.find((v) => v.id !== exp.winnerId);
          if (!winner || !baseline || baseline.conversionRate <= 0) return sum;
          return sum + ((winner.conversionRate - baseline.conversionRate) / baseline.conversionRate) * 100;
        }, 0) / decided.length
      )
    : null;
  const totalRevenue = experiments.reduce((sum, exp) => sum + exp.variants.reduce((s, v) => s + v.revenue, 0), 0) / 100;

  return (
    <PageTransition>
      <section className="content">
        <header className="topbar">
          <div className="crumb">
            <span>Dashboard</span>
            <span>/</span>
            <strong>Experiments</strong>
          </div>
        </header>

        <div className="page-head">
          <FadeIn>
            <p className="eyebrow">A/B TESTING</p>
            <h1>Experiments</h1>
            <p className="subhead">Real conversion and revenue results from each variant, tracked as they run.</p>
          </FadeIn>
        </div>

        {!loading && !error && experiments.length > 0 && (
          <MetricGrid columns={4}>
            <MetricTile label="Running" value={running} delta="Currently live" trend="neutral" />
            <MetricTile label="Completed" value={completed} delta="With a recorded result" trend="neutral" />
            <MetricTile label="Avg Lift" value={avgLift != null ? `${avgLift > 0 ? "+" : ""}${avgLift}%` : "—"} delta={decided.length ? `Across ${decided.length} decided experiment${decided.length === 1 ? "" : "s"}` : "No decided experiments yet"} trend={avgLift != null && avgLift > 0 ? "up" : "neutral"} />
            <MetricTile label="Total Revenue Tracked" value={formatMoney(totalRevenue)} delta="Across all variants" trend="neutral" />
          </MetricGrid>
        )}

        {loading ? (
          <div style={{ display: "grid", gap: "16px" }}>
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : error ? (
          <EmptyState icon={AlertTriangle} title="Couldn't load experiments" description="The request failed. Check your connection and try again." action={{ label: "Retry", onClick: load }} />
        ) : experiments.length > 0 ? (
          <StaggerContainer delay={0.1}>
            <div style={{ display: "grid", gap: "16px" }}>
              {experiments.map((exp) => (
                <StaggerItem key={exp.id}>
                  <Card gradient hover>
                    <CardHeader>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                        <h3 style={{ margin: 0, fontSize: "14px" }}>{exp.name}</h3>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <Badge variant={STATUS_VARIANT[exp.status]} size="sm">{exp.status}</Badge>
                          {exp.winnerId && <Badge variant="success" size="sm">Winner: {exp.variants.find((v) => v.id === exp.winnerId)?.name ?? "—"}</Badge>}
                        </div>
                      </div>
                    </CardHeader>
                    <CardBody>
                      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(exp.variants.length, 1)}, 1fr)`, gap: "24px" }}>
                        {exp.variants.map((variant) => (
                          <div key={variant.id}>
                            <p style={{ fontSize: "10px", color: "var(--muted)", margin: "0 0 8px 0", fontWeight: 500 }}>{variant.name}{variant.isWinner ? " · Winner" : ""}</p>
                            <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "4px" }}>
                              <p style={{ margin: 0, fontSize: "20px", fontWeight: 600, color: variant.isWinner ? "var(--green)" : "var(--ink)" }}>{variant.conversionRate.toFixed(1)}%</p>
                              <p style={{ margin: 0, fontSize: "10px", color: "var(--muted)" }}>{variant.conversions} / {variant.impressions}</p>
                            </div>
                            <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>{formatMoney(variant.revenue / 100)} revenue</p>
                          </div>
                        ))}
                        {exp.variants.length === 0 && <p style={{ fontSize: "11px", color: "var(--muted)" }}>No variant traffic recorded yet.</p>}
                      </div>
                    </CardBody>
                  </Card>
                </StaggerItem>
              ))}
            </div>
          </StaggerContainer>
        ) : (
          <EmptyState icon={Activity} title="No experiments yet" description="A/B tests you run against your catalog or pricing will show up here with real conversion and revenue data." />
        )}
      </section>
    </PageTransition>
  );
}
