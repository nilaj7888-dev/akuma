"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3 } from "lucide-react";
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { MetricTile, MetricGrid } from "@/components/ui/metric-tile";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { formatMoney } from "@/lib/format";

type CLVCustomer = {
  customerId: string;
  customerName: string;
  segment: "VIP" | "LOYAL" | "ACTIVE" | "AT_RISK";
  estimatedLifetimeValue: number;
  retentionRisk: "LOW" | "MEDIUM" | "HIGH";
};
type CLVResponse = {
  summary: {
    totalCustomers: number;
    totalClv: number;
    averageClv: number;
    highValueCustomers: number;
    atRiskCustomers: number;
    segments: { vip: number; loyal: number; active: number; atRisk: number };
  };
  customers: CLVCustomer[];
};

const SEGMENT_LABEL: Record<CLVCustomer["segment"], string> = {
  VIP: "VIP",
  LOYAL: "Loyal",
  ACTIVE: "Active",
  AT_RISK: "At Risk",
};
const SEGMENT_COLOR: Record<CLVCustomer["segment"], string> = {
  VIP: "var(--amber)",
  LOYAL: "var(--green)",
  ACTIVE: "#3b82f6",
  AT_RISK: "#ef4444",
};

export default function CLVPage() {
  const [data, setData] = useState<CLVResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setError(false);
    try {
      const res = await fetch("/api/analytics/clv");
      if (!res.ok) throw new Error("request failed");
      const json = (await res.json()) as CLVResponse;
      if (json && json.summary) {
        setData(json);
      } else {
        throw new Error("Invalid data");
      }
    } catch {
      setData(null);
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const segments = data
    ? (["VIP", "LOYAL", "ACTIVE", "AT_RISK"] as const)
        .map((key) => {
          const members = data.customers.filter((c) => c.segment === key);
          const avgClv = members.length ? Math.round(members.reduce((sum, c) => sum + c.estimatedLifetimeValue, 0) / members.length) : 0;
          return { key, name: SEGMENT_LABEL[key], count: members.length, avgClv };
        })
        .filter((s) => s.count > 0)
    : [];
  const topSegmentClv = Math.max(1, ...segments.map((s) => s.avgClv));

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
            <p className="subhead">Estimated from each customer&apos;s real order history: average order value × purchase frequency.</p>
          </FadeIn>
        </div>

        {!loading && !error && data && data.summary.totalCustomers > 0 && (
          <MetricGrid columns={4}>
            <MetricTile label="Average CLV" value={formatMoney(data.summary.averageClv)} delta={`Across ${data.summary.totalCustomers} customers`} trend="neutral" />
            <MetricTile label="Total CLV" value={formatMoney(data.summary.totalClv)} delta="Sum across all customers" trend="neutral" />
            <MetricTile label="High Value" value={data.summary.highValueCustomers} delta="CLV over ₹1,00,000" trend="up" />
            <MetricTile label="At Risk" value={data.summary.atRiskCustomers} delta="High churn risk" trend="down" />
          </MetricGrid>
        )}

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : error ? (
          <EmptyState icon={AlertTriangle} title="Couldn't load CLV data" description="The request failed. Check your connection and try again." action={{ label: "Retry", onClick: load }} />
        ) : segments.length > 0 ? (
          <StaggerContainer delay={0.1}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
              {segments.map((segment) => (
                <StaggerItem key={segment.key}>
                  <Card gradient hover>
                    <CardBody>
                      <p style={{ fontSize: "10px", color: "var(--muted)", margin: "0 0 8px 0", fontWeight: 500 }}>{segment.name}</p>
                      <p style={{ margin: "0 0 4px 0", fontSize: "20px", fontWeight: 600, color: "var(--ink)" }}>{formatMoney(segment.avgClv)}</p>
                      <p style={{ margin: "0 0 12px 0", fontSize: "10px", color: "var(--muted)" }}>{segment.count.toLocaleString("en-IN")} customer{segment.count === 1 ? "" : "s"} · avg CLV</p>
                      <div style={{ height: "4px", background: "var(--line)", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ height: "100%", background: SEGMENT_COLOR[segment.key], width: `${(segment.avgClv / topSegmentClv) * 100}%` }} />
                      </div>
                    </CardBody>
                  </Card>
                </StaggerItem>
              ))}
            </div>
          </StaggerContainer>
        ) : (
          <EmptyState icon={BarChart3} title="No CLV data yet" description="Customer lifetime value appears once you have enough order history to analyze." />
        )}
      </section>
    </PageTransition>
  );
}
