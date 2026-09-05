"use client";

import { useEffect, useState } from "react";
import { Users, TrendingUp, Zap } from "lucide-react";
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { MetricTile, MetricGrid } from "@/components/ui/metric-tile";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/mock-data";

type Segment = { name: string; count: number; avgSpend: number; color: "amber" | "green" | "warning" | "error" };
type SegmentationData = { segments: Segment[]; recency: number; frequency: number; monetary: number };

export default function SegmentationPage() {
  const [data, setData] = useState<SegmentationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch("/api/segmentation/summary");
        const segData = await res.json() as SegmentationData;
        if (segData && segData.segments) {
          setData(segData);
        } else {
          throw new Error("Invalid data");
        }
      } catch {
        setData(null);
      }
      setLoading(false);
    };
    void loadData();
  }, []);

  const colorMap: Record<string, string> = {
    amber: "#e9a85d",
    green: "#7bd4a3",
    warning: "#f59e0b",
    error: "#ef4444",
  };

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
            <h1>RFM Analysis</h1>
            <p className="subhead">Segment customers by Recency, Frequency, and Monetary value to drive targeted campaigns.</p>
          </FadeIn>
          <Button icon={<Zap size={16} />}>Export segments</Button>
        </div>

        {data && (
          <>
            <MetricGrid columns={4}>
              <MetricTile label="Total Customers" value={data.segments.reduce((sum, s) => sum + s.count, 0)} delta={`${data.segments.length} segments`} trend="up" />
              <MetricTile label="Avg Recency" value={`${data.recency} days`} delta="Since last purchase" trend="neutral" />
              <MetricTile label="Avg Frequency" value={`${data.frequency} orders`} delta="Per customer" trend="up" />
              <MetricTile label="Avg Monetary" value={formatMoney(data.monetary)} delta="Per customer lifetime" trend="up" />
            </MetricGrid>

            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ marginBottom: "12px" }}>Customer Segments</h3>
              <StaggerContainer delay={0.08}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
                  {data.segments.map((segment, i) => {
                    const totalCustomers = data.segments.reduce((sum, s) => sum + s.count, 0);
                    const percentage = ((segment.count / totalCustomers) * 100).toFixed(1);

                    return (
                      <StaggerItem key={i}>
                        <Card gradient hover>
                          <CardHeader>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                              <h3 style={{ margin: 0, fontSize: "14px" }}>{segment.name}</h3>
                              <Badge variant={segment.color} size="sm">
                                {percentage}%
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardBody>
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                              <div>
                                <p style={{ fontSize: "10px", color: "var(--muted)", margin: "0 0 4px 0" }}>Count</p>
                                <p style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "var(--ink)" }}>
                                  {segment.count.toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <p style={{ fontSize: "10px", color: "var(--muted)", margin: "0 0 4px 0" }}>Avg Spend</p>
                                <p style={{ margin: 0, fontSize: "14px", color: colorMap[segment.color] }}>
                                  {formatMoney(segment.avgSpend)}
                                </p>
                              </div>
                              <Button variant="primary" size="sm" style={{ marginTop: "8px" }}>
                                Target
                              </Button>
                            </div>
                          </CardBody>
                        </Card>
                      </StaggerItem>
                    );
                  })}
                </div>
              </StaggerContainer>
            </div>
          </>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ color: "var(--muted)" }}>Loading segmentation data...</p>
          </div>
        )}

        {!loading && !data && (
          <EmptyState icon={Users} title="No segmentation data yet" description="Segments appear once you have enough order history to analyze." />
        )}
      </section>
    </PageTransition>
  );
}
