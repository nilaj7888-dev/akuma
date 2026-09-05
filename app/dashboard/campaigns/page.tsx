"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Sparkles, TrendingUp } from "lucide-react";
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { MetricTile, MetricGrid } from "@/components/ui/metric-tile";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { formatMoney } from "@/lib/format";

type Campaign = {
  id: string;
  name: string;
  type: string;
  status: "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "PAUSED" | "COMPLETED" | "FAILED";
  budget: number;
  discount: number;
  expectedRevenue: number;
  actualRevenue: number;
  audience: { size?: number } | null;
  startedAt: string | null;
  endedAt: string | null;
};

const STATUS_VARIANT: Record<Campaign["status"], "success" | "warning" | "info" | "error"> = {
  ACTIVE: "success",
  PENDING_APPROVAL: "warning",
  PAUSED: "warning",
  COMPLETED: "info",
  DRAFT: "info",
  FAILED: "error",
};

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setError(false);
    try {
      const res = await fetch("/api/campaigns");
      if (!res.ok) throw new Error("request failed");
      const data = (await res.json()) as Campaign[];
      setCampaigns(Array.isArray(data) ? data : []);
    } catch {
      setCampaigns([]);
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const active = campaigns.filter((c) => c.status === "ACTIVE");
  const stats = {
    active: active.length,
    total: campaigns.length,
    actualRevenue: campaigns.reduce((sum, c) => sum + c.actualRevenue, 0) / 100,
    expectedRevenue: campaigns.reduce((sum, c) => sum + c.expectedRevenue, 0) / 100,
  };

  return (
    <PageTransition>
      <section className="content">
        <header className="topbar">
          <div className="crumb">
            <span>Dashboard</span>
            <span>/</span>
            <strong>Campaigns</strong>
          </div>
        </header>

        <div className="page-head">
          <FadeIn>
            <p className="eyebrow">CAMPAIGN MANAGER</p>
            <h1>Campaigns</h1>
            <p className="subhead">Every campaign here started as an AI-proposed opportunity you approved — AKUMA doesn't launch anything on its own.</p>
          </FadeIn>
          <Button icon={<Sparkles size={16} />} onClick={() => router.push("/dashboard/opportunities")}>
            Review opportunities
          </Button>
        </div>

        {!loading && !error && campaigns.length > 0 && (
          <MetricGrid columns={3}>
            <MetricTile label="Active Campaigns" value={stats.active} delta={`${stats.total} total`} trend="neutral" />
            <MetricTile label="Actual Revenue" value={formatMoney(stats.actualRevenue)} delta="From active + completed campaigns" trend={stats.actualRevenue > 0 ? "up" : "neutral"} />
            <MetricTile label="Expected Revenue" value={formatMoney(stats.expectedRevenue)} delta="Estimated at approval time" trend="neutral" />
          </MetricGrid>
        )}

        {loading ? (
          <div style={{ display: "grid", gap: "12px" }}>
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : error ? (
          <EmptyState icon={AlertTriangle} title="Couldn't load campaigns" description="The request failed. Check your connection and try again." action={{ label: "Retry", onClick: load }} />
        ) : campaigns.length > 0 ? (
          <StaggerContainer delay={0.08}>
            <div style={{ display: "grid", gap: "12px" }}>
              {campaigns.map((campaign) => (
                <StaggerItem key={campaign.id}>
                  <Card hover>
                    <CardBody style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                      <div style={{ flex: 1, minWidth: "220px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px", flexWrap: "wrap" }}>
                          <h3 style={{ margin: 0, fontSize: "14px" }}>{campaign.name}</h3>
                          <Badge variant={STATUS_VARIANT[campaign.status] ?? "info"} size="sm">{campaign.status.replace(/_/g, " ")}</Badge>
                          <Badge variant="amber" size="sm">{campaign.type.replace(/_/g, " ")}</Badge>
                        </div>
                        <div style={{ display: "flex", gap: "24px", fontSize: "11px", color: "var(--muted)", flexWrap: "wrap" }}>
                          {campaign.audience?.size != null && <span>Audience: {campaign.audience.size.toLocaleString("en-IN")}</span>}
                          <span>Discount: {campaign.discount}%</span>
                          <span>Actual revenue: {formatMoney(campaign.actualRevenue / 100)}</span>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </StaggerItem>
              ))}
            </div>
          </StaggerContainer>
        ) : (
          <EmptyState icon={TrendingUp} title="No campaigns yet" description="Campaigns are created automatically when you approve an AI-proposed opportunity." action={{ label: "Review opportunities", onClick: () => router.push("/dashboard/opportunities"), icon: <ArrowRight size={14} /> }} />
        )}
      </section>
    </PageTransition>
  );
}
