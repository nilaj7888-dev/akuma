"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle, Gauge, ShoppingCart, TrendingUp, Users, Wrench, Zap } from "lucide-react";
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { MetricTile, MetricGrid } from "@/components/ui/metric-tile";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { formatMoney } from "@/lib/format";

type Category = "ACQUIRE" | "CONVERT" | "EXPAND" | "RETAIN" | "OPTIMIZE" | "FIX";
type MerchantAction = {
  id: string;
  priority: number;
  category: Category;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  expectedImpact: number;
  confidence: number;
  estimatedEffort: "QUICK" | "MEDIUM" | "COMPLEX";
  recommendedAction: string;
  actionLink: string;
};

const CATEGORY_ICON: Record<Category, React.ElementType> = {
  ACQUIRE: Users,
  CONVERT: ShoppingCart,
  EXPAND: TrendingUp,
  RETAIN: CheckCircle,
  OPTIMIZE: Gauge,
  FIX: Wrench,
};

const EFFORT_VARIANT: Record<MerchantAction["estimatedEffort"], "success" | "warning" | "error"> = {
  QUICK: "success",
  MEDIUM: "warning",
  COMPLEX: "error",
};

export default function ActionCenterPage() {
  const router = useRouter();
  const [actions, setActions] = useState<MerchantAction[]>([]);
  const [category, setCategory] = useState<Category | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setError(false);
    try {
      const res = await fetch("/api/daily-actions");
      if (!res.ok) throw new Error("request failed");
      const data = (await res.json()) as MerchantAction[];
      setActions(Array.isArray(data) ? data : []);
    } catch {
      setActions([]);
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const categoriesPresent = Array.from(new Set(actions.map((a) => a.category)));
  const filtered = category === "ALL" ? actions : actions.filter((a) => a.category === category);
  const totalImpact = actions.reduce((sum, a) => sum + a.expectedImpact, 0);
  const avgConfidence = actions.length ? Math.round(actions.reduce((sum, a) => sum + a.confidence, 0) / actions.length) : null;
  const quickWins = actions.filter((a) => a.estimatedEffort === "QUICK").length;

  return (
    <PageTransition>
      <section className="content">
        <header className="topbar">
          <div className="crumb">
            <span>Dashboard</span>
            <span>/</span>
            <strong>Action Center</strong>
          </div>
        </header>

        <div className="page-head">
          <FadeIn>
            <p className="eyebrow">ACTION CENTER</p>
            <h1>What needs your attention today</h1>
            <p className="subhead">Ranked by revenue at stake, computed fresh from your orders, inventory, and customer activity — not a static to-do list.</p>
          </FadeIn>
        </div>

        {!loading && !error && actions.length > 0 && (
          <MetricGrid columns={4}>
            <MetricTile label="Actions today" value={actions.length} delta={`${quickWins} quick win${quickWins === 1 ? "" : "s"}`} trend="neutral" icon={Zap} />
            <MetricTile label="Revenue at stake" value={formatMoney(totalImpact)} delta="If all actions are taken" trend="up" icon={TrendingUp} />
            <MetricTile label="Avg. confidence" value={avgConfidence != null ? `${avgConfidence}%` : "—"} delta="Based on your data" trend="neutral" icon={Gauge} />
            <MetricTile label="Categories" value={categoriesPresent.length} delta="In today's queue" trend="neutral" />
          </MetricGrid>
        )}

        {!loading && !error && actions.length > 0 && (
          <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
            <Button variant={category === "ALL" ? "primary" : "secondary"} size="sm" onClick={() => setCategory("ALL")}>
              All ({actions.length})
            </Button>
            {categoriesPresent.map((c) => (
              <Button key={c} variant={category === c ? "primary" : "secondary"} size="sm" onClick={() => setCategory(c)}>
                {c} ({actions.filter((a) => a.category === c).length})
              </Button>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ display: "grid", gap: "12px" }}>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : error ? (
          <EmptyState icon={Zap} title="Couldn't load today's actions" description="The request failed. Check your connection and try again." action={{ label: "Retry", onClick: load }} />
        ) : filtered.length > 0 ? (
          <StaggerContainer delay={0.08}>
            <div style={{ display: "grid", gap: "12px" }}>
              {filtered.map((action) => {
                const Icon = CATEGORY_ICON[action.category] ?? Zap;
                return (
                  <StaggerItem key={action.id}>
                    <Card hover>
                      <CardBody style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: "240px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                            <Icon size={15} style={{ color: "var(--amber)" }} />
                            <h3 style={{ margin: 0, fontSize: "14px" }}>{action.title}</h3>
                            <Badge variant="info" size="sm">{action.category}</Badge>
                            <Badge variant={EFFORT_VARIANT[action.estimatedEffort]} size="sm">{action.estimatedEffort}</Badge>
                          </div>
                          <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 10px 0", lineHeight: 1.5 }}>{action.description}</p>
                          <div style={{ display: "flex", gap: "24px", fontSize: "10px", color: "var(--muted)" }}>
                            <span>Expected impact: <strong style={{ color: "var(--green)" }}>{formatMoney(action.expectedImpact)}</strong></span>
                            <span>Confidence: <strong style={{ color: "var(--ink)" }}>{action.confidence}%</strong></span>
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                          <Button variant="primary" size="sm" icon={<ArrowRight size={12} />} onClick={() => router.push(action.actionLink)}>
                            {action.recommendedAction}
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  </StaggerItem>
                );
              })}
            </div>
          </StaggerContainer>
        ) : actions.length > 0 ? (
          <EmptyState icon={CheckCircle} title="No actions in this category" description="Try a different category filter." action={{ label: "Show all", onClick: () => setCategory("ALL") }} />
        ) : (
          <EmptyState icon={CheckCircle} title="Nothing needs your attention right now" description="AKUMA continuously scans orders, inventory, and customer activity. Once something is worth acting on, it will show up here." />
        )}
      </section>
    </PageTransition>
  );
}
