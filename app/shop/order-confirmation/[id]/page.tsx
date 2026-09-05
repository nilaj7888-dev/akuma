"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ArrowLeft } from "lucide-react";

type Order = {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    total: number;
    product: {
      name: string;
    };
  }>;
};

export default function OrderConfirmationPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = async (orderId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/consumer/orders/${orderId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch order");
      }
      const data = await res.json();
      setOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading order");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) {
      fetchOrder(params.id as string);
    }
  }, [params.id]);

  if (loading) {
    return (
      <section className="content">
        <p>Loading order confirmation...</p>
      </section>
    );
  }

  if (error || !order) {
    return (
      <section className="content">
        <p>{error || "Order not found"}</p>
        <Link href="/shop/catalog">← Back to catalog</Link>
      </section>
    );
  }

  return (
    <section className="content">
      <div className="confirmation-container">
        <div className="confirmation-icon">
          <Check size={48} />
        </div>
        <h1>Order Confirmed!</h1>
        <p className="order-id">Order ID: {order.id}</p>

        <div className="order-details">
          <h2>Order Summary</h2>
          <div className="items-list">
            {order.items.map((item) => (
              <div key={item.id} className="item">
                <div className="item-name">{item.product.name}</div>
                <div className="item-qty">x{item.quantity}</div>
                <div className="item-price">₹{(item.unitPrice / 100).toLocaleString()}/unit</div>
                <div className="item-total">₹{(item.total / 100).toLocaleString()}</div>
              </div>
            ))}
          </div>
          <div className="order-total">
            <span>Total</span>
            <span className="amount">₹{(order.amount / 100).toLocaleString()}</span>
          </div>
        </div>

        <div className="actions">
          <Link href="/shop/catalog">
            <button className="continue-btn">Continue Shopping</button>
          </Link>
          <Link href="/shop/orders">
            <button className="orders-btn">View All Orders</button>
          </Link>
        </div>
      </div>

      <style jsx>{`
        .content {
          padding: 24px;
          max-width: 800px;
          margin: 0 auto;
        }

        .confirmation-container {
          text-align: center;
          padding: 60px 24px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface);
        }

        .confirmation-icon {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: var(--green);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px auto;
        }

        h1 {
          margin: 0 0 8px 0;
          color: var(--text);
        }

        .order-id {
          color: var(--muted);
          font-size: 12px;
          margin-bottom: 40px;
        }

        .order-details {
          text-align: left;
          background: var(--bg);
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 32px;
        }

        .order-details h2 {
          margin: 0 0 16px 0;
          font-size: 14px;
          color: var(--text);
        }

        .items-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .item {
          display: grid;
          grid-template-columns: 1fr auto auto auto;
          gap: 16px;
          align-items: center;
          font-size: 13px;
          padding: 8px 0;
          border-bottom: 1px solid var(--border);
        }

        .item:last-child {
          border-bottom: none;
        }

        .item-name {
          color: var(--text);
        }

        .item-qty {
          color: var(--muted);
        }

        .item-price {
          color: var(--muted);
        }

        .item-total {
          font-weight: 600;
          text-align: right;
        }

        .order-total {
          display: flex;
          justify-content: space-between;
          padding-top: 16px;
          margin-top: 8px;
          border-top: 2px solid var(--border);
          font-size: 16px;
          font-weight: 600;
        }

        .order-total .amount {
          color: var(--accent);
        }

        .actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        .continue-btn,
        .orders-btn {
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          border: none;
        }

        .continue-btn {
          background: var(--accent);
          color: white;
        }

        .orders-btn {
          background: transparent;
          color: var(--accent);
          border: 1px solid var(--accent);
        }

        @media (max-width: 600px) {
          .item {
            grid-template-columns: 1fr auto;
            gap: 8px;
          }

          .item-price,
          .item-qty {
            display: none;
          }

          .actions {
            flex-direction: column;
          }
        }
      `}</style>
    </section>
  );
}
