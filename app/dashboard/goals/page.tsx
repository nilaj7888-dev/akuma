"use client";

import { useEffect, useState } from "react";
import { Target, TrendingUp } from "lucide-react";
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { MetricTile, MetricGrid } from "@/components/ui/metric-tile";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/format";

type Goal = { id: string; title: string; progress: number; target: number; current: number; deadline: string };

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGoals = async () => {
      try {
        const res = await fetch("/api/merchant/goals");
        const data = await res.json() as Goal[];
        if (Array.isArray(data)) {
          setGoals(data);
        } else {
          throw new Error("Invalid data");
        }
      } catch {
        setGoals([]);
      }
      setLoading(false);
    };
    void loadGoals();
  }, []);

  const avgProgress = goals.length > 0 ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length) : 0;
  const onTrack = goals.filter((g) => g.progress >= 50).length;

  return (
    <PageTransition>
      <section className="content">
        <header className="topbar">
          <div className="crumb">
            <span>Dashboard</span>
            <span>/</span>
            <strong>Goals</strong>
          </div>
        </header>

        <div className="page-head">
          <FadeIn>
            <p className="eyebrow">GOAL TRACKING</p>
            <h1>Business Goals</h1>
            <p className="subhead">Track progress toward your quarterly and annual business objectives.</p>
          </FadeIn>
          <Button icon={<Target size={16} />}>Add goal</Button>
        </div>

        <MetricGrid columns={4}>
          <MetricTile label="Total Goals" value={goals.length} delta="Active goals" trend="up" />
          <MetricTile label="On Track" value={onTrack} delta={`${goals.length - onTrack} behind`} trend="up" />
          <MetricTile label="Avg Progress" value={`${avgProgress}%`} delta="Toward targets" trend="up" />
          <MetricTile label="Time Remaining" value="87 days" delta="Quarterly deadline" trend="neutral" />
        </MetricGrid>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ color: "var(--muted)" }}>Loading goals...</p>
          </div>
        ) : goals.length > 0 ? (
          <StaggerContainer delay={0.1}>
            <div style={{ display: "grid", gap: "16px" }}>
              {goals.map((goal) => {
                const onTrackStatus = goal.progress >= 50;
                return (
                  <StaggerItem key={goal.id}>
                    <Card hover>
                      <CardBody>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "12px" }}>
                          <h3 style={{ margin: 0, fontSize: "14px", flex: 1 }}>{goal.title}</h3>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <Badge variant={onTrackStatus ? "success" : "warning"} size="sm">
                              {onTrackStatus ? "On track" : "Behind"}
                            </Badge>
                            <Badge variant="info" size="sm">{goal.deadline}</Badge>
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "12px", fontSize: "11px" }}>
                          <div>
                            <p style={{ color: "var(--muted)", margin: "0 0 4px 0" }}>Current</p>
                            <p style={{ margin: 0, fontSize: "13px", color: "var(--ink)", fontWeight: "600" }}>
                              {typeof goal.current === "number" && goal.current > 1000
                                ? formatMoney(goal.current)
                                : goal.current}
                            </p>
                          </div>
                          <div>
                            <p style={{ color: "var(--muted)", margin: "0 0 4px 0" }}>Target</p>
                            <p style={{ margin: 0, fontSize: "13px", color: "var(--green)", fontWeight: "600" }}>
                              {typeof goal.target === "number" && goal.target > 1000
                                ? formatMoney(goal.target)
                                : goal.target}
                            </p>
                          </div>
                          <div>
                            <p style={{ color: "var(--muted)", margin: "0 0 4px 0" }}>Progress</p>
                            <p style={{ margin: 0, fontSize: "13px", color: "var(--amber)", fontWeight: "600" }}>
                              {goal.progress}%
                            </p>
                          </div>
                        </div>

                        <div style={{ height: "6px", background: "var(--line)", borderRadius: "3px", overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              background: onTrackStatus
                                ? "linear-gradient(90deg, var(--green), var(--amber))"
                                : "linear-gradient(90deg, var(--amber), #ef4444)",
                              width: `${goal.progress}%`,
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                      </CardBody>
                    </Card>
                  </StaggerItem>
                );
              })}
            </div>
          </StaggerContainer>
        ) : (
          <EmptyState icon={Target} title="No goals set yet" description="Create your first business goal to start tracking" />
        )}
      </section>
    </PageTransition>
  );
}
