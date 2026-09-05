"use client";

import { showToast } from "@/components/toast";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, MapPin, Package, MessageSquare } from "lucide-react";
import Link from "next/link";

type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  imageUrl: string | null;
  description: string | null;
  merchant: {
    id: string;
    name: string;
    location: string | null;
  };
};

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`/api/shop/products`);
        if (res.ok) {
          const products = await res.json();
          const found = products.find((p: Product) => p.id === params.id);
          setProduct(found || null);
        }
      } catch (error) {
        console.error("Failed to fetch product:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [params.id]);

  if (loading) {
    return (
      <section className="content">
        <p>Loading product...</p>
      </section>
    );
  }

  if (!product) {
    return (
      <section className="content">
        <p>Product not found</p>
        <Link href="/shop/catalog">← Back to catalog</Link>
      </section>
    );
  }

  return (
    <section className="content">
      <header className="topbar">
        <Link href="/shop/catalog" className="back-link">
          <ArrowLeft size={16} /> Back to catalog
        </Link>
      </header>

      <div className="product-detail">
        <div className="product-detail-image">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} />
          ) : (
            <div className="image-placeholder">
              <Package size={80} />
            </div>
          )}
        </div>

        <div className="product-detail-info">
          <span className="category-badge">{product.category}</span>
          <h1>{product.name}</h1>

          <div className="merchant-card">
            <div className="merchant-details">
              <strong>{product.merchant.name}</strong>
              {product.merchant.location && (
                <span className="location">
                  <MapPin size={14} /> {product.merchant.location}
                </span>
              )}
            </div>
          </div>

          <div className="price-section">
            <div className="price-amount">
              <span className="label">Price</span>
              <span className="amount">₹{(product.price / 100).toLocaleString()}</span>
            </div>
            <div className="stock-status">
              {product.stock > 0 ? (
                <span className="in-stock">✓ In Stock ({product.stock} available)</span>
              ) : (
                <span className="out-of-stock">✗ Out of Stock</span>
              )}
            </div>
          </div>

          {product.description && (
            <div className="description-section">
              <h3>Description</h3>
              <p>{product.description}</p>
            </div>
          )}

          <div className="action-buttons">
            <button
              className="add-to-cart-btn"
              onClick={async () => {
                try {
                  const res = await fetch('/api/consumer/cart/items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productId: product.id, quantity: 1 })
                  });
                  if (res.ok) {
                    showToast("Added to cart. Go to your cart to checkout or negotiate.", "success");
                  } else {
                    showToast("Couldn't add to cart. Make sure you're logged in as a consumer.", "error");
                  }
                } catch (err) {
                  showToast("Something went wrong adding this to your cart.", "error");
                }
              }}
            >
              <MessageSquare size={18} />
              Add to Cart
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--text);
          text-decoration: none;
          font-size: 14px;
          transition: color 0.2s;
        }

        .back-link:hover {
          color: var(--accent);
        }

        .product-detail {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin-top: 24px;
        }

        .product-detail-image {
          width: 100%;
          aspect-ratio: 1;
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          background: linear-gradient(135deg, #f0f0f0 0%, #e8e8e8 100%);
        }

        .product-detail-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .image-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--muted);
        }

        .product-detail-info {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .category-badge {
          align-self: flex-start;
          font-size: 12px;
          padding: 6px 12px;
          background: var(--accent);
          color: white;
          border-radius: 6px;
          text-transform: uppercase;
          font-weight: 600;
        }

        h1 {
          margin: 0;
          font-size: 32px;
          color: var(--text);
        }

        .merchant-card {
          padding: 16px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
        }

        .merchant-details {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .merchant-details strong {
          font-size: 15px;
          color: var(--text);
        }

        .location {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--muted);
        }

        .price-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 20px;
          border: 2px solid var(--accent);
          border-radius: 12px;
          background: var(--surface);
        }

        .price-amount {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .price-amount .label {
          font-size: 13px;
          color: var(--muted);
          text-transform: uppercase;
          font-weight: 600;
        }

        .price-amount .amount {
          font-size: 36px;
          font-weight: 700;
          color: var(--accent);
        }

        .stock-status {
          font-size: 14px;
          font-weight: 600;
        }

        .in-stock {
          color: var(--green);
        }

        .out-of-stock {
          color: var(--red);
        }

        .description-section {
          padding: 20px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
        }

        .description-section h3 {
          margin: 0 0 12px 0;
          font-size: 16px;
          color: var(--text);
        }

        .description-section p {
          margin: 0;
          line-height: 1.6;
          color: var(--text);
        }

        .action-buttons {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }

        .add-to-cart-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 16px 24px;
          background: var(--accent);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .add-to-cart-btn:hover {
          background: var(--accent-dark);
          transform: scale(1.02);
        }

        @media (max-width: 768px) {
          .product-detail {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
