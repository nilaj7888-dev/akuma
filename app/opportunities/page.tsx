"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, Eye, Target, Zap } from "lucide-react";

type Opportunity = {
  id: string;
  title: string;
  description: string;
  type: string;
  confidence: number;
  expectedRevenue: number;
  expectedLift: number;
  riskScore: number;
  status: string;
  evidence: { coPurchaseRate: number; orders: number; customers: number; window: string };
  discountPercent?: number;
};

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/opportunities");
        if (!response.ok) throw new Error("Failed to load opportunities");
        const data = await response.json() as Opportunity[];
        setOpportunities(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load opportunities");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const statusColor = (status: string) => {
    if (status === "AWAITING_APPROVAL") return "amber";
    if (status === "ACTIVE") return "green";
    if (status === "GUARDRAIL_REJECTED") return "red";
    return "gray";
  };

  return (
    <main className="shell">
      <section className="content">
        <header className="topbar">
          <div className="crumb">
            <Link href="/" className="crumb-link"><ArrowLeft size={14} /> Back</Link>
            <span>/</span>
            <strong>Opportunities</strong>
          </div>
        </header>

        <div className="page-head">
          <div>
            <p className="eyebrow">OPPORTUNITIES</p>
            <h1>Growth opportunities</h1>
            <p className="subhead">Evidence-backed cross-sell, upsell, and campaign opportunities waiting for your decision.</p>
          </div>
        </div>

        {loading && <div style={{ padding: "40px", textAlign: "center" }}><p>Loading opportunities...</p></div>}
        {error && <div style={{ padding: "20px", background: "rgba(239, 68, 68, 0.1)", color: "#dc2626", borderRadius: "8px", margin: "20px" }}><strong>Error:</strong> {error}</div>}

        {!loading && opportunities.length === 0 && (
          <div style={{ padding: "60px 20px", textAlign: "center", background: "rgba(107, 114, 128, 0.05)", borderRadius: "12px", margin: "20px" }}>
            <Target size={32} style={{ marginBottom: "16px", opacity: 0.5 }} />
            <p style={{ fontSize: "16px", marginBottom: "8px" }}>No opportunities yet</p>
            <p style={{ fontSize: "14px", color: "rgba(107, 114, 128, 0.7)" }}>Run analysis from the dashboard to discover growth opportunities.</p>
          </div>
        )}

        {!loading && opportunities.length > 0 && (
          <div style={{ display: "grid", gap: "16px", marginTop: "24px" }}>
            {opportunities.map((opp) => (
              <div key={opp.id} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "12px" }}>
                  <div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "600", color: "#6b7280", textTransform: "uppercase" }}>{opp.type}</span>
                      <span style={{ fontSize: "12px", fontWeight: "600", color: "#059669", background: "#d1fae5", padding: "2px 8px", borderRadius: "4px" }}>{opp.confidence}% confident</span>
                    </div>
                    <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "4px" }}>{opp.title}</h3>
                    <p style={{ fontSize: "14px", color: "#6b7280" }}>{opp.description}</p>
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: "600", padding: "4px 12px", borderRadius: "4px", background: statusColor(opp.status) === "amber" ? "#fef3c7" : statusColor(opp.status) === "green" ? "#d1fae5" : "#fee2e2", color: statusColor(opp.status) === "amber" ? "#92400e" : statusColor(opp.status) === "green" ? "#065f46" : "#991b1b" }}>{opp.status.replace(/_/g, " ")}</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px", fontSize: "13px" }}>
                  <div>
                    <span style={{ color: "#9ca3af", display: "block", marginBottom: "4px" }}>Co-purchase rate</span>
                    <strong>{opp.evidence.coPurchaseRate}%</strong>
                  </div>
                  <div>
                    <span style={{ color: "#9ca3af", display: "block", marginBottom: "4px" }}>Expected lift</span>
                    <strong>{opp.expectedLift}%</strong>
                  </div>
                  <div>
                    <span style={{ color: "#9ca3af", display: "block", marginBottom: "4px" }}>Expected revenue</span>
                    <strong>₹{(opp.expectedRevenue / 100).toLocaleString("en-IN")}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#9ca3af", display: "block", marginBottom: "4px" }}>Risk</span>
                    <strong style={{ color: "#059669" }}>LOW · {opp.riskScore}</strong>
                  </div>
                </div>

                {opp.status === "AWAITING_APPROVAL" && (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button style={{ flex: 1, padding: "10px 16px", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}>
                      <Check size={14} style={{ marginRight: "6px", display: "inline" }} /> Approve
                    </button>
                    <button style={{ flex: 1, padding: "10px 16px", background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}>
                      <Eye size={14} style={{ marginRight: "6px", display: "inline" }} /> View details
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
