"use client";

import { useEffect, useState } from "react";
import { AlertCircle, TrendingDown, Users } from "lucide-react";
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { MetricTile, MetricGrid } from "@/components/ui/metric-tile";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/format";

type ChurnAnalysis = { atRiskCustomers: number; churnRate: string; averageDaysSinceLastOrder: number; potentialRevenueLoss: number; topChurnReasons: Array<{ reason: string; percentage: number }> };
type Customer = { id: string; name: string; email: string; totalOrders: number; totalSpent: number; lastOrderDate: string; segment: string; clv: number; churnProbability: number };

export default function ChurnPage() {
  const [analysis, setAnalysis] = useState<ChurnAnalysis | null>(null);
  const [atRiskCustomers, setAtRiskCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const analysisRes = await fetch("/api/churn/analysis");
        const analysisData = await analysisRes.json() as ChurnAnalysis;
        setAnalysis(analysisData);

        const customersRes = await fetch("/api/churn/customers");
        const customersData = await customersRes.json() as Customer[];
        if (Array.isArray(customersData)) {
          setAtRiskCustomers(customersData.filter((c) => c.churnProbability > 70));
        } else {
          throw new Error("Invalid data");
        }
      } catch {
        setAnalysis(null);
        setAtRiskCustomers([]);
      }
      setLoading(false);
    };
    void loadData();
  }, []);

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
            <p className="subhead">Identify and re-engage customers showing churn signals before they leave.</p>
          </FadeIn>
          <Button icon={<AlertCircle size={16} />}>Create recovery campaign</Button>
        </div>

        {analysis && (
          <MetricGrid columns={4}>
            <MetricTile label="At-Risk Customers" value={analysis.atRiskCustomers} delta={`${(parseFloat(analysis.churnRate) * 100).toFixed(1)}% churn rate`} trend="down" />
            <MetricTile label="Avg Days Inactive" value={analysis.averageDaysSinceLastOrder} delta="Days since last purchase" trend="down" />
            <MetricTile label="Potential Revenue Loss" value={formatMoney(analysis.potentialRevenueLoss)} delta="If no action taken" trend="down" />
            <MetricTile label="Recovery Potential" value={formatMoney(Math.round(analysis.potentialRevenueLoss * 0.6))} delta="With targeted campaigns" trend="up" />
          </MetricGrid>
        )}

        {analysis && (
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ marginBottom: "12px" }}>Top Churn Reasons</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
              {analysis.topChurnReasons.map((item, i) => (
                <Card key={i}>
                  <CardBody>
                    <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 8px 0" }}>{item.reason}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ flex: 1, height: "4px", background: "var(--line)", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ height: "100%", background: "var(--amber)", width: `${item.percentage}%` }} />
                      </div>
                      <span style={{ fontSize: "13px", color: "var(--amber)", fontWeight: "600" }}>{item.percentage}%</span>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ color: "var(--muted)" }}>Loading churn data...</p>
          </div>
        ) : atRiskCustomers.length > 0 ? (
          <StaggerContainer delay={0.06}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line)" }}>
                    <th style={{ textAlign: "left", padding: "12px", color: "var(--muted)", fontWeight: "500" }}>Customer</th>
                    <th style={{ textAlign: "left", padding: "12px", color: "var(--muted)", fontWeight: "500" }}>Last Order</th>
                    <th style={{ textAlign: "left", padding: "12px", color: "var(--muted)", fontWeight: "500" }}>Total Spent</th>
                    <th style={{ textAlign: "left", padding: "12px", color: "var(--muted)", fontWeight: "500" }}>Churn Risk</th>
                    <th style={{ textAlign: "left", padding: "12px", color: "var(--muted)", fontWeight: "500" }}>CLV</th>
                    <th style={{ textAlign: "left", padding: "12px" }} />
                  </tr>
                </thead>
                <tbody>
                  {atRiskCustomers.map((customer, index) => (
                    <tr
                      key={customer.id}
                      style={{ borderBottom: "1px solid var(--line)" }}
                      className="stagger-item"
                      data-index={index}
                    >
                      <td style={{ padding: "12px" }}>
                        <div>
                          <p style={{ margin: 0, color: "var(--ink)" }}>{customer.name}</p>
                          <p style={{ margin: 0, fontSize: "10px", color: "var(--muted)" }}>{customer.email}</p>
                        </div>
                      </td>
                      <td style={{ padding: "12px", color: "var(--muted)" }}>
                        {new Date(customer.lastOrderDate).toLocaleDateString("en-IN")}
                      </td>
                      <td style={{ padding: "12px", color: "var(--ink)" }}>{formatMoney(customer.totalSpent)}</td>
                      <td style={{ padding: "12px" }}>
                        <Badge variant={customer.churnProbability > 80 ? "error" : "warning"} size="sm">
                          {customer.churnProbability}%
                        </Badge>
                      </td>
                      <td style={{ padding: "12px", color: "var(--green)" }}>{formatMoney(customer.clv)}</td>
                      <td style={{ padding: "12px" }}>
                        <Button variant="primary" size="sm">
                          Re-engage
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </StaggerContainer>
        ) : (
          <EmptyState icon={Users} title="No at-risk customers detected" description="Your customer base looks healthy!" />
        )}
      </section>
    </PageTransition>
  );
}
