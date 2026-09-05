"use client";

import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { useEffect, useState } from "react";

type AuditEvent = {
  id: string;
  actor: string;
  action: string;
  detail: string;
  time: string;
  status: string;
};

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/audit");
        if (response.ok) {
          const data = await response.json() as AuditEvent[];
          setEvents(data);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <main className="shell">
      <section className="content">
        <header className="topbar">
          <div className="crumb">
            <Link href="/" className="crumb-link"><ArrowLeft size={14} /> Back</Link>
            <span>/</span>
            <strong>Audit trail</strong>
          </div>
        </header>

        <div className="page-head">
          <div>
            <p className="eyebrow">AUDIT</p>
            <h1>Activity log</h1>
            <p className="subhead">Complete record of all system actions, decisions, and changes.</p>
          </div>
        </div>

        {loading && <div style={{ padding: "40px", textAlign: "center" }}><p>Loading audit events...</p></div>}

        {!loading && events.length === 0 && (
          <div style={{ padding: "60px 20px", textAlign: "center", background: "rgba(107, 114, 128, 0.05)", borderRadius: "12px", margin: "20px" }}>
            <Clock size={32} style={{ marginBottom: "16px", opacity: 0.5, margin: "0 auto 16px" }} />
            <p style={{ fontSize: "16px", marginBottom: "8px" }}>No audit events recorded</p>
            <p style={{ fontSize: "14px", color: "rgba(107, 114, 128, 0.7)" }}>System actions, approvals, and changes will be logged here.</p>
          </div>
        )}

        {!loading && events.length > 0 && (
          <div style={{ marginTop: "24px" }}>
            {events.slice(0, 20).map((event) => (
              <div key={event.id} style={{ display: "flex", gap: "12px", padding: "16px", borderBottom: "1px solid #e5e7eb", fontSize: "14px" }}>
                <span style={{ minWidth: "60px", color: "#9ca3af", fontVariantNumeric: "tabular-nums" }}>{event.time}</span>
                <span style={{ minWidth: "80px", color: "#6b7280", fontWeight: "600", textTransform: "uppercase", fontSize: "12px" }}>{event.actor}</span>
                <div style={{ flex: 1 }}>
                  <strong>{event.action}</strong>
                  <p style={{ color: "#6b7280", margin: "4px 0 0 0" }}>{event.detail}</p>
                </div>
                <span style={{ fontSize: "12px", fontWeight: "600", padding: "4px 8px", borderRadius: "4px", background: event.status.toLowerCase() === "success" ? "#d1fae5" : event.status.toLowerCase() === "pending" ? "#fef3c7" : "#fee2e2", color: event.status.toLowerCase() === "success" ? "#065f46" : event.status.toLowerCase() === "pending" ? "#92400e" : "#991b1b" }}>{event.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
