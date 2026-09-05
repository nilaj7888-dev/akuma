"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Filter, Sparkles, TrendingUp } from "lucide-react";
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { MetricTile, MetricGrid } from "@/components/ui/metric-tile";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/mock-data";

type Opportunity = { id: string; title: string; description: string; type: string; confidence: number; expectedRevenue: number; expectedLift: number; riskScore: number; marginImpact: number; status: string; evidence: Record<string, unknown>; recommendedAction: string };

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [filteredOpp, setFilteredOpp] = useState<Opportunity[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOpportunities = async () => {
      try {
        const res = await fetch("/api/dashboard/opportunities");
        const data = await res.json() as Opportunity[];
        if (Array.isArray(data)) {
          setOpportunities(data);
          setFilteredOpp(data);
        } else {
          throw new Error("Invalid data");
        }
      } catch {
        setOpportunities([]);
        setFilteredOpp([]);
      }
      setLoading(false);
    };
    void loadOpportunities();
  }, []);

  const handleFilterChange = (type: string | null) => {
    setSelectedType(type);
    if (!type) {
      setFilteredOpp(opportunities);
    } else {
      setFilteredOpp(opportunities.filter((o) => o.type === type));
    }
  };

  const stats = {
    total: opportunities.length,
    pending: opportunities.filter((o) => o.status === "PENDING").length,
    revenue: opportunities.reduce((sum, o) => sum + o.expectedRevenue, 0),
    avgConfidence: Math.round(opportunities.reduce((sum, o) => sum + o.confidence, 0) / opportunities.length),
  };

  return (
    <PageTransition>
      <section className="content">
        <header className="topbar">
          <div className="crumb">
            <span>Dashboard</span>
            <span>/</span>
            <strong>Opportunities</strong>
          </div>
        </header>

        <div className="page-head">
          <FadeIn>
            <p className="eyebrow">OPPORTUNITY BROWSER</p>
            <h1>Revenue Opportunities</h1>
            <p className="subhead">AI-identified chances to increase revenue, reduce churn, and optimize operations.</p>
          </FadeIn>
          <Button icon={<Sparkles size={16} />}>Refresh opportunities</Button>
        </div>

        <MetricGrid columns={4}>
          <MetricTile label="Total Opportunities" value={stats.total} delta={`${stats.pending} pending`} trend="up" />
          <MetricTile label="Potential Revenue" value={formatMoney(stats.revenue)} delta="+15% vs last week" trend="up" />
          <MetricTile label="Avg Confidence" value={`${stats.avgConfidence}%`} delta="High quality" trend="neutral" />
          <MetricTile label="Approval Rate" value="87%" delta="+5% vs month ago" trend="up" />
        </MetricGrid>

        <div className="section-heading">
          <div>
            <p className="eyebrow">FILTER & BROWSE</p>
            <h2>Opportunities by type</h2>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
          <Button variant={selectedType === null ? "primary" : "secondary"} size="sm" onClick={() => handleFilterChange(null)}>
            All ({opportunities.length})
          </Button>
          <Button variant={selectedType === "CROSS_SELL" ? "primary" : "secondary"} size="sm" onClick={() => handleFilterChange("CROSS_SELL")}>
            Cross-Sell ({opportunities.filter((o) => o.type === "CROSS_SELL").length})
          </Button>
          <Button variant={selectedType === "REACTIVATION" ? "primary" : "secondary"} size="sm" onClick={() => handleFilterChange("REACTIVATION")}>
            Reactivation ({opportunities.filter((o) => o.type === "REACTIVATION").length})
          </Button>
          <Button variant={selectedType === "REVENUE_LEAK" ? "primary" : "secondary"} size="sm" onClick={() => handleFilterChange("REVENUE_LEAK")}>
            Revenue Leak ({opportunities.filter((o) => o.type === "REVENUE_LEAK").length})
          </Button>
          <Button variant={selectedType === "PRICE_OPTIMIZATION" ? "primary" : "secondary"} size="sm" onClick={() => handleFilterChange("PRICE_OPTIMIZATION")}>
            Pricing ({opportunities.filter((o) => o.type === "PRICE_OPTIMIZATION").length})
          </Button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ color: "var(--muted)" }}>Loading opportunities...</p>
          </div>
        ) : filteredOpp.length > 0 ? (
          <StaggerContainer delay={0.08}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
              {filteredOpp.map((opp) => (
                <StaggerItem key={opp.id}>
                  <Card gradient hover>
                    <CardHeader>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "8px" }}>
                        <div>
                          <p style={{ fontSize: "10px", color: "var(--amber)", fontWeight: "500", marginBottom: "4px" }}>
                            {opp.type.replace(/_/g, " ")}
                          </p>
                          <h3 style={{ fontSize: "16px", margin: 0 }}>{opp.title}</h3>
                        </div>
                        <Badge variant={opp.confidence > 80 ? "success" : opp.confidence > 60 ? "warning" : "info"} size="sm">
                          {opp.confidence}%
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardBody>
                      <p style={{ fontSize: "11px", color: "var(--muted)", lineHeight: "1.5", marginBottom: "12px" }}>{opp.description}</p>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "10px", marginBottom: "12px" }}>
                        <div>
                          <p style={{ color: "var(--muted)", margin: "0 0 4px 0" }}>Revenue Impact</p>
                          <p style={{ margin: 0, fontSize: "13px", color: "var(--green)" }}>{formatMoney(opp.expectedRevenue)}</p>
                        </div>
                        <div>
                          <p style={{ color: "var(--muted)", margin: "0 0 4px 0" }}>Lift</p>
                          <p style={{ margin: 0, fontSize: "13px", color: "var(--amber)" }}>+{opp.expectedLift}%</p>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        <Button variant="primary" size="sm" style={{ flex: 1 }}>
                          Review
                        </Button>
                        <Button variant="ghost" size="sm">
                          <ArrowRight size={14} />
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                </StaggerItem>
              ))}
            </div>
          </StaggerContainer>
        ) : (
          <EmptyState icon={Sparkles} title="No opportunities found" description="Try adjusting your filters or run a new analysis" action={{ label: "Run analysis", onClick: () => handleFilterChange(null) }} />
        )}
      </section>
    </PageTransition>
  );
}
