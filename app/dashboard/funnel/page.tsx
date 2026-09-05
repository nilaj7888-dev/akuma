"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { MetricTile, MetricGrid } from "@/components/ui/metric-tile";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";

type FunnelStage = { stage: string; count: number; dropoff: number; conversionRate: number };
type FunnelAnalysis = { stages: FunnelStage[]; overallConversion: number; biggestDropoff: { stage: string; dropoff: number }; recommendations: string[] };

export default function FunnelPage() {
  const [funnel, setFunnel] = useState<FunnelAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setError(false);
    try {
      const res = await fetch("/api/funnel/analysis");
      if (!res.ok) throw new Error("request failed");
      const data = (await res.json()) as FunnelAnalysis;
      if (data && Array.isArray(data.stages)) {
        setFunnel(data);
      } else {
        throw new Error("Invalid data");
      }
    } catch {
      setFunnel(null);
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const totalAtTop = funnel?.stages[0]?.count ?? 0;

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
            <p className="subhead">From the last 30 days of orders: where shoppers drop off between cart and payment.</p>
          </FadeIn>
        </div>

        {!loading && !error && funnel && funnel.stages.length > 0 && (
          <MetricGrid columns={2}>
            <MetricTile label="Overall Conversion" value={`${funnel.overallConversion}%`} delta="Cart to completed payment" trend={funnel.overallConversion >= 50 ? "up" : "down"} />
            <MetricTile label="Biggest Drop-off" value={funnel.biggestDropoff.stage || "—"} delta={funnel.biggestDropoff.dropoff > 0 ? `${funnel.biggestDropoff.dropoff}% lost here` : "No major drop-off"} trend={funnel.biggestDropoff.dropoff > 20 ? "down" : "neutral"} />
          </MetricGrid>
        )}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : error ? (
          <EmptyState icon={AlertTriangle} title="Couldn't load funnel data" description="The request failed. Check your connection and try again." action={{ label: "Retry", onClick: load }} />
        ) : funnel && funnel.stages.length > 0 ? (
          <StaggerContainer delay={0.1}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {funnel.stages.map((stage, i) => {
                const percentOfTotal = totalAtTop > 0 ? (stage.count / totalAtTop) * 100 : 0;
                return (
                  <StaggerItem key={stage.stage}>
                    <Card>
                      <CardBody style={{ display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
                        <div style={{ width: "40px", height: "40px", background: "var(--line)", borderRadius: "8px", display: "grid", placeItems: "center", color: "var(--amber)", fontSize: "18px", fontWeight: 600 }}>
                          {i + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: "160px" }}>
                          <h3 style={{ margin: "0 0 4px 0", fontSize: "14px" }}>{stage.stage}</h3>
                          <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>
                            {stage.count.toLocaleString("en-IN")} orders · {percentOfTotal.toFixed(1)}% of top of funnel
                          </p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                          <div style={{ width: "150px", height: "6px", background: "var(--line)", borderRadius: "3px", overflow: "hidden" }}>
                            <div style={{ height: "100%", background: "linear-gradient(90deg, var(--amber), var(--green))", width: `${percentOfTotal}%` }} />
                          </div>
                          <div style={{ textAlign: "right", minWidth: "70px" }}>
                            <p style={{ margin: "0 0 2px 0", fontSize: "13px", color: "var(--amber)", fontWeight: 600 }}>{stage.conversionRate}%</p>
                            <p style={{ margin: 0, fontSize: "9px", color: "var(--muted)" }}>from previous stage</p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </StaggerItem>
                );
              })}
            </div>

            {funnel.recommendations.length > 0 && (
              <>
                <h3 style={{ marginTop: "32px", marginBottom: "12px", fontSize: "14px" }}>Suggested Improvements</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
                  {funnel.recommendations.map((rec, i) => (
                    <StaggerItem key={i}>
                      <Card>
                        <CardBody>
                          <p style={{ fontSize: "12px", color: "var(--ink)", margin: 0, lineHeight: 1.5 }}>{rec}</p>
                        </CardBody>
                      </Card>
                    </StaggerItem>
                  ))}
                </div>
              </>
            )}
          </StaggerContainer>
        ) : (
          <EmptyState icon={TrendingUp} title="No funnel data yet" description="Conversion stages appear once you have orders in the last 30 days." />
        )}
      </section>
    </PageTransition>
  );
}
