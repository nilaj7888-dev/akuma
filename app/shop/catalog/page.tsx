"use client";

import { useEffect, useState } from "react";
import { Search, Package, MapPin, Star } from "lucide-react";
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

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (search) params.append("search", search);
        if (category) params.append("category", category);

        const res = await fetch(`/api/shop/products?${params}`);
        if (res.ok) {
          const data = await res.json();
          setProducts(data);
        }
      } catch (error) {
        console.error("Failed to fetch products:", error);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchProducts, 300);
    return () => clearTimeout(debounceTimer);
  }, [search, category]);

  const categories = [
    "Electronics",
    "Fashion",
    "Furniture",
    "Food",
    "Services",
  ];

  return (
    <section className="content">
      <header className="topbar">
        <div className="crumb">
          <span>Shop</span>
          <span>/</span>
          <strong>Catalog</strong>
        </div>
      </header>

      <div className="page-head">
        <div>
          <p className="eyebrow">DISCOVER PRODUCTS</p>
          <h1>Browse & Negotiate</h1>
          <p className="subhead">Find products from merchants near you. Negotiate prices with AI.</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="catalog-controls">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search products or merchants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="category-filter">
          <button
            className={category === "" ? "active" : ""}
            onClick={() => setCategory("")}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={category === cat ? "active" : ""}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="loading-state">
          <p>Loading products...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <Package size={32} />
          <h3>No products found</h3>
          <p>Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="products-grid">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/shop/catalog/${product.id}`}
              className="product-card"
            >
              {product.imageUrl && (
                <div className="product-image">
                  <img src={product.imageUrl} alt={product.name} />
                </div>
              )}
              {!product.imageUrl && (
                <div className="product-image-placeholder">
                  <Package size={40} />
                </div>
              )}

              <div className="product-info">
                <div className="product-header">
                  <h3>{product.name}</h3>
                  <span className="category-badge">{product.category}</span>
                </div>

                <div className="merchant-info">
                  <p className="merchant-name">{product.merchant.name}</p>
                  {product.merchant.location && (
                    <span className="location">
                      <MapPin size={12} /> {product.merchant.location}
                    </span>
                  )}
                </div>

                <div className="product-footer">
                  <div className="price">
                    <span className="amount">₹{(product.price / 100).toLocaleString()}</span>
                    {product.stock > 0 ? (
                      <span className="stock in-stock">In stock</span>
                    ) : (
                      <span className="stock out-of-stock">Out of stock</span>
                    )}
                  </div>
                </div>

                <button
                  className="add-to-cart-btn"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                      const res = await fetch('/api/consumer/cart/items', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ productId: product.id, quantity: 1 })
                      });
                      if (res.ok) {
                        alert('Added to cart!');
                      } else {
                        alert('Failed to add - make sure you are logged in as consumer');
                      }
                    } catch (err) {
                      alert('Error adding to cart');
                    }
                  }}
                >
                  Add to Cart
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}

      <style jsx>{`
        .catalog-controls {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 32px;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
        }

        .search-box input {
          flex: 1;
          border: none;
          background: transparent;
          outline: none;
          font-size: 14px;
          color: var(--text);
        }

        .search-box input::placeholder {
          color: var(--muted);
        }

        .category-filter {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .category-filter button {
          padding: 8px 16px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: transparent;
          color: var(--text);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .category-filter button:hover {
          border-color: var(--accent);
          color: var(--accent);
        }

        .category-filter button.active {
          background: var(--accent);
          border-color: var(--accent);
          color: white;
        }

        .products-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
          margin-bottom: 40px;
        }

        .product-card {
          display: flex;
          flex-direction: column;
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          background: var(--surface);
          transition: all 0.3s;
          text-decoration: none;
        }

        .product-card:hover {
          border-color: var(--accent);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          transform: translateY(-2px);
        }

        .product-image {
          width: 100%;
          height: 200px;
          background: linear-gradient(135deg, #f0f0f0 0%, #e8e8e8 100%);
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .product-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .product-image-placeholder {
          width: 100%;
          height: 200px;
          background: linear-gradient(135deg, #f0f0f0 0%, #e8e8e8 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--muted);
        }

        .product-info {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
          flex: 1;
        }

        .product-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
        }

        .product-header h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 600;
          color: var(--text);
          flex: 1;
          line-height: 1.3;
        }

        .category-badge {
          font-size: 11px;
          padding: 4px 8px;
          background: var(--accent);
          color: white;
          border-radius: 4px;
          white-space: nowrap;
          text-transform: uppercase;
          font-weight: 600;
        }

        .merchant-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .merchant-name {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
        }

        .location {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: var(--muted);
        }

        .product-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 8px;
          border-top: 1px solid var(--border);
        }

        .price {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .amount {
          font-size: 18px;
          font-weight: 700;
          color: var(--accent);
        }

        .stock {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .stock.in-stock {
          color: var(--green);
        }

        .stock.out-of-stock {
          color: var(--red);
        }

        .add-to-cart-btn {
          padding: 10px 14px;
          background: var(--accent);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 8px;
        }

        .add-to-cart-btn:hover {
          background: var(--accent-dark);
          transform: scale(1.02);
        }

        .loading-state,
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          color: var(--muted);
          gap: 12px;
        }

        .empty-state h3 {
          margin: 0;
          color: var(--text);
          font-size: 18px;
        }
      `}</style>
    </section>
  );
}
