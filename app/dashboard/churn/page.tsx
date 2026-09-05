"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Users } from "lucide-react";
import { PageTransition, FadeIn, StaggerContainer } from "@/components/ui/animations";
import { MetricTile, MetricGrid } from "@/components/ui/metric-tile";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { formatMoney } from "@/lib/format";
import { showToast } from "@/components/toast";

type ChurnAnalysis = { atRiskCustomers: number; churnRate: string; averageDaysSinceLastOrder: number; potentialRevenueLoss: number; topChurnReasons: Array<{ reason: string; percentage: number }> };
type ChurnRiskCustomer = {
  id: string;
  name: string;
  email: string | null;
  lifetimeValue: number;
  lastOrderDate: string;
  daysSinceLastOrder: number;
  orderCount: number;
  averageOrderValue: number;
  riskScore: number;
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM";
  recommendedAction: string;
};

const RISK_VARIANT: Record<ChurnRiskCustomer["riskLevel"], "error" | "warning" | "info"> = {
  CRITICAL: "error",
  HIGH: "warning",
  MEDIUM: "info",
};

export default function ChurnPage() {
  const [analysis, setAnalysis] = useState<ChurnAnalysis | null>(null);
  const [atRiskCustomers, setAtRiskCustomers] = useState<ChurnRiskCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [engagingId, setEngagingId] = useState<string | null>(null);

  const load = async () => {
    setError(false);
    try {
      const [analysisRes, customersRes] = await Promise.all([fetch("/api/churn/analysis"), fetch("/api/churn/customers")]);
      if (!analysisRes.ok || !customersRes.ok) throw new Error("request failed");
      setAnalysis((await analysisRes.json()) as ChurnAnalysis);
      const customersData = (await customersRes.json()) as ChurnRiskCustomer[];
      setAtRiskCustomers(Array.isArray(customersData) ? customersData : []);
    } catch {
      setAnalysis(null);
      setAtRiskCustomers([]);
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const reengage = async (customer: ChurnRiskCustomer) => {
    setEngagingId(customer.id);
    try {
      const campaignType = customer.riskLevel === "CRITICAL" ? "DISCOUNT" : customer.riskLevel === "HIGH" ? "PRODUCT_REC" : "REMINDER";
      const res = await fetch("/api/churn/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerIds: [customer.id],
          campaignType,
          discountPercent: campaignType === "DISCOUNT" ? 15 : undefined,
        }),
      });
      if (res.ok) {
        showToast(`Draft win-back campaign created for ${customer.name}.`, "success");
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Couldn't create a campaign for this customer.", "error");
      }
    } catch {
      showToast("Couldn't create a campaign. Check your connection.", "error");
    }
    setEngagingId(null);
  };

  return (
    <PageTransition>
      <section className="content">
        <header className="topbar">
          <div className="crumb">
            <span>Dashboard</span>
            <span>/</span>
            <strong>Churn</strong>
          </div>
        </header>

        <div className="page-head">
          <FadeIn>
            <p className="eyebrow">CHURN PREVENTION</p>
            <h1>At-Risk Customers</h1>
            <p className="subhead">High-value customers who bought before but have gone quiet — ranked by revenue at risk.</p>
          </FadeIn>
        </div>

        {!loading && !error && analysis && (
          <MetricGrid columns={3}>
            <MetricTile label="At-Risk Customers" value={analysis.atRiskCustomers} delta={`${(parseFloat(analysis.churnRate) * 100).toFixed(1)}% of customer base churned in 30-60d`} trend="down" />
            <MetricTile label="Avg Days Inactive" value={analysis.averageDaysSinceLastOrder} delta="Days since last purchase" trend="down" />
            <MetricTile label="Revenue At Risk" value={formatMoney(analysis.potentialRevenueLoss)} delta="Lifetime value of at-risk customers" trend="down" />
          </MetricGrid>
        )}

        {!loading && !error && analysis && analysis.topChurnReasons.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ marginBottom: "12px", fontSize: "14px" }}>Top Churn Reasons</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
              {analysis.topChurnReasons.map((item, i) => (
                <Card key={i}>
                  <CardBody>
                    <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 8px 0" }}>{item.reason}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ flex: 1, height: "4px", background: "var(--line)", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ height: "100%", background: "var(--amber)", width: `${item.percentage}%` }} />
                      </div>
                      <span style={{ fontSize: "13px", color: "var(--amber)", fontWeight: 600 }}>{item.percentage}%</span>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ display: "grid", gap: "12px" }}>
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : error ? (
          <EmptyState icon={AlertTriangle} title="Couldn't load churn data" description="The request failed. Check your connection and try again." action={{ label: "Retry", onClick: load }} />
        ) : atRiskCustomers.length > 0 ? (
          <StaggerContainer delay={0.06}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line)" }}>
                    <th style={{ textAlign: "left", padding: "12px", color: "var(--muted)", fontWeight: 500 }}>Customer</th>
                    <th style={{ textAlign: "left", padding: "12px", color: "var(--muted)", fontWeight: 500 }}>Last Order</th>
                    <th style={{ textAlign: "left", padding: "12px", color: "var(--muted)", fontWeight: 500 }}>Lifetime Value</th>
                    <th style={{ textAlign: "left", padding: "12px", color: "var(--muted)", fontWeight: 500 }}>Risk</th>
                    <th style={{ textAlign: "left", padding: "12px", color: "var(--muted)", fontWeight: 500 }}>Recommended Action</th>
                    <th style={{ textAlign: "left", padding: "12px" }} />
                  </tr>
                </thead>
                <tbody>
                  {atRiskCustomers.map((customer) => (
                    <tr key={customer.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "12px" }}>
                        <div>
                          <p style={{ margin: 0, color: "var(--ink)" }}>{customer.name}</p>
                          <p style={{ margin: 0, fontSize: "10px", color: "var(--muted)" }}>{customer.email ?? "No email on file"}</p>
                        </div>
                      </td>
                      <td style={{ padding: "12px", color: "var(--muted)" }}>
                        {new Date(customer.lastOrderDate).toLocaleDateString("en-IN")} · {customer.daysSinceLastOrder}d ago
                      </td>
                      <td style={{ padding: "12px", color: "var(--green)" }}>{formatMoney(customer.lifetimeValue)}</td>
                      <td style={{ padding: "12px" }}>
                        <Badge variant={RISK_VARIANT[customer.riskLevel]} size="sm">{customer.riskLevel} · {customer.riskScore}</Badge>
                      </td>
                      <td style={{ padding: "12px", color: "var(--muted)", maxWidth: "220px" }}>{customer.recommendedAction}</td>
                      <td style={{ padding: "12px" }}>
                        <Button variant="primary" size="sm" disabled={engagingId === customer.id} onClick={() => reengage(customer)}>
                          {engagingId === customer.id ? "Creating..." : "Re-engage"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </StaggerContainer>
        ) : (
          <EmptyState icon={Users} title="No at-risk customers detected" description="Your high-value customers are all still ordering regularly." />
        )}
      </section>
    </PageTransition>
  );
}
