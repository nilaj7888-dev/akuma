"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Gauge, ShieldCheck } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { showToast } from "@/components/toast";

type Policy = {
  id: string;
  maxDiscountPercent: number;
  maxCampaignBudget: number;
  maxSingleTransaction: number;
  requireApprovalAbove: number;
  minimumMarginPercent: number;
  autoApprovalEnabled: boolean;
  recommendationsEnabled: boolean;
  crossSellEnabled: boolean;
  upsellEnabled: boolean;
  conversationsEnabled: boolean;
  negotiationEnabled: boolean;
  campaignRecommendationsEnabled: boolean;
};

type BoolField = Extract<
  keyof Policy,
  "autoApprovalEnabled" | "recommendationsEnabled" | "crossSellEnabled" | "upsellEnabled" | "conversationsEnabled" | "negotiationEnabled" | "campaignRecommendationsEnabled"
>;

type NumberField = Extract<
  keyof Policy,
  "maxDiscountPercent" | "maxSingleTransaction" | "requireApprovalAbove" | "minimumMarginPercent"
>;

const TOGGLES: { field: BoolField; label: string; help: string }[] = [
  { field: "recommendationsEnabled", label: "Product recommendations", help: "AKUMA can surface recommended products to shoppers." },
  { field: "crossSellEnabled", label: "Cross-sell suggestions", help: "AKUMA can suggest related products alongside what a customer is viewing." },
  { field: "upsellEnabled", label: "Upsell suggestions", help: "AKUMA can suggest higher-value alternatives during a purchase." },
  { field: "conversationsEnabled", label: "AI chat with customers", help: "Customers can chat with the AI assistant about your catalog." },
  { field: "negotiationEnabled", label: "Price negotiation", help: "AKUMA can negotiate prices with customers within your limits." },
  { field: "campaignRecommendationsEnabled", label: "Campaign recommendations", help: "AKUMA can propose marketing campaigns for you to approve." },
  { field: "autoApprovalEnabled", label: "Auto-approve low-risk actions", help: "Actions under your limits below execute without waiting for manual approval." },
];

const LIMITS: { field: NumberField; label: string; help: string; suffix: string; min: number; max: number }[] = [
  { field: "maxDiscountPercent", label: "Maximum discount", help: "The largest discount AKUMA is allowed to offer on its own.", suffix: "%", min: 0, max: 100 },
  { field: "minimumMarginPercent", label: "Minimum margin", help: "AKUMA will never price a product below this margin.", suffix: "%", min: 0, max: 100 },
  { field: "maxSingleTransaction", label: "Max single transaction", help: "Transactions above this amount always require your approval.", suffix: "₹", min: 0, max: 100000000 },
  { field: "requireApprovalAbove", label: "Require approval above", help: "Any AI-proposed action expected to affect more than this amount needs your sign-off.", suffix: "₹", min: 0, max: 100000000 },
];

// Mirrors the Prisma Policy model's @default values, so a merchant who has
// never saved a policy still sees sensible starting values instead of a dead
// end — saving from here creates the row via the API's upsert.
const DEFAULT_POLICY: Omit<Policy, "id" | "maxCampaignBudget"> = {
  maxDiscountPercent: 10,
  maxSingleTransaction: 1000000,
  requireApprovalAbove: 100000,
  minimumMarginPercent: 15,
  autoApprovalEnabled: false,
  recommendationsEnabled: true,
  crossSellEnabled: true,
  upsellEnabled: true,
  conversationsEnabled: true,
  negotiationEnabled: false,
  campaignRecommendationsEnabled: true,
};

export default function PoliciesPage() {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [draft, setDraft] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/policy");
      if (res.ok) {
        const data = await res.json() as Policy | null;
        setPolicy(data);
        setDraft(data ?? { id: "", maxCampaignBudget: 0, ...DEFAULT_POLICY });
      } else {
        const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
        setLoadError(body?.error?.message || "Couldn't load your policy settings.");
      }
    } catch {
      setLoadError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const isNew = !policy;
  const dirty = draft && (isNew || JSON.stringify(policy) !== JSON.stringify(draft));

  const save = async () => {
    if (!draft || !dirty) return;
    setSaving(true);
    try {
      const res = await fetch("/api/policy", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recommendationsEnabled: draft.recommendationsEnabled,
          crossSellEnabled: draft.crossSellEnabled,
          upsellEnabled: draft.upsellEnabled,
          conversationsEnabled: draft.conversationsEnabled,
          negotiationEnabled: draft.negotiationEnabled,
          campaignRecommendationsEnabled: draft.campaignRecommendationsEnabled,
          autoApprovalEnabled: draft.autoApprovalEnabled,
          maxDiscountPercent: draft.maxDiscountPercent,
          minimumMarginPercent: draft.minimumMarginPercent,
          maxSingleTransaction: draft.maxSingleTransaction,
          requireApprovalAbove: draft.requireApprovalAbove,
        }),
      });
      if (res.ok) {
        const updated = await res.json() as Policy;
        setPolicy(updated);
        setDraft(updated);
        showToast("Policy settings saved.", "success");
      } else {
        const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
        showToast(body?.error?.message || "Couldn't save policy settings.", "error");
      }
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="shell">
      <section className="content">
        <header className="topbar">
          <div className="crumb">
            <Link href="/" className="crumb-link"><ArrowLeft size={14} /> Back</Link>
            <span>/</span>
            <strong>Policies</strong>
          </div>
        </header>

        <div className="page-head">
          <div>
            <p className="eyebrow">POLICIES</p>
            <h1>Merchant boundaries</h1>
            <p className="subhead">Configure AI permissions, discount limits, and approval thresholds.</p>
          </div>
          {dirty && (
            <Button variant="primary" onClick={save} loading={saving}>
              Save changes
            </Button>
          )}
        </div>

        {loading && (
          <div style={{ display: "grid", gap: "16px", padding: "20px" }}>
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}

        {!loading && loadError && (
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load policy settings"
            description={loadError}
            action={{ label: "Try again", onClick: () => void load() }}
          />
        )}

        {!loading && !loadError && draft && (
          <div style={{ display: "grid", gap: "20px", padding: "20px 20px 60px" }}>
            {isNew && (
              <div className="notice">
                <div className="notice-icon"><Gauge size={16} /></div>
                <p>You haven't configured AI policy limits yet. These are the defaults — adjust and save to create your policy.</p>
              </div>
            )}
            <Card>
              <CardBody>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <ShieldCheck size={18} style={{ color: "var(--amber)" }} />
                  <h2 style={{ fontSize: "15px", margin: 0 }}>AI permissions</h2>
                </div>
                <p style={{ color: "var(--muted)", fontSize: "13px", margin: "4px 0 20px" }}>
                  Control what AKUMA is allowed to do on your behalf, without asking first.
                </p>
                <div style={{ display: "grid", gap: "16px" }}>
                  {TOGGLES.map((t) => (
                    <label
                      key={t.field}
                      style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", cursor: "pointer" }}
                    >
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600 }}>{t.label}</div>
                        <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>{t.help}</div>
                      </div>
                      <span
                        onClick={() => setDraft({ ...draft, [t.field]: !draft[t.field] })}
                        style={{
                          flexShrink: 0,
                          width: "38px",
                          height: "22px",
                          borderRadius: "999px",
                          background: draft[t.field] ? "var(--amber)" : "var(--line)",
                          position: "relative",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: "2px",
                            left: draft[t.field] ? "18px" : "2px",
                            width: "18px",
                            height: "18px",
                            borderRadius: "50%",
                            background: "#fff",
                            transition: "left 0.15s ease",
                          }}
                        />
                      </span>
                    </label>
                  ))}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <Gauge size={18} style={{ color: "var(--amber)" }} />
                  <h2 style={{ fontSize: "15px", margin: 0 }}>Limits</h2>
                </div>
                <p style={{ color: "var(--muted)", fontSize: "13px", margin: "4px 0 20px" }}>
                  Hard boundaries AKUMA will never cross without your explicit sign-off.
                </p>
                <div style={{ display: "grid", gap: "18px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                  {LIMITS.map((l) => (
                    <div key={l.field}>
                      <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "6px" }}>{l.label}</label>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {l.suffix === "₹" && <span style={{ color: "var(--muted)" }}>₹</span>}
                        <input
                          type="number"
                          min={l.min}
                          max={l.max}
                          value={draft[l.field]}
                          onChange={(e) => {
                            const value = Math.max(l.min, Math.min(l.max, Number(e.target.value) || 0));
                            setDraft({ ...draft, [l.field]: value });
                          }}
                          style={{
                            width: "100%",
                            background: "var(--base)",
                            border: "1px solid var(--line)",
                            borderRadius: "6px",
                            padding: "8px 10px",
                            color: "var(--ink)",
                            fontSize: "13px",
                          }}
                        />
                        {l.suffix === "%" && <span style={{ color: "var(--muted)" }}>%</span>}
                      </div>
                      <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px" }}>{l.help}</p>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        )}
      </section>
    </main>
  );
}
