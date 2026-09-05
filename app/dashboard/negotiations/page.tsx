"use client";

import { useEffect, useState } from "react";
import { MessageSquare, AlertCircle, Check, X, Edit2 } from "lucide-react";
import { PageTransition, FadeIn } from "@/components/ui/animations";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { showToast } from "@/components/toast";

type Negotiation = {
  id: string;
  productId: string;
  productName?: string;
  quantity: number;
  originalPricePaise: number;
  originalPriceDisplay: string;
  requestedPricePaise: number;
  requestedPriceDisplay: string | null;
  discountPercent: number;
  totalValuePaise: number;
  totalValueDisplay: string;
  status: string;
  merchantApprovalRequired: boolean;
  createdAt: string;
};

export default function NegotiationsPage() {
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [responding, setResponding] = useState<string | null>(null);

  useEffect(() => {
    fetchNegotiations();
    // Poll every 3 seconds
    const interval = setInterval(fetchNegotiations, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchNegotiations = async () => {
    try {
      const res = await fetch("/api/merchant/negotiation");
      if (res.ok) {
        const data = await res.json();
        setNegotiations(data.negotiations || []);
      }
    } catch (error) {
      console.error("Failed to fetch negotiations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (negotiationId: string, decision: "APPROVE" | "REJECT" | "COUNTER", counterPrice?: number) => {
    setResponding(negotiationId);
    try {
      const res = await fetch(`/api/merchant/negotiation/${negotiationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          counterPrice: counterPrice ? Math.round(counterPrice * 100) : undefined,
        }),
      });

      if (res.ok) {
        await fetchNegotiations();
      } else {
        const error = await res.json();
        showToast(error.error?.message || "Failed to respond", "error");
      }
    } catch (error) {
      console.error("Error responding to negotiation:", error);
      showToast("Failed to respond to negotiation", "error");
    } finally {
      setResponding(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "OPEN":
      case "CUSTOMER_OFFER":
        return "warning";
      case "APPROVED":
        return "success";
      case "REJECTED":
        return "error";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, " ");
  };

  const filteredNegotiations = filter === "all"
    ? negotiations
    : negotiations.filter(n => n.status === filter);

  const activeCount = negotiations.filter(n =>
    ["OPEN", "CUSTOMER_OFFER", "AI_COUNTER"].includes(n.status)
  ).length;

  if (loading) {
    return (
      <section className="content">
        <div style={{ textAlign: "center", padding: "40px" }}>
          <p style={{ color: "var(--muted)" }}>Loading negotiations...</p>
        </div>
      </section>
    );
  }

  return (
    <PageTransition>
      <section className="content">
        <header className="topbar">
          <div className="crumb">
            <span>Dashboard</span>
            <span>/</span>
            <strong>Negotiations</strong>
          </div>
        </header>

        <div className="page-head">
          <FadeIn>
            <p className="eyebrow">PRICE NEGOTIATIONS</p>
            <h1>Customer Offers</h1>
            <p className="subhead">Review and respond to customer price negotiation requests.</p>
          </FadeIn>
        </div>

        {/* Filter Tabs */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "24px", borderBottom: "1px solid var(--line)", paddingBottom: "16px" }}>
          <button
            onClick={() => setFilter("all")}
            style={{
              padding: "8px 16px",
              background: filter === "all" ? "var(--accent)" : "transparent",
              color: filter === "all" ? "white" : "var(--text)",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "600",
            }}
          >
            All ({negotiations.length})
          </button>
          <button
            onClick={() => setFilter("OPEN")}
            style={{
              padding: "8px 16px",
              background: filter === "OPEN" ? "var(--amber)" : "transparent",
              color: filter === "OPEN" ? "white" : "var(--text)",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "600",
            }}
          >
            Awaiting Response ({activeCount})
          </button>
          <button
            onClick={() => setFilter("APPROVED")}
            style={{
              padding: "8px 16px",
              background: filter === "APPROVED" ? "var(--green)" : "transparent",
              color: filter === "APPROVED" ? "white" : "var(--text)",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "600",
            }}
          >
            Approved
          </button>
        </div>

        {filteredNegotiations.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={filter === "all" ? "No negotiations yet" : `No ${filter.toLowerCase()} negotiations`}
            description={filter === "all" ? "Customers will send price offers here" : ""}
          />
        ) : (
          <div style={{ display: "grid", gap: "16px" }}>
            {filteredNegotiations.map((negotiation) => {
              const discount = negotiation.discountPercent;
              const isAwaitingResponse = ["OPEN", "CUSTOMER_OFFER"].includes(negotiation.status);

              return (
                <Card key={negotiation.id} style={{ border: isAwaitingResponse ? "2px solid var(--amber)" : undefined }}>
                  <CardBody style={{ padding: "20px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "24px", alignItems: "start" }}>
                      {/* Left: Details */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "16px" }}>
                          <div>
                            <h3 style={{ margin: "0 0 4px 0", fontSize: "16px" }}>{negotiation.productName || "Product"}</h3>
                            <p style={{ margin: "0", fontSize: "12px", color: "var(--muted)" }}>
                              Qty: {negotiation.quantity} units
                            </p>
                          </div>
                          <Badge variant={getStatusColor(negotiation.status) as any} size="sm">
                            {getStatusLabel(negotiation.status)}
                          </Badge>
                        </div>

                        {/* Price Details */}
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "16px",
                          padding: "12px",
                          background: "var(--base)",
                          borderRadius: "8px",
                          marginBottom: "12px",
                        }}>
                          <div>
                            <p style={{ margin: "0 0 4px 0", fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: "600" }}>
                              List Price
                            </p>
                            <p style={{ margin: "0", fontSize: "16px", fontWeight: "700" }}>
                              {negotiation.originalPriceDisplay}
                            </p>
                            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--muted)" }}>
                              Total: {negotiation.totalValueDisplay}
                            </p>
                          </div>
                          <div>
                            <p style={{ margin: "0 0 4px 0", fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: "600" }}>
                              Customer Offer
                            </p>
                            <p style={{ margin: "0", fontSize: "16px", fontWeight: "700", color: "var(--amber)" }}>
                              {negotiation.requestedPriceDisplay || "—"}
                            </p>
                            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--amber)" }}>
                              {discount}% discount
                            </p>
                          </div>
                        </div>

                        {/* Approval Note */}
                        {negotiation.merchantApprovalRequired && (
                          <div style={{
                            padding: "10px 12px",
                            background: "var(--amber-light)",
                            color: "var(--amber)",
                            borderRadius: "6px",
                            fontSize: "12px",
                            display: "flex",
                            gap: "8px",
                            alignItems: "flex-start",
                          }}>
                            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
                            <span>This discount exceeds your policy limit</span>
                          </div>
                        )}
                      </div>

                      {/* Right: Actions */}
                      {isAwaitingResponse && (
                        <div style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                          minWidth: "120px",
                        }}>
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<Check size={14} />}
                            onClick={() => handleResponse(negotiation.id, "APPROVE")}
                            disabled={responding === negotiation.id}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Edit2 size={14} />}
                            onClick={() => {
                              const counter = prompt(
                                `Counter-offer (current offer: ₹${(negotiation.requestedPricePaise / 100).toLocaleString()}):`
                              );
                              if (counter) {
                                handleResponse(negotiation.id, "COUNTER", parseFloat(counter));
                              }
                            }}
                            disabled={responding === negotiation.id}
                          >
                            Counter
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<X size={14} />}
                            onClick={() => handleResponse(negotiation.id, "REJECT")}
                            disabled={responding === negotiation.id}
                          >
                            Decline
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Created Date */}
                    <p style={{
                      margin: "16px 0 0 0",
                      fontSize: "10px",
                      color: "var(--muted)",
                    }}>
                      Received {new Date(negotiation.createdAt).toLocaleDateString()} at {new Date(negotiation.createdAt).toLocaleTimeString()}
                    </p>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </PageTransition>
  );
}
