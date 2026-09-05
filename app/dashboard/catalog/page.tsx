"use client";

import Link from "next/link";
import { ArrowLeft, Package } from "lucide-react";

export default function CatalogPage() {
  return (
    <main className="shell">
      <section className="content">
        <header className="topbar">
          <div className="crumb">
            <Link href="/" className="crumb-link"><ArrowLeft size={14} /> Back</Link>
            <span>/</span>
            <strong>Catalog</strong>
          </div>
        </header>

        <div className="page-head">
          <div>
            <p className="eyebrow">CATALOG</p>
            <h1>Product management</h1>
            <p className="subhead">Manage your product catalog, pricing, stock, and availability.</p>
          </div>
        </div>

        <div style={{ padding: "60px 20px", textAlign: "center", background: "rgba(107, 114, 128, 0.05)", borderRadius: "12px", margin: "20px" }}>
          <Package size={32} style={{ marginBottom: "16px", opacity: 0.5, margin: "0 auto 16px" }} />
          <p style={{ fontSize: "16px", marginBottom: "8px" }}>Catalog management is coming soon</p>
          <p style={{ fontSize: "14px", color: "rgba(107, 114, 128, 0.7)" }}>Upload products, manage pricing, and configure stock levels.</p>
        </div>
      </section>
    </main>
  );
}
