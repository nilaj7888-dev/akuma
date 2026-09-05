"use client";

import { useEffect, useState } from "react";
import { CheckCircle, AlertCircle, Clock, ArrowRight, Zap } from "lucide-react";
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { MetricTile, MetricGrid } from "@/components/ui/metric-tile";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

type Action = { id: string; title: string; description: string; priority: "HIGH" | "MEDIUM" | "LOW"; status: "PENDING" | "IN_PROGRESS" | "COMPLETED"; dueDate: string; assignee: string };

const mockActions: Action[] = [
  {
    id: "1",
    title: "Create email campaign for high-value customers",
    description: "Re-engagement campaign for customers with CLV > ₹100k",
    priority: "HIGH",
    status: "PENDING",
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN"),
    assignee: "Marketing Team",
  },
  {
    id: "2",
    title: "Adjust pricing for underperforming SKUs",
    description: "Price optimization for 15 low-margin products",
    priority: "MEDIUM",
    status: "IN_PROGRESS",
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN"),
    assignee: "Finance",
  },
  {
    id: "3",
    title: "Launch flash sale campaign",
    description: "Clear excess inventory with targeted discount",
    priority: "HIGH",
    status: "PENDING",
    dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN"),
    assignee: "Sales",
  },
  {
    id: "4",
    title: "Update product descriptions",
    description: "Improve SEO and conversion on 50 top products",
    priority: "LOW",
    status: "COMPLETED",
    dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN"),
    assignee: "Content Team",
  },
];

export default function ActionCenterPage() {
  const [actions, setActions] = useState<Action[]>([]);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "IN_PROGRESS" | "COMPLETED">("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadActions = async () => {
      try {
        const res = await fetch("/api/daily-actions");
        const data = await res.json() as Action[];
        if (Array.isArray(data)) {
          setActions(data);
        } else {
          throw new Error("Invalid data");
        }
      } catch {
        setActions(mockActions);
      }
      setLoading(false);
    };
    void loadActions();
  }, []);

  const filtered = filter === "ALL" ? actions : actions.filter((a) => a.status === filter);

  const stats = {
    pending: actions.filter((a) => a.status === "PENDING").length,
    inProgress: actions.filter((a) => a.status === "IN_PROGRESS").length,
    completed: actions.filter((a) => a.status === "COMPLETED").length,
  };

  const priorityColor: Record<string, any> = {
    HIGH: "error",
    MEDIUM: "warning",
    LOW: "info",
  };

  const statusIcon: Record<string, any> = {
    PENDING: <Clock size={14} />,
    IN_PROGRESS: <Zap size={14} />,
    COMPLETED: <CheckCircle size={14} />,
  };

  const statusColors: Record<string, any> = {
    PENDING: "warning",
    IN_PROGRESS: "amber",
    COMPLETED: "success",
  };

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
            <h1>Pending Actions</h1>
            <p className="subhead">Track and manage all recommended actions from AKUMA, organized by priority and status.</p>
          </FadeIn>
          <Button icon={<ArrowRight size={16} />}>View all actions</Button>
        </div>

        <MetricGrid columns={4}>
          <MetricTile label="Pending" value={stats.pending} delta="Ready to execute" trend="neutral" />
          <MetricTile label="In Progress" value={stats.inProgress} delta="Being executed" trend="up" />
          <MetricTile label="Completed" value={stats.completed} delta="This month" trend="up" />
          <MetricTile label="Potential Revenue" value="₹2.5L" delta="From pending actions" trend="up" />
        </MetricGrid>

        <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
          <Button variant={filter === "ALL" ? "primary" : "secondary"} size="sm" onClick={() => setFilter("ALL")}>
            All ({actions.length})
          </Button>
          <Button variant={filter === "PENDING" ? "primary" : "secondary"} size="sm" onClick={() => setFilter("PENDING")}>
            Pending ({stats.pending})
          </Button>
          <Button variant={filter === "IN_PROGRESS" ? "primary" : "secondary"} size="sm" onClick={() => setFilter("IN_PROGRESS")}>
            In Progress ({stats.inProgress})
          </Button>
          <Button variant={filter === "COMPLETED" ? "primary" : "secondary"} size="sm" onClick={() => setFilter("COMPLETED")}>
            Completed ({stats.completed})
          </Button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ color: "var(--muted)" }}>Loading actions...</p>
          </div>
        ) : filtered.length > 0 ? (
          <StaggerContainer delay={0.08}>
            <div style={{ display: "grid", gap: "12px" }}>
              {filtered.map((action) => (
                <StaggerItem key={action.id}>
                  <Card hover>
                    <CardBody style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                          <h3 style={{ margin: 0, fontSize: "14px" }}>{action.title}</h3>
                          <Badge variant={priorityColor[action.priority]} size="sm">
                            {action.priority}
                          </Badge>
                          <Badge variant={statusColors[action.status]} size="sm">
                            {statusIcon[action.status]}
                            {action.status}
                          </Badge>
                        </div>
                        <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 8px 0" }}>{action.description}</p>
                        <div style={{ display: "flex", gap: "24px", fontSize: "10px", color: "var(--muted)" }}>
                          <span>Due: {action.dueDate}</span>
                          <span>Assigned to: {action.assignee}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px", marginLeft: "16px" }}>
                        {action.status === "PENDING" && <Button variant="primary" size="sm">Start</Button>}
                        {action.status === "IN_PROGRESS" && <Button variant="primary" size="sm">Complete</Button>}
                        <Button variant="ghost" size="sm" icon={<ArrowRight size={12} />} />
                      </div>
                    </CardBody>
                  </Card>
                </StaggerItem>
              ))}
            </div>
          </StaggerContainer>
        ) : (
          <EmptyState icon={CheckCircle} title="No actions with this filter" description="Great job! All actions are handled." />
        )}
      </section>
    </PageTransition>
  );
}
