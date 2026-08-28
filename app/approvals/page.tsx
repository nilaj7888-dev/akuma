"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle } from "lucide-react";

export default function ApprovalsPage() {
  return (
    <main className="shell">
      <section className="content">
        <header className="topbar">
          <div className="crumb">
            <Link href="/" className="crumb-link"><ArrowLeft size={14} /> Back</Link>
            <span>/</span>
            <strong>Approvals</strong>
          </div>
        </header>

        <div className="page-head">
          <div>
            <p className="eyebrow">APPROVALS</p>
            <h1>Pending decisions</h1>
            <p className="subhead">Review and approve AI-proposed actions that require your decision.</p>
          </div>
        </div>

        <div style={{ padding: "60px 20px", textAlign: "center", background: "rgba(107, 114, 128, 0.05)", borderRadius: "12px", margin: "20px" }}>
          <CheckCircle size={32} style={{ marginBottom: "16px", opacity: 0.5, margin: "0 auto 16px" }} />
          <p style={{ fontSize: "16px", marginBottom: "8px" }}>No pending approvals</p>
          <p style={{ fontSize: "14px", color: "rgba(107, 114, 128, 0.7)" }}>When AKUMA proposes an action that requires your approval, it will appear here.</p>
        </div>
      </section>
    </main>
  );
}
