"use client";

import Link from "next/link";
import { ArrowLeft, Gauge } from "lucide-react";

export default function PoliciesPage() {
  return (
    <main className="shell">
      <section className="content">
        <header className="topbar">
          <div className="crumb">
            <Link href="/" className="crumb-link"><ArrowLeft size={14} /> Back</Link>
            <span>/</span>
            <strong>Policies</strong>
          </div>
        </header>

        <div className="page-head">
          <div>
            <p className="eyebrow">POLICIES</p>
            <h1>Merchant boundaries</h1>
            <p className="subhead">Configure AI permissions, discount limits, and approval thresholds.</p>
          </div>
        </div>

        <div style={{ padding: "60px 20px", textAlign: "center", background: "rgba(107, 114, 128, 0.05)", borderRadius: "12px", margin: "20px" }}>
          <Gauge size={32} style={{ marginBottom: "16px", opacity: 0.5, margin: "0 auto 16px" }} />
          <p style={{ fontSize: "16px", marginBottom: "8px" }}>Policy configuration is coming soon</p>
          <p style={{ fontSize: "14px", color: "rgba(107, 114, 128, 0.7)" }}>Set discount limits, approval thresholds, and AI permissions.</p>
        </div>
      </section>
    </main>
  );
}
