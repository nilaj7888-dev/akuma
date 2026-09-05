"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Package, AlertCircle, X, Sparkles } from "lucide-react";
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { MetricTile, MetricGrid } from "@/components/ui/metric-tile";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/mock-data";

type Product = { id: string; sku: string; name: string; category: string; price: number; stock: number; sold: number; margin: number };

type Suggestion = {
  suggestedName?: string;
  suggestedCategory?: string;
  suggestedDescription?: string;
  suggestedPrice?: number; // paise
  confidence?: number;
};

type FormData = {
  name: string;
  category: string;
  brand: string;
  model: string;
  description: string;
  price: number;
  cost: number;
  stock: number;
  specifications: string;
  imageUrl: string;
};

const EMPTY_FORM: FormData = {
  name: "",
  category: "Electronics",
  brand: "",
  model: "",
  description: "",
  price: 0,
  cost: 0,
  stock: 0,
  specifications: "",
  imageUrl: "",
};

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [imageName, setImageName] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await fetch("/api/inventory/products");
        const data = (await res.json()) as Product[];
        // The route always answers with an array for the signed-in merchant.
        // Showing mock products here used to hide real failures and made a
        // newly saved product indistinguishable from filler rows.
        setProducts(Array.isArray(data) ? data : []);
      } catch {
        setProducts([]);
      }
      setLoading(false);
    };
    void loadProducts();
  }, []);

  const stats = {
    total: products.length,
    lowStock: products.filter((p) => p.stock < 10).length,
    outOfStock: products.filter((p) => p.stock === 0).length,
    totalValue: products.reduce((sum, p) => sum + p.stock * p.price, 0),
  };

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { color: "error", label: "Out of stock" };
    if (stock < 10) return { color: "warning", label: "Low stock" };
    return { color: "success", label: "In stock" };
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setSuggestion(null);
    setImageName("");
    setImagePreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
  };

  const handleAddProduct = () => {
    setShowAddModal(true);
    setError("");
    resetForm();
  };

  const closeModal = () => {
    setShowAddModal(false);
    resetForm();
  };

  /**
   * Ask the existing analyze-image endpoint for suggestions. It is advisory
   * only: nothing is written to the form until the merchant hits "Use these",
   * and nothing is saved until they hit "Save Product".
   */
  const requestSuggestions = async (target: string) => {
    if (!target) return;
    setAnalyzing(true);
    setSuggestion(null);
    setError("");
    try {
      const res = await fetch("/api/products/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Could not analyze this image.");
      setSuggestion(data as Suggestion);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not analyze this image.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleImageFile = (file: File | undefined) => {
    if (!file) return;
    setImageName(file.name);
    setImagePreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    // The picked file stays local (this app has no upload storage yet), but its
    // name is enough for the existing analyzer to propose details.
    void requestSuggestions(file.name);
  };

  /** Fill only the fields the merchant has left empty, then clear the panel. */
  const applySuggestions = () => {
    if (!suggestion) return;
    setFormData((prev) => ({
      ...prev,
      name: prev.name || suggestion.suggestedName || "",
      category: suggestion.suggestedCategory || prev.category,
      description: prev.description || suggestion.suggestedDescription || "",
      price: prev.price || (suggestion.suggestedPrice ? suggestion.suggestedPrice / 100 : 0),
    }));
    setSuggestion(null);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.category || formData.price <= 0 || formData.stock < 0) {
      setError("Product name, category and a selling price above zero are required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/inventory/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          category: formData.category,
          brand: formData.brand || undefined,
          model: formData.model || undefined,
          description: formData.description || undefined,
          price: Math.round(formData.price * 100),
          cost: formData.cost ? Math.round(formData.cost * 100) : 0,
          stock: formData.stock,
          specifications: formData.specifications || undefined,
          imageUrl: formData.imageUrl || undefined,
        }),
      });

      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload.error?.message || "Failed to create product");
      }

      // The API returns the row already in this table's shape.
      setProducts((current) => [...current, payload.product as Product]);
      setShowAddModal(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageTransition>
      <section className="content">
        <header className="topbar">
          <div className="crumb">
            <span>Dashboard</span>
            <span>/</span>
            <strong>Inventory</strong>
          </div>
        </header>

        <div className="page-head">
          <FadeIn>
            <p className="eyebrow">INVENTORY MANAGEMENT</p>
            <h1>Product Inventory</h1>
            <p className="subhead">Monitor stock levels, pricing, and sales performance across your product catalog.</p>
          </FadeIn>
          <Button icon={<Package size={16} />} onClick={handleAddProduct}>
            Add product
          </Button>
        </div>

        <MetricGrid columns={4}>
          <MetricTile label="Total Products" value={stats.total} delta={`${stats.outOfStock} out of stock`} trend="down" />
          <MetricTile label="Low Stock" value={stats.lowStock} delta="Requires attention" trend="down" />
          <MetricTile label="Inventory Value" value={formatMoney(stats.totalValue)} delta="+8% vs last month" trend="up" />
          <MetricTile label="Avg Margin" value="24%" delta="+2 pts vs quarter" trend="up" />
        </MetricGrid>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ color: "var(--muted)" }}>Loading inventory...</p>
          </div>
        ) : products.length > 0 ? (
          <StaggerContainer delay={0.06}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line)" }}>
                    <th style={{ textAlign: "left", padding: "12px", color: "var(--muted)", fontWeight: "500" }}>Product</th>
                    <th style={{ textAlign: "left", padding: "12px", color: "var(--muted)", fontWeight: "500" }}>SKU</th>
                    <th style={{ textAlign: "left", padding: "12px", color: "var(--muted)", fontWeight: "500" }}>Price</th>
                    <th style={{ textAlign: "left", padding: "12px", color: "var(--muted)", fontWeight: "500" }}>Stock</th>
                    <th style={{ textAlign: "left", padding: "12px", color: "var(--muted)", fontWeight: "500" }}>Sold</th>
                    <th style={{ textAlign: "left", padding: "12px", color: "var(--muted)", fontWeight: "500" }}>Margin</th>
                    <th style={{ textAlign: "left", padding: "12px" }} />
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const stockStatus = getStockStatus(product.stock);
                    return (
                      <tr key={product.id} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "12px", color: "var(--ink)" }}>{product.name}</td>
                        <td style={{ padding: "12px", color: "var(--muted)" }}>{product.sku}</td>
                        <td style={{ padding: "12px", color: "var(--ink)" }}>{formatMoney(product.price)}</td>
                        <td style={{ padding: "12px" }}>
                          <Badge variant={stockStatus.color as any} size="sm">
                            {product.stock}
                          </Badge>
                        </td>
                        <td style={{ padding: "12px", color: "var(--ink)" }}>{product.sold}</td>
                        <td style={{ padding: "12px", color: "var(--green)" }}>{product.margin}%</td>
                        <td style={{ padding: "12px" }}>
                          <Button variant="ghost" size="sm" icon={<ArrowRight size={12} />} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </StaggerContainer>
        ) : (
          <EmptyState icon={Package} title="No products in inventory" description="Add your first product to get started" />
        )}

        {/* Add Product Modal */}
        {showAddModal && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}>
            <Card style={{ width: "100%", maxWidth: "600px", maxHeight: "90vh", overflowY: "auto" }}>
              <CardBody style={{ padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                  <h2 style={{ margin: 0 }}>Add Product</h2>
                  <button
                    onClick={closeModal}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {error && (
                  <div style={{ background: "var(--error-light)", color: "var(--error)", padding: "12px", borderRadius: "4px", marginBottom: "16px", fontSize: "12px" }}>
                    {error}
                  </div>
                )}

                <div style={{ display: "grid", gap: "16px" }}>
                  {/* Product Name */}
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px" }}>
                      Product Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Wireless Headphones"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid var(--line)",
                        borderRadius: "4px",
                        fontSize: "12px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  {/* Category & Brand */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px" }}>
                        Category *
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          border: "1px solid var(--line)",
                          borderRadius: "4px",
                          fontSize: "12px",
                          boxSizing: "border-box",
                        }}
                      >
                        <option>Electronics</option>
                        <option>Fashion</option>
                        <option>Furniture</option>
                        <option>Beauty</option>
                        <option>Sports</option>
                        <option>Books</option>
                        <option>Food</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px" }}>
                        Brand
                      </label>
                      <input
                        type="text"
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        placeholder="e.g., Sony"
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          border: "1px solid var(--line)",
                          borderRadius: "4px",
                          fontSize: "12px",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>

                  {/* Model & Description */}
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px" }}>
                      Model
                    </label>
                    <input
                      type="text"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      placeholder="e.g., WH-1000XM5"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid var(--line)",
                        borderRadius: "4px",
                        fontSize: "12px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px" }}>
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief product description"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid var(--line)",
                        borderRadius: "4px",
                        fontSize: "12px",
                        minHeight: "60px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  {/* Pricing */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px" }}>
                        Selling Price (₹) *
                      </label>
                      <input
                        type="number"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                        placeholder="0"
                        min="0"
                        step="0.01"
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          border: "1px solid var(--line)",
                          borderRadius: "4px",
                          fontSize: "12px",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px" }}>
                        Cost Price (₹)
                      </label>
                      <input
                        type="number"
                        value={formData.cost}
                        onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                        placeholder="0"
                        min="0"
                        step="0.01"
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          border: "1px solid var(--line)",
                          borderRadius: "4px",
                          fontSize: "12px",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>

                  {/* Stock & Specs */}
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px" }}>
                      Stock Quantity *
                    </label>
                    <input
                      type="number"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                      min="0"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid var(--line)",
                        borderRadius: "4px",
                        fontSize: "12px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px" }}>
                      Key Specifications
                    </label>
                    <textarea
                      value={formData.specifications}
                      onChange={(e) => setFormData({ ...formData, specifications: e.target.value })}
                      placeholder="e.g., Color: Black, Battery: 30hrs"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid var(--line)",
                        borderRadius: "4px",
                        fontSize: "12px",
                        minHeight: "60px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px" }}>
                      Product Image (optional)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageFile(e.target.files?.[0])}
                      style={{ width: "100%", fontSize: "12px", marginBottom: "8px" }}
                    />
                    <input
                      type="url"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      placeholder="https://example.com/image.jpg"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid var(--line)",
                        borderRadius: "4px",
                        fontSize: "12px",
                        boxSizing: "border-box",
                      }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Sparkles size={12} />}
                        disabled={analyzing || (!formData.imageUrl && !imageName)}
                        onClick={() => void requestSuggestions(formData.imageUrl || imageName)}
                      >
                        {analyzing ? "Analyzing..." : "Suggest details from image"}
                      </Button>
                      {imagePreview && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imagePreview}
                          alt="Selected product"
                          style={{ height: "36px", width: "36px", objectFit: "cover", borderRadius: "4px", border: "1px solid var(--line)" }}
                        />
                      )}
                    </div>
                    {imageName && (
                      <p style={{ fontSize: "10px", color: "var(--muted)", marginTop: "6px" }}>
                        Selected file stays on your device — only the URL above is saved with the product.
                      </p>
                    )}
                  </div>

                  {suggestion && (
                    <div style={{ border: "1px solid var(--amber)", borderRadius: "4px", padding: "12px" }}>
                      <p style={{ fontSize: "11px", fontWeight: 600, margin: "0 0 8px" }}>
                        AI suggestions{typeof suggestion.confidence === "number" ? ` · ${Math.round(suggestion.confidence * 100)}% confidence` : ""}
                      </p>
                      <ul style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 10px", paddingLeft: "16px" }}>
                        {suggestion.suggestedName && <li>Name: {suggestion.suggestedName}</li>}
                        {suggestion.suggestedCategory && <li>Category: {suggestion.suggestedCategory}</li>}
                        {suggestion.suggestedDescription && <li>Description: {suggestion.suggestedDescription}</li>}
                        {suggestion.suggestedPrice ? <li>Price: {formatMoney(suggestion.suggestedPrice / 100)}</li> : null}
                      </ul>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <Button size="sm" onClick={applySuggestions}>Use these</Button>
                        <Button variant="ghost" size="sm" onClick={() => setSuggestion(null)}>Dismiss</Button>
                      </div>
                      <p style={{ fontSize: "10px", color: "var(--muted)", margin: "8px 0 0" }}>
                        Suggestions only fill empty fields. Review everything before saving.
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", gap: "12px", marginTop: "24px", justifyContent: "flex-end" }}>
                  <Button
                    variant="ghost"
                    onClick={closeModal}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save Product"}
                  </Button>
                </div>
              </CardBody>
            </Card>
          </div>
        )}
      </section>
    </PageTransition>
  );
}
