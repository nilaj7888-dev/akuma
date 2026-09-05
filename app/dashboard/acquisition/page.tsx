"use client";

import { PageTransition, FadeIn } from "@/components/ui/animations";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function AcquisitionPage() {
  return (
    <PageTransition>
      <section className="content">
        <header className="topbar">
          <div className="crumb">
            <span>Dashboard</span>
            <span>/</span>
            <strong>Acquisition</strong>
          </div>
        </header>

        <div className="page-head">
          <FadeIn>
            <p className="eyebrow">CUSTOMER ACQUISITION</p>
            <h1>Acquisition Metrics</h1>
            <p className="subhead">Track new customer growth and acquisition channels.</p>
          </FadeIn>
        </div>

        <Card>
          <CardBody style={{ textAlign: "center", padding: "60px 24px" }}>
            <AlertCircle size={48} style={{ color: "var(--muted)", margin: "0 auto 16px" }} />
            <p style={{ fontSize: "14px", color: "var(--ink)", margin: "0 0 8px 0" }}>
              Acquisition data coming soon
            </p>
            <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
              This dashboard will show new customer acquisition metrics, channels, and trends.
            </p>
          </CardBody>
        </Card>
      </section>
    </PageTransition>
  );
}
