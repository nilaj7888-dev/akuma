"use client";

import { useEffect, useState } from "react";
import { TrendingUp, BarChart3 } from "lucide-react";
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { MetricTile, MetricGrid } from "@/components/ui/metric-tile";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/mock-data";

type FunnelStep = { name: string; count: number; conversion: number };
type FunnelAnalysis = { steps: FunnelStep[]; dropoffReasons: Array<{ step: string; reason: string; percentage: number }> };

export default function FunnelPage() {
  const [funnel, setFunnel] = useState<FunnelAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch("/api/funnel/analysis");
        const data = await res.json() as FunnelAnalysis;
        if (data && data.steps) {
          setFunnel(data);
        } else {
          throw new Error("Invalid data");
        }
      } catch {
        setFunnel(null);
      }
      setLoading(false);
    };
    void loadData();
  }, []);

  const totalAtTop = funnel?.steps[0]?.count ?? 0;

  return (
    <PageTransition>
      <section className="content">
        <header className="topbar">
          <div className="crumb">
            <span>Dashboard</span>
            <span>/</span>
            <strong>Funnel</strong>
          </div>
        </header>

        <div className="page-head">
          <FadeIn>
            <p className="eyebrow">CONVERSION FUNNEL</p>
            <h1>Funnel Analysis</h1>
            <p className="subhead">Track conversion rates through each stage and identify optimization opportunities.</p>
          </FadeIn>
          <Button icon={<BarChart3 size={16} />}>Export report</Button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ color: "var(--muted)" }}>Loading funnel data...</p>
          </div>
        ) : funnel ? (
          <StaggerContainer delay={0.1}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {funnel.steps.map((step, i) => {
                const percentOfTotal = totalAtTop > 0 ? (step.count / totalAtTop) * 100 : 0;
                return (
                  <StaggerItem key={i}>
                    <Card>
                      <CardBody style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                        <div style={{ width: "40px", height: "40px", background: "var(--line)", borderRadius: "8px", display: "grid", placeItems: "center", color: "var(--amber)", fontSize: "18px", fontWeight: "600" }}>
                          {i + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ margin: "0 0 4px 0", fontSize: "14px" }}>{step.name}</h3>
                          <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>
                            {step.count.toLocaleString()} users · {percentOfTotal.toFixed(1)}% of total
                          </p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                          <div style={{ width: "150px", height: "6px", background: "var(--line)", borderRadius: "3px", overflow: "hidden" }}>
                            <div
                              style={{
                                height: "100%",
                                background: "linear-gradient(90deg, var(--amber), var(--green))",
                                width: `${percentOfTotal}%`,
                              }}
                            />
                          </div>
                          <div style={{ textAlign: "right", minWidth: "60px" }}>
                            <p style={{ margin: "0 0 2px 0", fontSize: "13px", color: "var(--amber)", fontWeight: "600" }}>{step.conversion}%</p>
                            <p style={{ margin: 0, fontSize: "9px", color: "var(--muted)" }}>conversion</p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </StaggerItem>
                );
              })}
            </div>

            {funnel.dropoffReasons.length > 0 && (
              <>
                <h3 style={{ marginTop: "32px", marginBottom: "12px" }}>Top Dropoff Reasons</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
                  {funnel.dropoffReasons.map((item, i) => (
                    <StaggerItem key={i}>
                      <Card>
                        <CardBody>
                          <p style={{ fontSize: "10px", color: "var(--muted)", margin: "0 0 4px 0", fontWeight: "500" }}>{item.step}</p>
                          <p style={{ fontSize: "13px", color: "var(--ink)", margin: "0 0 8px 0" }}>{item.reason}</p>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ flex: 1, height: "4px", background: "var(--line)", borderRadius: "2px", overflow: "hidden" }}>
                              <div style={{ height: "100%", background: "#ef4444", width: `${item.percentage}%` }} />
                            </div>
                            <span style={{ fontSize: "12px", color: "#ef4444", fontWeight: "600" }}>{item.percentage}%</span>
                          </div>
                        </CardBody>
                      </Card>
                    </StaggerItem>
                  ))}
                </div>
              </>
            )}
          </StaggerContainer>
        ) : (
          <EmptyState icon={TrendingUp} title="No funnel data yet" description="Conversion steps appear once you have enough shopper activity to analyze." />
        )}
      </section>
    </PageTransition>
  );
}
