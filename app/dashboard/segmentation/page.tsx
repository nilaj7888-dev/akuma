"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Users } from "lucide-react";
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { MetricTile, MetricGrid } from "@/components/ui/metric-tile";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { formatMoney } from "@/lib/format";

type Segment = "VIP" | "LOYAL" | "ACTIVE" | "INACTIVE" | "AT_RISK";
type SegmentSummary = {
  segment: Segment;
  count: number;
  totalValue: number;
  averageValue: number;
  revenueContribution: number;
  recommendedAction: string;
};

const SEGMENT_LABEL: Record<Segment, string> = {
  VIP: "VIP",
  LOYAL: "Loyal",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  AT_RISK: "At Risk",
};
const SEGMENT_BADGE: Record<Segment, "success" | "amber" | "info" | "warning" | "error"> = {
  VIP: "amber",
  LOYAL: "success",
  ACTIVE: "info",
  INACTIVE: "warning",
  AT_RISK: "error",
};
const SEGMENT_COLOR: Record<Segment, string> = {
  VIP: "#e9a85d",
  LOYAL: "#7bd4a3",
  ACTIVE: "#3b82f6",
  INACTIVE: "#f59e0b",
  AT_RISK: "#ef4444",
};

export default function SegmentationPage() {
  const [segments, setSegments] = useState<SegmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setError(false);
    try {
      const res = await fetch("/api/segmentation/summary");
      if (!res.ok) throw new Error("request failed");
      const data = (await res.json()) as SegmentSummary[];
      setSegments(Array.isArray(data) ? data : []);
    } catch {
      setSegments([]);
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const totalCustomers = segments.reduce((sum, s) => sum + s.count, 0);
  const totalValue = segments.reduce((sum, s) => sum + s.totalValue, 0);

  return (
    <PageTransition>
      <section className="content">
        <header className="topbar">
          <div className="crumb">
            <span>Dashboard</span>
            <span>/</span>
            <strong>Segmentation</strong>
          </div>
        </header>

        <div className="page-head">
          <FadeIn>
            <p className="eyebrow">CUSTOMER SEGMENTATION</p>
            <h1>Customer Segments</h1>
            <p className="subhead">Grouped by real lifetime value and order recency — not a demographic guess.</p>
          </FadeIn>
        </div>

        {!loading && !error && segments.length > 0 && (
          <MetricGrid columns={2}>
            <MetricTile label="Total Customers" value={totalCustomers} delta={`Across ${segments.length} segment${segments.length === 1 ? "" : "s"}`} trend="neutral" />
            <MetricTile label="Total Lifetime Value" value={formatMoney(totalValue)} delta="Across all segments" trend="neutral" />
          </MetricGrid>
        )}

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : error ? (
          <EmptyState icon={AlertTriangle} title="Couldn't load segmentation data" description="The request failed. Check your connection and try again." action={{ label: "Retry", onClick: load }} />
        ) : segments.length > 0 ? (
          <StaggerContainer delay={0.08}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
              {segments.map((segment) => {
                const percentage = totalCustomers > 0 ? ((segment.count / totalCustomers) * 100).toFixed(1) : "0";
                return (
                  <StaggerItem key={segment.segment}>
                    <Card gradient hover>
                      <CardHeader>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                          <h3 style={{ margin: 0, fontSize: "14px" }}>{SEGMENT_LABEL[segment.segment]}</h3>
                          <Badge variant={SEGMENT_BADGE[segment.segment]} size="sm">{percentage}%</Badge>
                        </div>
                      </CardHeader>
                      <CardBody>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          <div>
                            <p style={{ fontSize: "10px", color: "var(--muted)", margin: "0 0 4px 0" }}>Count</p>
                            <p style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "var(--ink)" }}>{segment.count.toLocaleString("en-IN")}</p>
                          </div>
                          <div>
                            <p style={{ fontSize: "10px", color: "var(--muted)", margin: "0 0 4px 0" }}>Avg Lifetime Value</p>
                            <p style={{ margin: 0, fontSize: "14px", color: SEGMENT_COLOR[segment.segment] }}>{formatMoney(segment.averageValue)}</p>
                          </div>
                          <div>
                            <p style={{ fontSize: "10px", color: "var(--muted)", margin: "0 0 4px 0" }}>Revenue Contribution</p>
                            <p style={{ margin: 0, fontSize: "14px", color: "var(--ink)" }}>{segment.revenueContribution}%</p>
                          </div>
                          <p style={{ fontSize: "11px", color: "var(--muted)", margin: "4px 0 0 0", lineHeight: 1.5 }}>{segment.recommendedAction}</p>
                        </div>
                      </CardBody>
                    </Card>
                  </StaggerItem>
                );
              })}
            </div>
          </StaggerContainer>
        ) : (
          <EmptyState icon={Users} title="No segmentation data yet" description="Segments appear once you have enough order history to analyze." />
        )}
      </section>
    </PageTransition>
  );
}
