"use client";

import Link from "next/link";
import { ArrowLeft, Zap } from "lucide-react";

export default function CampaignsPage() {
  return (
    <main className="shell">
      <section className="content">
        <header className="topbar">
          <div className="crumb">
            <Link href="/" className="crumb-link"><ArrowLeft size={14} /> Back</Link>
            <span>/</span>
            <strong>Campaigns</strong>
          </div>
        </header>

        <div className="page-head">
          <div>
            <p className="eyebrow">CAMPAIGNS</p>
            <h1>Active campaigns</h1>
            <p className="subhead">Create and manage marketing campaigns, discounts, and promotions.</p>
          </div>
        </div>

        <div style={{ padding: "60px 20px", textAlign: "center", background: "rgba(107, 114, 128, 0.05)", borderRadius: "12px", margin: "20px" }}>
          <Zap size={32} style={{ marginBottom: "16px", opacity: 0.5, margin: "0 auto 16px" }} />
          <p style={{ fontSize: "16px", marginBottom: "8px" }}>Campaign builder is coming soon</p>
          <p style={{ fontSize: "14px", color: "rgba(107, 114, 128, 0.7)" }}>Create, schedule, and monitor AI-powered campaigns.</p>
        </div>
      </section>
    </main>
  );
}
