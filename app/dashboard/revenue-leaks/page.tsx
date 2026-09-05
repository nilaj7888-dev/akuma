"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, TrendingDown } from "lucide-react";
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { MetricTile, MetricGrid } from "@/components/ui/metric-tile";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/mock-data";

type RevenueLeak = { id: string; title: string; description: string; impact: number; priority: "HIGH" | "MEDIUM" | "LOW"; status: string };

const mockLeaks: RevenueLeak[] = [
  {
    id: "1",
    title: "Abandoned carts not recovered",
    description: "₹125k monthly revenue from carts abandoned without follow-up",
    impact: 125000,
    priority: "HIGH",
    status: "OPEN",
  },
  {
    id: "2",
    title: "Pricing errors on bulk orders",
    description: "Manual discount approvals causing revenue loss of ₹45k/month",
    impact: 45000,
    priority: "HIGH",
    status: "OPEN",
  },
  {
    id: "3",
    title: "Failed payment recovery",
    description: "Customers with failed transactions not retried automatically",
    impact: 32000,
    priority: "MEDIUM",
    status: "OPEN",
  },
  {
    id: "4",
    title: "Excess inventory clearance",
    description: "₹85k in slow-moving stock needs aggressive discounting",
    impact: 85000,
    priority: "MEDIUM",
    status: "IN_PROGRESS",
  },
];

export default function RevenueLeaksPage() {
  const [leaks, setLeaks] = useState<RevenueLeak[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLeaks = async () => {
      try {
        const res = await fetch("/api/revenue-leaks/leaks");
        const data = await res.json() as RevenueLeak[];
        if (Array.isArray(data)) {
          setLeaks(data);
        } else {
          throw new Error("Invalid data");
        }
      } catch {
        setLeaks(mockLeaks);
      }
      setLoading(false);
    };
    void loadLeaks();
  }, []);

  const totalImpact = leaks.reduce((sum, leak) => sum + leak.impact, 0);
  const openLeaks = leaks.filter((l) => l.status === "OPEN").length;
  const priorityColors: Record<string, any> = {
    HIGH: "error",
    MEDIUM: "warning",
    LOW: "info",
  };

  return (
    <PageTransition>
      <section className="content">
        <header className="topbar">
          <div className="crumb">
            <span>Dashboard</span>
            <span>/</span>
            <strong>Revenue Leaks</strong>
          </div>
        </header>

        <div className="page-head">
          <FadeIn>
            <p className="eyebrow">REVENUE RECOVERY</p>
            <h1>Revenue Leaks</h1>
            <p className="subhead">Identify and fix operational issues causing lost revenue.</p>
          </FadeIn>
          <Button icon={<TrendingDown size={16} />}>Create recovery plan</Button>
        </div>

        <MetricGrid columns={4}>
          <MetricTile label="Total Identified" value={formatMoney(totalImpact)} delta={`${leaks.length} leaks`} trend="down" />
          <MetricTile label="Open Issues" value={openLeaks} delta="Requires action" trend="down" />
          <MetricTile label="Avg Impact" value={formatMoney(Math.round(totalImpact / Math.max(leaks.length, 1)))} delta="Per leak" trend="down" />
          <MetricTile label="Recovery Rate" value="68%" delta="If all fixed" trend="up" />
        </MetricGrid>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ color: "var(--muted)" }}>Loading revenue leaks...</p>
          </div>
        ) : leaks.length > 0 ? (
          <StaggerContainer delay={0.08}>
            <div style={{ display: "grid", gap: "12px" }}>
              {leaks.map((leak) => (
                <StaggerItem key={leak.id}>
                  <Card hover>
                    <CardBody style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                          <AlertTriangle size={16} style={{ color: "#ef4444" }} />
                          <h3 style={{ margin: 0, fontSize: "14px" }}>{leak.title}</h3>
                          <Badge variant={priorityColors[leak.priority]} size="sm">
                            {leak.priority}
                          </Badge>
                        </div>
                        <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 8px 0" }}>{leak.description}</p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "24px", marginLeft: "16px" }}>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontSize: "10px", color: "var(--muted)", margin: "0 0 4px 0" }}>Monthly Impact</p>
                          <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#ef4444" }}>
                            {formatMoney(leak.impact)}
                          </p>
                        </div>
                        <Button variant="primary" size="sm">
                          Fix
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                </StaggerItem>
              ))}
            </div>
          </StaggerContainer>
        ) : (
          <EmptyState icon={TrendingDown} title="No revenue leaks detected" description="Your operations are optimized!" />
        )}
      </section>
    </PageTransition>
  );
}
