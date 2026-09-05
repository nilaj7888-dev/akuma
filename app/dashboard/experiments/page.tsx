"use client";

import { useEffect, useState } from "react";
import { Activity, Zap } from "lucide-react";
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { MetricTile, MetricGrid } from "@/components/ui/metric-tile";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/format";

type Experiment = { id: string; name: string; status: string; variantA: { name: string; conversions: number; visitors: number }; variantB: { name: string; conversions: number; visitors: number }; significance: number; winner: string | null };

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadExperiments = async () => {
      try {
        const res = await fetch("/api/experiments");
        const data = await res.json() as Experiment[];
        if (Array.isArray(data)) {
          setExperiments(data);
        } else {
          throw new Error("Invalid data");
        }
      } catch {
        setExperiments([]);
      }
      setLoading(false);
    };
    void loadExperiments();
  }, []);

  const running = experiments.filter((e) => e.status === "RUNNING").length;
  const completed = experiments.filter((e) => e.status === "COMPLETED").length;

  const statusColors: Record<string, any> = {
    RUNNING: "amber",
    COMPLETED: "success",
    DRAFT: "info",
  };

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
            <h1>Active Experiments</h1>
            <p className="subhead">Run and monitor A/B tests to optimize conversion rates and revenue.</p>
          </FadeIn>
          <Button icon={<Zap size={16} />}>Start new experiment</Button>
        </div>

        <MetricGrid columns={4}>
          <MetricTile label="Running" value={running} delta="Active experiments" trend="up" />
          <MetricTile label="Completed" value={completed} delta="This quarter" trend="up" />
          <MetricTile label="Avg Lift" value="12.4%" delta="Across all experiments" trend="up" />
          <MetricTile label="Revenue Impact" value={formatMoney(125000)} delta="From winners" trend="up" />
        </MetricGrid>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ color: "var(--muted)" }}>Loading experiments...</p>
          </div>
        ) : experiments.length > 0 ? (
          <StaggerContainer delay={0.1}>
            <div style={{ display: "grid", gap: "16px" }}>
              {experiments.map((exp) => {
                const rateA = exp.variantA.visitors > 0 ? (exp.variantA.conversions / exp.variantA.visitors) * 100 : 0;
                const rateB = exp.variantB.visitors > 0 ? (exp.variantB.conversions / exp.variantB.visitors) * 100 : 0;
                const lift = rateA > 0 ? ((rateB - rateA) / rateA) * 100 : 0;

                return (
                  <StaggerItem key={exp.id}>
                    <Card gradient hover>
                      <CardHeader>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                          <h3 style={{ margin: 0, fontSize: "14px" }}>{exp.name}</h3>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <Badge variant={statusColors[exp.status]} size="sm">
                              {exp.status}
                            </Badge>
                            {exp.winner && <Badge variant="success" size="sm">Winner: {exp.winner}</Badge>}
                          </div>
                        </div>
                      </CardHeader>
                      <CardBody>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "16px" }}>
                          <div>
                            <p style={{ fontSize: "10px", color: "var(--muted)", margin: "0 0 8px 0", fontWeight: "500" }}>{exp.variantA.name}</p>
                            <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "8px" }}>
                              <p style={{ margin: 0, fontSize: "20px", fontWeight: "600", color: "var(--ink)" }}>{rateA.toFixed(1)}%</p>
                              <p style={{ margin: 0, fontSize: "10px", color: "var(--muted)" }}>{exp.variantA.conversions} / {exp.variantA.visitors}</p>
                            </div>
                          </div>
                          <div>
                            <p style={{ fontSize: "10px", color: "var(--muted)", margin: "0 0 8px 0", fontWeight: "500" }}>{exp.variantB.name}</p>
                            <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "8px" }}>
                              <p style={{ margin: 0, fontSize: "20px", fontWeight: "600", color: "var(--green)" }}>{rateB.toFixed(1)}%</p>
                              <p style={{ margin: 0, fontSize: "10px", color: "var(--muted)" }}>{exp.variantB.conversions} / {exp.variantB.visitors}</p>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "var(--panel)", borderRadius: "6px" }}>
                          <div>
                            <p style={{ fontSize: "10px", color: "var(--muted)", margin: "0 0 4px 0" }}>Lift</p>
                            <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "var(--amber)" }}>
                              {lift > 0 ? "+" : ""}
                              {lift.toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p style={{ fontSize: "10px", color: "var(--muted)", margin: "0 0 4px 0" }}>Significance</p>
                            <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: exp.significance > 90 ? "var(--green)" : "var(--amber)" }}>
                              {exp.significance}%
                            </p>
                          </div>
                          <Button variant={exp.status === "RUNNING" ? "ghost" : "primary"} size="sm">
                            {exp.status === "RUNNING" ? "Stop" : "Review"}
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  </StaggerItem>
                );
              })}
            </div>
          </StaggerContainer>
        ) : (
          <EmptyState icon={Activity} title="No experiments yet" description="Create your first A/B test to optimize your store" />
        )}
      </section>
    </PageTransition>
  );
}
