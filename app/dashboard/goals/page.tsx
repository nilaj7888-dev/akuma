"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Plus, Target } from "lucide-react";
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { MetricTile, MetricGrid } from "@/components/ui/metric-tile";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { formatMoney } from "@/lib/format";
import { showToast } from "@/components/toast";

type GoalType = "REVENUE" | "ORDERS" | "CUSTOMERS" | "AVERAGE_ORDER_VALUE" | "CUSTOMER_LIFETIME_VALUE" | "PROFIT_MARGIN";
type MerchantGoal = {
  id: string;
  type: GoalType;
  name: string;
  description: string | null;
  targetValue: number;
  currentValue: number;
  unit: string;
  endDate: string;
  status: string;
  progress: number;
  daysRemaining: number;
  onTrack: boolean;
};

const GOAL_TYPE_LABEL: Record<GoalType, string> = {
  REVENUE: "Revenue",
  ORDERS: "Orders",
  CUSTOMERS: "Customers",
  AVERAGE_ORDER_VALUE: "Average Order Value",
  CUSTOMER_LIFETIME_VALUE: "Customer Lifetime Value",
  PROFIT_MARGIN: "Profit Margin",
};

const isMoneyUnit = (unit: string) => /rupee|inr|₹/i.test(unit);

export default function GoalsPage() {
  const [goals, setGoals] = useState<MerchantGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ type: "REVENUE" as GoalType, name: "", targetValue: "", unit: "₹", days: "90" });

  const load = async () => {
    setError(false);
    try {
      const res = await fetch("/api/merchant/goals");
      if (!res.ok) throw new Error("request failed");
      const data = (await res.json()) as { goals: MerchantGoal[] };
      setGoals(Array.isArray(data?.goals) ? data.goals : []);
    } catch {
      setGoals([]);
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const avgProgress = goals.length > 0 ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length) : null;
  const onTrackCount = goals.filter((g) => g.onTrack).length;
  const soonest = goals.length ? Math.min(...goals.map((g) => g.daysRemaining)) : null;

  const createGoal = async () => {
    if (!form.name.trim() || !form.targetValue) {
      showToast("Give the goal a name and a target value.", "error");
      return;
    }
    setCreating(true);
    try {
      const startDate = new Date();
      const endDate = new Date(Date.now() + Number(form.days || 90) * 24 * 60 * 60 * 1000);
      const res = await fetch("/api/merchant/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          name: form.name.trim(),
          targetValue: Number(form.targetValue),
          unit: form.unit,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }),
      });
      if (res.ok) {
        showToast("Goal created.", "success");
        setForm({ type: "REVENUE", name: "", targetValue: "", unit: "₹", days: "90" });
        setShowForm(false);
        await load();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Couldn't create this goal.", "error");
      }
    } catch {
      showToast("Couldn't create this goal. Check your connection.", "error");
    }
    setCreating(false);
  };

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
            <p className="subhead">Track progress toward targets you set, measured against real orders and customers.</p>
          </FadeIn>
          <Button icon={<Plus size={16} />} onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Add goal"}</Button>
        </div>

        {showForm && (
          <Card style={{ marginBottom: "20px" }}>
            <CardBody>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "12px" }}>
                <label style={{ fontSize: "11px", color: "var(--muted)" }}>
                  Type
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as GoalType })} style={{ display: "block", width: "100%", marginTop: "4px", padding: "8px", background: "var(--base)", border: "1px solid var(--line)", borderRadius: "6px", color: "var(--ink)" }}>
                    {Object.entries(GOAL_TYPE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: "11px", color: "var(--muted)" }}>
                  Name
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Grow Q4 revenue" style={{ display: "block", width: "100%", marginTop: "4px", padding: "8px", background: "var(--base)", border: "1px solid var(--line)", borderRadius: "6px", color: "var(--ink)" }} />
                </label>
                <label style={{ fontSize: "11px", color: "var(--muted)" }}>
                  Target value
                  <input type="number" value={form.targetValue} onChange={(e) => setForm({ ...form, targetValue: e.target.value })} placeholder="500000" style={{ display: "block", width: "100%", marginTop: "4px", padding: "8px", background: "var(--base)", border: "1px solid var(--line)", borderRadius: "6px", color: "var(--ink)" }} />
                </label>
                <label style={{ fontSize: "11px", color: "var(--muted)" }}>
                  Deadline (days from today)
                  <input type="number" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} style={{ display: "block", width: "100%", marginTop: "4px", padding: "8px", background: "var(--base)", border: "1px solid var(--line)", borderRadius: "6px", color: "var(--ink)" }} />
                </label>
              </div>
              <Button variant="primary" size="sm" onClick={createGoal} disabled={creating}>{creating ? "Creating..." : "Create goal"}</Button>
            </CardBody>
          </Card>
        )}

        {!loading && !error && goals.length > 0 && (
          <MetricGrid columns={4}>
            <MetricTile label="Total Goals" value={goals.length} delta={`${onTrackCount} on track`} trend="neutral" />
            <MetricTile label="On Track" value={onTrackCount} delta={`${goals.length - onTrackCount} behind`} trend={onTrackCount === goals.length ? "up" : "neutral"} />
            <MetricTile label="Avg Progress" value={avgProgress != null ? `${avgProgress}%` : "—"} delta="Toward targets" trend="neutral" />
            <MetricTile label="Next Deadline" value={soonest != null ? `${soonest}d` : "—"} delta="Soonest goal" trend="neutral" />
          </MetricGrid>
        )}

        {loading ? (
          <div style={{ display: "grid", gap: "16px" }}>
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : error ? (
          <EmptyState icon={AlertTriangle} title="Couldn't load goals" description="The request failed. Check your connection and try again." action={{ label: "Retry", onClick: load }} />
        ) : goals.length > 0 ? (
          <StaggerContainer delay={0.1}>
            <div style={{ display: "grid", gap: "16px" }}>
              {goals.map((goal) => (
                <StaggerItem key={goal.id}>
                  <Card hover>
                    <CardBody>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                        <div>
                          <p style={{ margin: "0 0 4px 0", fontSize: "10px", color: "var(--amber)" }}>{GOAL_TYPE_LABEL[goal.type]}</p>
                          <h3 style={{ margin: 0, fontSize: "14px" }}>{goal.name}</h3>
                        </div>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <Badge variant={goal.onTrack ? "success" : "warning"} size="sm">{goal.onTrack ? "On track" : "Behind"}</Badge>
                          <Badge variant="info" size="sm">{goal.daysRemaining}d left</Badge>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "12px", fontSize: "11px" }}>
                        <div>
                          <p style={{ color: "var(--muted)", margin: "0 0 4px 0" }}>Current</p>
                          <p style={{ margin: 0, fontSize: "13px", color: "var(--ink)", fontWeight: 600 }}>
                            {isMoneyUnit(goal.unit) ? formatMoney(goal.currentValue) : `${goal.currentValue.toLocaleString("en-IN")} ${goal.unit}`}
                          </p>
                        </div>
                        <div>
                          <p style={{ color: "var(--muted)", margin: "0 0 4px 0" }}>Target</p>
                          <p style={{ margin: 0, fontSize: "13px", color: "var(--green)", fontWeight: 600 }}>
                            {isMoneyUnit(goal.unit) ? formatMoney(goal.targetValue) : `${goal.targetValue.toLocaleString("en-IN")} ${goal.unit}`}
                          </p>
                        </div>
                        <div>
                          <p style={{ color: "var(--muted)", margin: "0 0 4px 0" }}>Progress</p>
                          <p style={{ margin: 0, fontSize: "13px", color: "var(--amber)", fontWeight: 600 }}>{goal.progress}%</p>
                        </div>
                      </div>

                      <div style={{ height: "6px", background: "var(--line)", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ height: "100%", background: goal.onTrack ? "linear-gradient(90deg, var(--green), var(--amber))" : "linear-gradient(90deg, var(--amber), #ef4444)", width: `${Math.min(100, goal.progress)}%`, transition: "width 0.3s ease" }} />
                      </div>
                    </CardBody>
                  </Card>
                </StaggerItem>
              ))}
            </div>
          </StaggerContainer>
        ) : (
          <EmptyState icon={Target} title="No goals set yet" description="Create your first business goal to start tracking real progress." action={{ label: "Add goal", onClick: () => setShowForm(true), icon: <Plus size={14} /> }} />
        )}
      </section>
    </PageTransition>
  );
}
