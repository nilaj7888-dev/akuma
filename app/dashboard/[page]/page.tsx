"use client";

import { PageTransition, FadeIn } from "@/components/ui/animations";
import { Card, CardBody } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

const pages = [
  { path: "daily", title: "Daily Performance", desc: "Today's performance vs yesterday" },
  { path: "approvals", title: "Approvals", desc: "Pending approval workflows" },
  { path: "audit", title: "Audit Trail", desc: "System activity and compliance" },
  { path: "policies", title: "Policies", desc: "Merchant policy configuration" },
  { path: "catalog", title: "Catalog", desc: "Product catalog browser" },
  { path: "agent", title: "Agent Console", desc: "AI agent interaction" },
  { path: "requests", title: "Requests", desc: "Customer and system requests" },
];

export default function PlaceholderPage({ params }: { params: { page: string } }) {
  const pageInfo = pages.find((p) => p.path === params.page) || { title: "Page", desc: "Coming soon" };

  return (
    <PageTransition>
      <section className="content">
        <header className="topbar">
          <div className="crumb">
            <span>Dashboard</span>
            <span>/</span>
            <strong>{pageInfo.title}</strong>
          </div>
        </header>

        <div className="page-head">
          <FadeIn>
            <p className="eyebrow">{pageInfo.title.toUpperCase()}</p>
            <h1>{pageInfo.title}</h1>
            <p className="subhead">{pageInfo.desc}</p>
          </FadeIn>
        </div>

        <Card>
          <CardBody style={{ textAlign: "center", padding: "60px 24px" }}>
            <AlertCircle size={48} style={{ color: "var(--muted)", margin: "0 auto 16px" }} />
            <p style={{ fontSize: "14px", color: "var(--ink)", margin: "0 0 8px 0" }}>
              {pageInfo.title} dashboard coming soon
            </p>
            <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
              This dashboard will display comprehensive {pageInfo.title.toLowerCase()} data and controls.
            </p>
          </CardBody>
        </Card>
      </section>
    </PageTransition>
  );
}
