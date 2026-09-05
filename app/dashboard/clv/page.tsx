"use client";

import { useEffect, useState } from "react";
import { BarChart3, TrendingUp } from "lucide-react";
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { MetricTile, MetricGrid } from "@/components/ui/metric-tile";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/mock-data";

type Segment = { name: string; count: number; clv: number };
type CLVAnalysis = { averageCLV: number; topSegmentCLV: number; clvGrowth: number; segments: Segment[] };

export default function CLVPage() {
  const [analysis, setAnalysis] = useState<CLVAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnalysis = async () => {
      try {
        const res = await fetch("/api/analytics/clv");
        const data = await res.json() as CLVAnalysis;
        if (data && data.segments) {
          setAnalysis(data);
        } else {
          throw new Error("Invalid data");
        }
      } catch {
        setAnalysis(null);
      }
      setLoading(false);
    };
    void loadAnalysis();
  }, []);

  return (
    <PageTransition>
      <section className="content">
        <header className="topbar">
          <div className="crumb">
            <span>Dashboard</span>
            <span>/</span>
            <strong>CLV</strong>
          </div>
        </header>

        <div className="page-head">
          <FadeIn>
            <p className="eyebrow">CUSTOMER LIFETIME VALUE</p>
            <h1>CLV Analysis</h1>
            <p className="subhead">Understand customer value and identify high-potential segments for growth.</p>
          </FadeIn>
          <Button icon={<BarChart3 size={16} />}>Export analysis</Button>
        </div>

        {analysis && (
          <MetricGrid columns={4}>
            <MetricTile label="Average CLV" value={formatMoney(analysis.averageCLV)} delta="All customers" trend="up" />
            <MetricTile label="Top Segment CLV" value={formatMoney(analysis.topSegmentCLV)} delta="Champions" trend="up" />
            <MetricTile label="CLV Growth" value={`${analysis.clvGrowth}%`} delta="YoY growth" trend="up" />
            <MetricTile label="Total LTV" value={formatMoney(analysis.averageCLV * 250)} delta="Estimated from base" trend="up" />
          </MetricGrid>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ color: "var(--muted)" }}>Loading CLV data...</p>
          </div>
        ) : analysis ? (
          <StaggerContainer delay={0.1}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
              {analysis.segments.map((segment, i) => {
                const colors = ["var(--amber)", "var(--green)", "#f59e0b", "#ef4444"];
                return (
                  <StaggerItem key={i}>
                    <Card gradient hover>
                      <CardBody>
                        <p style={{ fontSize: "10px", color: "var(--muted)", margin: "0 0 8px 0", fontWeight: "500" }}>{segment.name}</p>
                        <p style={{ margin: "0 0 4px 0", fontSize: "20px", fontWeight: "600", color: "var(--ink)" }}>
                          {formatMoney(segment.clv)}
                        </p>
                        <p style={{ margin: "0 0 12px 0", fontSize: "10px", color: "var(--muted)" }}>
                          {segment.count.toLocaleString()} customers
                        </p>
                        <div
                          style={{
                            height: "4px",
                            background: "var(--line)",
                            borderRadius: "2px",
                            overflow: "hidden",
                            marginBottom: "12px",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              background: colors[i],
                              width: `${(segment.clv / analysis.topSegmentCLV) * 100}%`,
                            }}
                          />
                        </div>
                        <Button variant="primary" size="sm" style={{ width: "100%" }}>
                          Target
                        </Button>
                      </CardBody>
                    </Card>
                  </StaggerItem>
                );
              })}
            </div>
          </StaggerContainer>
        ) : (
          <EmptyState icon={BarChart3} title="No CLV data yet" description="Customer lifetime value appears once you have enough order history to analyze." />
        )}
      </section>
    </PageTransition>
  );
}
