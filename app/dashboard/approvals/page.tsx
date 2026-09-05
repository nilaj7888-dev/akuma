"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle, ShieldCheck } from "lucide-react";
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { formatMoney } from "@/lib/format";
import { showToast } from "@/components/toast";

type PendingApproval = {
  id: string;
  type: string;
  title: string;
  description: string;
  confidence: number;
  expectedRevenue: number;
  expectedLift: number;
  riskScore: number;
  marginImpact: number;
  createdAt: string;
};

export default function ApprovalsPage() {
  const [items, setItems] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const load = async () => {
    setError(false);
    try {
      const res = await fetch("/api/approvals");
      if (!res.ok) throw new Error("request failed");
      const data = (await res.json()) as PendingApproval[];
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const decide = async (id: string) => {
    setDecidingId(id);
    try {
      const res = await fetch(`/api/opportunities/${id}/approve`, { method: "POST" });
      if (res.ok) {
        showToast("Approved. AKUMA created the campaign and logged it to the audit trail.", "success");
        setItems((prev) => prev.filter((item) => item.id !== id));
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error?.message || data.error || "Couldn't approve this action.", "error");
      }
    } catch {
      showToast("Couldn't approve this action. Check your connection.", "error");
    }
    setDecidingId(null);
  };

  return (
    <main className="shell">
      <section className="content">
        <header className="topbar">
          <div className="crumb">
            <Link href="/dashboard" className="crumb-link"><ArrowLeft size={14} /> Back</Link>
            <span>/</span>
            <strong>Approvals</strong>
          </div>
        </header>

        <div className="page-head">
          <FadeIn>
            <p className="eyebrow">APPROVALS</p>
            <h1>Pending decisions</h1>
            <p className="subhead">Every AI-proposed action that needs your sign-off before it goes live, in one place.</p>
          </FadeIn>
        </div>

        {loading ? (
          <div style={{ display: "grid", gap: "12px" }}>
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : error ? (
          <EmptyState icon={AlertTriangle} title="Couldn't load approvals" description="The request failed. Check your connection and try again." action={{ label: "Retry", onClick: load }} />
        ) : items.length > 0 ? (
          <StaggerContainer delay={0.08}>
            <div style={{ display: "grid", gap: "12px" }}>
              {items.map((item) => (
                <StaggerItem key={item.id}>
                  <Card hover>
                    <CardBody style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: "240px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                          <h3 style={{ margin: 0, fontSize: "14px" }}>{item.title}</h3>
                          <Badge variant="info" size="sm">{item.type.replace(/_/g, " ")}</Badge>
                          <Badge variant={item.confidence >= 80 ? "success" : item.confidence >= 60 ? "warning" : "info"} size="sm">{item.confidence}% confidence</Badge>
                        </div>
                        <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 10px 0", lineHeight: 1.5 }}>{item.description}</p>
                        <div style={{ display: "flex", gap: "24px", fontSize: "10px", color: "var(--muted)" }}>
                          <span>Expected revenue: <strong style={{ color: "var(--green)" }}>{formatMoney(item.expectedRevenue)}</strong></span>
                          <span>Expected lift: <strong style={{ color: "var(--ink)" }}>{item.expectedLift}%</strong></span>
                          <span>Risk score: <strong style={{ color: item.riskScore >= 60 ? "#ef4444" : item.riskScore >= 30 ? "var(--amber)" : "var(--green)" }}>{item.riskScore}</strong></span>
                        </div>
                      </div>
                      <Button variant="primary" size="sm" icon={<ShieldCheck size={14} />} disabled={decidingId === item.id} onClick={() => decide(item.id)}>
                        {decidingId === item.id ? "Approving..." : "Approve"}
                      </Button>
                    </CardBody>
                  </Card>
                </StaggerItem>
              ))}
            </div>
          </StaggerContainer>
        ) : (
          <EmptyState
            icon={CheckCircle}
            title="No pending approvals"
            description="When AKUMA proposes an action that requires your approval, it will appear here."
            action={{ label: "Run an analysis", onClick: () => { window.location.href = "/dashboard"; } }}
          />
        )}
      </section>
    </main>
  );
}
