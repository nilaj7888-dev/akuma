"use client";

import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, TrendingUp, RefreshCw } from "lucide-react";
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { MetricTile, MetricGrid } from "@/components/ui/metric-tile";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { formatMoney } from "@/lib/format";

type PricingOpportunity = {
  productId: string;
  product: string;
  currentPrice: number;
  suggestedPrice: number;
  competitorAvg: number | null;
  potentialRevenue: number;
};
type Analysis = { underpriced: number; overpriced: number; competitive: number; opportunities: PricingOpportunity[] };

export default function PricingPage() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const loadAnalysis = async () => {
    setError(false);
    try {
      const res = await fetch("/api/pricing/analysis");
      if (!res.ok) throw new Error("request failed");
      const data = (await res.json()) as Analysis;
      setAnalysis(data);
    } catch {
      setAnalysis(null);
      setError(true);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    void loadAnalysis();
  }, []);

  const runAnalysis = () => {
    setRefreshing(true);
    void loadAnalysis();
  };

  const applyPrice = async (opp: PricingOpportunity) => {
    setApplyingId(opp.productId);
    try {
      const res = await fetch("/api/pricing/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: opp.productId, newPrice: opp.suggestedPrice }),
      });
      if (res.ok) {
        setAppliedIds((prev) => new Set(prev).add(opp.productId));
      }
    } catch {
      // Leave the card in its pending state; the button re-enables for retry.
    }
    setApplyingId(null);
  };

  const revenueOpportunity = analysis ? analysis.opportunities.reduce((sum, o) => sum + o.potentialRevenue, 0) : null;

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
            <p className="subhead">Recommendations computed from your last 30 days of sales, margin, and stock — not competitor guesswork.</p>
          </FadeIn>
          <Button icon={<RefreshCw size={16} />} onClick={runAnalysis} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh analysis"}
          </Button>
        </div>

        {loading ? (
          <div style={{ display: "grid", gap: "12px" }}>
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : error ? (
          <EmptyState icon={TrendingUp} title="Couldn't load pricing analysis" description="The request failed. Check your connection and try again." action={{ label: "Retry", onClick: runAnalysis }} />
        ) : analysis && analysis.opportunities.length > 0 ? (
          <>
            <MetricGrid columns={4}>
              <MetricTile label="Underpriced" value={analysis.underpriced} delta="Below recommended margin" trend="down" />
              <MetricTile label="Overpriced" value={analysis.overpriced} delta="Above recommended margin" trend="down" />
              <MetricTile label="Competitive" value={analysis.competitive} delta="Within target range" trend="up" />
              <MetricTile label="Revenue Opportunity" value={formatMoney(revenueOpportunity)} delta={`Across ${analysis.opportunities.length} product${analysis.opportunities.length === 1 ? "" : "s"}`} trend="up" />
            </MetricGrid>

            <StaggerContainer delay={0.08}>
              <div style={{ display: "grid", gap: "12px" }}>
                {analysis.opportunities.map((opp) => {
                  const applied = appliedIds.has(opp.productId);
                  return (
                    <StaggerItem key={opp.productId}>
                      <Card hover>
                        <CardBody style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
                          <div style={{ flex: 1, minWidth: "240px" }}>
                            <h3 style={{ margin: "0 0 8px 0", fontSize: "14px" }}>{opp.product}</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "16px", fontSize: "11px" }}>
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
                                <p style={{ margin: 0, color: "var(--muted)", fontSize: "12px" }}>{opp.competitorAvg == null ? "No data yet" : formatMoney(opp.competitorAvg)}</p>
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
                            <Button variant="primary" size="sm" onClick={() => applyPrice(opp)} disabled={applied || applyingId === opp.productId}>
                              {applied ? "Applied" : applyingId === opp.productId ? "Applying..." : "Apply"}
                            </Button>
                          </div>
                        </CardBody>
                      </Card>
                    </StaggerItem>
                  );
                })}
              </div>
            </StaggerContainer>
          </>
        ) : (
          <EmptyState icon={TrendingUp} title="No pricing opportunities right now" description="Every active product is within its recommended margin range, or there isn't enough sales history yet to recommend a change." />
        )}
      </section>
    </PageTransition>
  );
}
