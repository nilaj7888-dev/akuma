"use client";

import { useEffect, useState } from "react";
import { Package, Calendar, DollarSign, Truck } from "lucide-react";
import Link from "next/link";

type OrderItem = {
  id: string;
  productName: string;
  quantity: number;
  unitPriceDisplay: string;
  totalDisplay: string;
};

type Order = {
  id: string;
  merchantName: string;
  status: string;
  amountDisplay: string;
  items: OrderItem[];
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch("/api/consumer/orders");
        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders || []);
        }
      } finally {
        setLoading(false);
      }
    };
    void fetchOrders();
  }, []);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "green";
      case "PAID":
        return "green";
      case "PROCESSING":
        return "amber";
      case "AWAITING_MERCHANT_CONFIRMATION":
        return "amber";
      case "NEGOTIATION":
        return "blue";
      case "PENDING":
        return "amber";
      case "FAILED":
        return "red";
      case "CANCELLED":
        return "red";
      default:
        return "muted";
    }
  };

  if (loading) {
    return (
      <div className="content">
        <div className="topbar">
          <div className="crumb">
            <span>SHOP</span>
            <span>→</span>
            <strong>ORDERS</strong>
          </div>
        </div>
        <div className="page-head">
          <p className="eyebrow">ORDER HISTORY</p>
          <h1>Loading...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <div className="topbar">
        <div className="crumb">
          <span>SHOP</span>
          <span>→</span>
          <strong>ORDERS</strong>
        </div>
      </div>
      <div className="page-head">
        <div>
          <p className="eyebrow">ORDER HISTORY</p>
          <h1>{orders.length === 0 ? "No orders yet" : `${orders.length} order${orders.length !== 1 ? "s" : ""}`}</h1>
          <p className="subhead">Track your purchases and order status.</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="notice">
          <div className="notice-icon"><Package size={16} /></div>
          <p>You haven&apos;t placed any orders yet. Start shopping with AKUMA to see them here.</p>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => (
            <Link key={order.id} href={`/shop/orders/${order.id}`}>
              <div className="order-card">
                <div className="order-header">
                  <div>
                    <div className="order-merchant">{order.merchantName}</div>
                    <div className="order-id">Order #{order.id.slice(0, 8)}</div>
                  </div>
                  <div className={`order-status ${getStatusBadgeColor(order.status)}`}>
                    {order.status.replace(/_/g, " ")}
                  </div>
                </div>

                <div className="order-items">
                  {order.items.map((item) => (
                    <div key={item.id} className="order-item">
                      <span className="item-name">{item.productName}</span>
                      <span className="item-qty">× {item.quantity}</span>
                      <span className="item-price">{item.totalDisplay}</span>
                    </div>
                  ))}
                </div>

                <div className="order-footer">
                  <div className="order-total">
                    <span>Total:</span>
                    <strong>{order.amountDisplay}</strong>
                  </div>
                  <div className="order-meta">
                    <div className="meta-item">
                      <Calendar size={14} />
                      <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="meta-item">
                      <Truck size={14} />
                      <span>{order.paymentStatus}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <style jsx>{`
        .orders-list {
          display: grid;
          gap: 12px;
          margin-top: 24px;
        }

        .order-card {
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 16px;
          background: var(--panel);
          cursor: pointer;
          transition: all 0.2s;
        }

        .order-card:hover {
          border-color: var(--amber);
          transform: translateY(-2px);
        }

        .order-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .order-merchant {
          font-weight: 600;
          font-size: 14px;
          color: var(--ink);
        }

        .order-id {
          font-size: 12px;
          color: var(--muted);
          margin-top: 4px;
        }

        .order-status {
          font-size: 11px;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .order-status.green {
          background: rgba(74, 222, 128, 0.1);
          color: #4ade80;
        }

        .order-status.amber {
          background: rgba(251, 146, 60, 0.1);
          color: #fb923c;
        }

        .order-status.blue {
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
        }

        .order-status.red {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }

        .order-status.muted {
          background: rgba(107, 114, 128, 0.1);
          color: var(--muted);
        }

        .order-items {
          display: grid;
          gap: 8px;
          margin-bottom: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--line);
        }

        .order-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
        }

        .item-name {
          flex: 1;
          color: var(--ink);
        }

        .item-qty {
          color: var(--muted);
          margin: 0 8px;
        }

        .item-price {
          font-weight: 600;
          color: var(--ink);
        }

        .order-footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }

        .order-total {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .order-total span {
          font-size: 12px;
          color: var(--muted);
        }

        .order-total strong {
          font-size: 16px;
          color: var(--ink);
        }

        .order-meta {
          display: flex;
          gap: 12px;
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: var(--muted);
        }
      `}</style>
    </div>
  );
}
