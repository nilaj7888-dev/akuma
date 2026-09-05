"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, Zap, AlertTriangle, TrendingUp } from "lucide-react";

interface MerchantAction {
  id: string;
  priority: number;
  category: "ACQUIRE" | "CONVERT" | "EXPAND" | "RETAIN" | "OPTIMIZE" | "FIX";
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  expectedImpact: number;
  confidence: number;
  estimatedEffort: "QUICK" | "MEDIUM" | "COMPLEX";
  recommendedAction: string;
  actionLink: string;
}

export default function DailyActionsPage() {
  const [actions, setActions] = useState<MerchantAction[]>([]);
  const [selectedAction, setSelectedAction] = useState<MerchantAction | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/daily-actions");
      const data = (await res.json()) as MerchantAction[];
      setActions(data);
      if (data.length > 0) {
        setSelectedAction(data[0]);
      }
    };

    void load();
  }, []);

  const categoryLabel = (category: string) => {
    if (category === "ACQUIRE") return "🎯 Acquire";
    if (category === "CONVERT") return "🔄 Convert";
    if (category === "EXPAND") return "📈 Expand";
    if (category === "RETAIN") return "❤️ Retain";
    if (category === "OPTIMIZE") return "⚙️ Optimize";
    return "🔧 Fix";
  };

  const categoryColor = (category: string) => {
    if (category === "ACQUIRE") return "#3b82f6";
    if (category === "CONVERT") return "#8b5cf6";
    if (category === "EXPAND") return "#10b981";
    if (category === "RETAIN") return "#f59e0b";
    if (category === "OPTIMIZE") return "#06b6d4";
    return "#ef4444";
  };

  const effortIcon = (effort: string) => {
    if (effort === "QUICK") return "⚡";
    if (effort === "MEDIUM") return "⏱️";
    return "🔨";
  };

  const totalImpact = actions.reduce((sum, a) => sum + a.expectedImpact, 0);

  return (
    <section className="content">
      <header className="topbar">
        <div className="crumb">
          <span>Workspace</span>
          <span>/</span>
          <strong>What Should I Do Today?</strong>
        </div>
      </header>

      <div className="page-head">
        <div>
          <p className="eyebrow">DAILY ACTION PLANNER</p>
          <h1>Your top growth actions, ranked by impact</h1>
          <p className="subhead">₹{totalImpact.toLocaleString("en-IN")} potential impact from top opportunities.</p>
        </div>
      </div>

      <section className="metric-grid">
        <div className="metric">
          <div className="metric-label">
            <span>TOP ACTIONS</span>
            <Zap size={16} />
          </div>
          <strong>{actions.length}</strong>
          <small>
            <ArrowRight size={13} /> Ranked by priority
          </small>
        </div>

        <div className="metric">
          <div className="metric-label">
            <span>TOTAL IMPACT</span>
            <TrendingUp size={16} />
          </div>
          <strong>₹{totalImpact.toLocaleString("en-IN")}</strong>
          <small>
            <ArrowRight size={13} /> Expected revenue
          </small>
        </div>

        <div className="metric">
          <div className="metric-label">
            <span>AVG CONFIDENCE</span>
            <Check size={16} />
          </div>
          <strong>{Math.round(actions.length > 0 ? actions.reduce((s, a) => s + a.confidence, 0) / actions.length : 0)}%</strong>
          <small>
            <ArrowRight size={13} /> Across all actions
          </small>
        </div>

        <div className="metric">
          <div className="metric-label">
            <span>QUICK WINS</span>
            <AlertTriangle size={16} />
          </div>
          <strong>{actions.filter((a) => a.estimatedEffort === "QUICK").length}</strong>
          <small>
            <ArrowRight size={13} /> Can do today
          </small>
        </div>
      </section>

      <div className="section-heading">
        <div>
          <p className="eyebrow">RANKED ACTIONS</p>
          <h2>Execute in priority order</h2>
        </div>
      </div>

      <section className="main-grid">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "300px 1fr",
            gap: "1.5rem",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {actions.length === 0 ? (
              <div
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  padding: "1.5rem",
                  textAlign: "center",
                  color: "#666",
                }}
              >
                No actions available
              </div>
            ) : (
              actions.map((action, index) => (
                <button
                  key={action.id}
                  onClick={() => setSelectedAction(action)}
                  style={{
                    padding: "1rem",
                    borderRadius: "8px",
                    border: selectedAction?.id === action.id ? "2px solid" : "1px solid",
                    borderColor: selectedAction?.id === action.id ? categoryColor(action.category) : "#e5e7eb",
                    backgroundColor: selectedAction?.id === action.id ? categoryColor(action.category) + "10" : "#fff",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#666", marginBottom: "0.25rem" }}>
                    #{index + 1} · {categoryLabel(action.category)}
                  </div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem" }}>{action.title}</div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: categoryColor(action.category),
                      fontWeight: 600,
                    }}
                  >
                    ₹{action.expectedImpact.toLocaleString("en-IN")} impact
                  </div>
                </button>
              ))
            )}
          </div>

          {selectedAction && (
            <div
              style={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "1.5rem",
              }}
            >
              <div style={{ marginBottom: "1.5rem" }}>
                <div
                  style={{
                    display: "inline-block",
                    padding: "0.5rem 1rem",
                    borderRadius: "6px",
                    backgroundColor: categoryColor(selectedAction.category) + "20",
                    color: categoryColor(selectedAction.category),
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    marginBottom: "0.75rem",
                  }}
                >
                  {categoryLabel(selectedAction.category)}
                </div>

                <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                  {selectedAction.title}
                </h2>
                <p style={{ fontSize: "0.875rem", color: "#666" }}>{selectedAction.description}</p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                  marginBottom: "1.5rem",
                  padding: "1rem",
                  backgroundColor: "#f9fafb",
                  borderRadius: "6px",
                }}
              >
                <div>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#666" }}>EXPECTED IMPACT</span>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, color: categoryColor(selectedAction.category) }}>
                    ₹{selectedAction.expectedImpact.toLocaleString("en-IN")}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#666" }}>CONFIDENCE</span>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{selectedAction.confidence}%</div>
                </div>
                <div>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#666" }}>EFFORT</span>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                    {effortIcon(selectedAction.estimatedEffort)} {selectedAction.estimatedEffort}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#666" }}>PRIORITY</span>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>P{selectedAction.priority}</div>
                </div>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <p style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.75rem" }}>EVIDENCE</p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: "0.75rem",
                  }}
                >
                  {Object.entries(selectedAction.evidence).map(([key, value]) => (
                    <div
                      key={key}
                      style={{
                        backgroundColor: "#f9fafb",
                        padding: "0.75rem",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                      }}
                    >
                      <span style={{ color: "#666" }}>{key.replace(/_/g, " ")}</span>
                      <div style={{ fontWeight: 600, marginTop: "0.25rem" }}>
                        {typeof value === "number" && value > 100 ? `₹${value.toLocaleString("en-IN")}` : String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "6px",
                  padding: "1rem",
                  marginBottom: "1.5rem",
                }}
              >
                <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#166534", marginBottom: "0.5rem" }}>
                  ✨ NEXT ACTION
                </p>
                <p style={{ fontSize: "0.875rem", color: "#1b7e2f" }}>{selectedAction.recommendedAction}</p>
              </div>

              <a
                href={selectedAction.actionLink}
                style={{
                  display: "inline-block",
                  padding: "0.75rem 1.5rem",
                  backgroundColor: categoryColor(selectedAction.category),
                  color: "#fff",
                  borderRadius: "6px",
                  textDecoration: "none",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Go to {selectedAction.category === "ACQUIRE" ? "Acquisition" : selectedAction.category === "RETAIN" ? "Churn" : "Opportunities"}
              </a>
            </div>
          )}
        </div>
      </section>

      <footer style={{ marginTop: "2rem", textAlign: "center", fontSize: "0.875rem", color: "#999" }}>
        <span>AKUMA / Daily Action Planner</span>
      </footer>
    </section>
  );
}
