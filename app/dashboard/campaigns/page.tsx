"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Play, Pause, Plus, TrendingUp } from "lucide-react";
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { MetricTile, MetricGrid } from "@/components/ui/metric-tile";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/format";

type Campaign = { id: string; name: string; status: string; type: string; reach: number; conversions: number; revenue: number; startDate: string; endDate: string };

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        const res = await fetch("/api/campaigns");
        const data = await res.json() as Campaign[];
        if (Array.isArray(data)) {
          setCampaigns(data);
        } else {
          throw new Error("Invalid data");
        }
      } catch {
        setCampaigns([]);
      }
      setLoading(false);
    };
    void loadCampaigns();
  }, []);

  const stats = {
    active: campaigns.filter((c) => c.status === "ACTIVE").length,
    total: campaigns.length,
    revenue: campaigns.reduce((sum, c) => sum + c.revenue, 0),
    conversions: campaigns.reduce((sum, c) => sum + c.conversions, 0),
  };

  const statusColors: Record<string, "success" | "warning" | "info" | "amber" | "green" | "error"> = {
    ACTIVE: "success",
    PAUSED: "warning",
    COMPLETED: "info",
    DRAFT: "info",
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
            <h1>Active Campaigns</h1>
            <p className="subhead">Manage email, SMS, discount, and AI recommendation campaigns across your store.</p>
          </FadeIn>
          <Button icon={<Plus size={16} />}>Create campaign</Button>
        </div>

        <MetricGrid columns={4}>
          <MetricTile label="Active Campaigns" value={stats.active} delta={`${stats.total} total`} trend="up" />
          <MetricTile label="Total Revenue" value={formatMoney(stats.revenue)} delta="+22% vs last month" trend="up" />
          <MetricTile label="Total Conversions" value={stats.conversions} delta="+18% conversion rate" trend="up" />
          <MetricTile label="Avg ROI" value="340%" delta="+45 pts vs last quarter" trend="up" />
        </MetricGrid>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ color: "var(--muted)" }}>Loading campaigns...</p>
          </div>
        ) : campaigns.length > 0 ? (
          <StaggerContainer delay={0.08}>
            <div style={{ display: "grid", gap: "12px" }}>
              {campaigns.map((campaign) => (
                <StaggerItem key={campaign.id}>
                  <Card hover>
                    <CardBody style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                          <h3 style={{ margin: 0, fontSize: "14px" }}>{campaign.name}</h3>
                          <Badge variant={statusColors[campaign.status] || "info"} size="sm">
                            {campaign.status}
                          </Badge>
                          <Badge variant="amber" size="sm">
                            {campaign.type}
                          </Badge>
                        </div>
                        <div style={{ display: "flex", gap: "24px", fontSize: "11px", color: "var(--muted)" }}>
                          <span>Reach: {campaign.reach.toLocaleString()}</span>
                          <span>Conversions: {campaign.conversions.toLocaleString()}</span>
                          <span>Revenue: {formatMoney(campaign.revenue)}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <Button variant="ghost" size="sm" icon={campaign.status === "ACTIVE" ? <Pause size={14} /> : <Play size={14} />} />
                        <Button variant="ghost" size="sm" icon={<ArrowRight size={14} />} />
                      </div>
                    </CardBody>
                  </Card>
                </StaggerItem>
              ))}
            </div>
          </StaggerContainer>
        ) : (
          <EmptyState icon={TrendingUp} title="No campaigns yet" description="Create your first campaign to start reaching customers" action={{ label: "Create campaign", onClick: () => {}, icon: <Plus size={14} /> }} />
        )}
      </section>
    </PageTransition>
  );
}
