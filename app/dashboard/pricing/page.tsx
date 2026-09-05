"use client";

import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, TrendingUp } from "lucide-react";
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { MetricTile, MetricGrid } from "@/components/ui/metric-tile";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/mock-data";

type PricingOpportunity = { product: string; currentPrice: number; suggestedPrice: number; competitorAvg: number; potentialRevenue: number };

export default function PricingPage() {
  const [analysis, setAnalysis] = useState<{ underpriced: number; overpriced: number; competitive: number; opportunities: PricingOpportunity[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnalysis = async () => {
      try {
        const res = await fetch("/api/pricing/analysis");
        const data = await res.json();
        if (data && typeof data === "object") {
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
            <strong>Pricing</strong>
          </div>
        </header>

        <div className="page-head">
          <FadeIn>
            <p className="eyebrow">PRICING INTELLIGENCE</p>
            <h1>Pricing Analysis</h1>
            <p className="subhead">AI-powered pricing recommendations to optimize revenue and competitiveness.</p>
          </FadeIn>
          <Button icon={<TrendingUp size={16} />}>Run analysis</Button>
        </div>

        {analysis && (
          <MetricGrid columns={4}>
            <MetricTile label="Underpriced" value={analysis.underpriced} delta="Increase margin" trend="down" />
            <MetricTile label="Overpriced" value={analysis.overpriced} delta="May lose sales" trend="down" />
            <MetricTile label="Competitive" value={analysis.competitive} delta="Well positioned" trend="up" />
            <MetricTile label="Revenue Opportunity" value={formatMoney(50000 + Math.random() * 100000)} delta="Potential from optimizing" trend="up" />
          </MetricGrid>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ color: "var(--muted)" }}>Loading pricing analysis...</p>
          </div>
        ) : analysis && analysis.opportunities.length > 0 ? (
          <StaggerContainer delay={0.08}>
            <div style={{ display: "grid", gap: "12px" }}>
              {analysis.opportunities.map((opp, i) => (
                <StaggerItem key={i}>
                  <Card hover>
                    <CardBody style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "24px" }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: "0 0 8px 0", fontSize: "14px" }}>{opp.product}</h3>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", fontSize: "11px" }}>
                          <div>
                            <p style={{ color: "var(--muted)", margin: "0 0 4px 0" }}>Current</p>
                            <p style={{ margin: 0, color: "var(--ink)", fontSize: "12px" }}>{formatMoney(opp.currentPrice)}</p>
                          </div>
                          <div>
                            <p style={{ color: "var(--muted)", margin: "0 0 4px 0" }}>Suggested</p>
                            <p style={{ margin: 0, color: "var(--amber)", fontSize: "12px" }}>{formatMoney(opp.suggestedPrice)}</p>
                          </div>
                          <div>
                            <p style={{ color: "var(--muted)", margin: "0 0 4px 0" }}>Competitor Avg</p>
                            <p style={{ margin: 0, color: "var(--muted)", fontSize: "12px" }}>{formatMoney(opp.competitorAvg)}</p>
                          </div>
                          <div>
                            <p style={{ color: "var(--muted)", margin: "0 0 4px 0" }}>Revenue Potential</p>
                            <p style={{ margin: 0, color: "var(--green)", fontSize: "12px" }}>{formatMoney(opp.potentialRevenue)}</p>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <Badge variant={opp.suggestedPrice > opp.currentPrice ? "success" : "warning"} size="sm">
                          {opp.suggestedPrice > opp.currentPrice ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                          {Math.abs(((opp.suggestedPrice - opp.currentPrice) / opp.currentPrice) * 100).toFixed(1)}%
                        </Badge>
                        <Button variant="primary" size="sm">
                          Apply
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                </StaggerItem>
              ))}
            </div>
          </StaggerContainer>
        ) : (
          <EmptyState icon={TrendingUp} title="No pricing opportunities yet" description="Run an analysis to get pricing recommendations" />
        )}
      </section>
    </PageTransition>
  );
}
