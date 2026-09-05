"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Package, MapPin, Truck, CreditCard } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

type OrderDetail = {
  id: string;
  status: string;
  amountDisplay: string;
  source: string;
  createdAt: string;
  customer: { name: string; email: string; phone: string | null } | null;
  deliveryAddress: {
    name: string;
    phone: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    postalCode: string;
  } | null;
  delivery: { distanceKm: number; estimatedCostDisplay: string } | null;
  items: Array<{ id: string; productName?: string; quantity: number; unitPriceDisplay: string; total: number }>;
  transaction: { razorpayPaymentId: string | null; status: string; verified: boolean } | null;
};

export default function MerchantOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/merchant/orders/${params.id}`);
        if (res.ok) {
          const data = await res.json();
          setOrder(data.order);
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [params.id]);

  if (loading) {
    return (
      <section className="content">
        <p style={{ color: "var(--muted)" }}>Loading order...</p>
      </section>
    );
  }

  if (notFound || !order) {
    return (
      <section className="content">
        <EmptyState icon={Package} title="Order not found" description="This order may have been removed, or you don't have access to it." />
      </section>
    );
  }

  return (
    <section className="content">
      <header className="topbar">
        <div className="crumb">
          <span>Dashboard</span>
          <span>/</span>
          <strong>Order {order.id.slice(0, 8)}</strong>
        </div>
      </header>

      <div className="page-head">
        <div>
          <p className="eyebrow">ORDER DETAIL</p>
          <h1>{order.amountDisplay}</h1>
          <p className="subhead">Placed {new Date(order.createdAt).toLocaleString()} via {order.source}</p>
        </div>
        <Badge variant={order.status === "CONFIRMED" ? "green" : "amber"} size="sm">{order.status.replace(/_/g, " ")}</Badge>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
        <Card>
          <CardHeader><h3 style={{ margin: 0, fontSize: "14px" }}>Items</h3></CardHeader>
          <CardBody>
            <div style={{ display: "grid", gap: "8px" }}>
              {order.items.map((item) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span>{item.productName ?? "Product"} × {item.quantity}</span>
                  <strong>{item.unitPriceDisplay}</strong>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h3 style={{ margin: 0, fontSize: "14px" }}>Customer</h3></CardHeader>
          <CardBody>
            {order.customer ? (
              <div style={{ fontSize: "13px", display: "grid", gap: "4px" }}>
                <strong>{order.customer.name}</strong>
                <span style={{ color: "var(--muted)" }}>{order.customer.email}</span>
                {order.customer.phone && <span style={{ color: "var(--muted)" }}>{order.customer.phone}</span>}
              </div>
            ) : (
              <p style={{ fontSize: "13px", color: "var(--muted)" }}>No customer record.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <MapPin size={15} />
            <h3 style={{ margin: 0, fontSize: "14px" }}>Delivery</h3>
          </div>
        </CardHeader>
        <CardBody>
          {order.deliveryAddress ? (
            <div style={{ display: "grid", gap: "12px" }}>
              <div style={{ fontSize: "13px" }}>
                <strong>{order.deliveryAddress.name}</strong>
                <p style={{ margin: "4px 0 0 0", color: "var(--muted)" }}>
                  {[order.deliveryAddress.addressLine1, order.deliveryAddress.addressLine2, order.deliveryAddress.city, order.deliveryAddress.state, order.deliveryAddress.postalCode].filter(Boolean).join(", ")}
                </p>
                <p style={{ margin: "4px 0 0 0", color: "var(--muted)" }}>{order.deliveryAddress.phone}</p>
              </div>
              {order.delivery ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", background: "var(--base)", borderRadius: "8px", fontSize: "13px" }}>
                  <Truck size={15} style={{ color: "var(--amber)" }} />
                  <span>~{order.delivery.distanceKm} km away · estimated delivery cost <strong>{order.delivery.estimatedCostDisplay}</strong></span>
                </div>
              ) : (
                <p style={{ fontSize: "12px", color: "var(--muted)" }}>Set your store location in Profile to see an estimated delivery cost for this order.</p>
              )}
            </div>
          ) : (
            <p style={{ fontSize: "13px", color: "var(--muted)" }}>No delivery address on this order.</p>
          )}
        </CardBody>
      </Card>

      {order.transaction && (
        <Card style={{ marginTop: "16px" }}>
          <CardHeader>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <CreditCard size={15} />
              <h3 style={{ margin: 0, fontSize: "14px" }}>Payment</h3>
            </div>
          </CardHeader>
          <CardBody>
            <div style={{ fontSize: "13px", display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>{order.transaction.razorpayPaymentId ?? "—"}</span>
              <Badge variant={order.transaction.verified ? "green" : "amber"} size="sm">{order.transaction.status}</Badge>
            </div>
          </CardBody>
        </Card>
      )}
    </section>
  );
}
