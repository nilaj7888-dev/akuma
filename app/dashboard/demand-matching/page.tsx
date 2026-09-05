"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, TrendingUp, Target, MapPin, Calendar, DollarSign, Package, CheckCircle, AlertCircle, Sparkles } from "lucide-react";
import { PageTransition, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { MetricTile, MetricGrid } from "@/components/ui/metric-tile";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/format";
import { showToast } from "@/components/toast";

interface BuyerDemandMatch {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  originalProduct: {
    name: string;
    merchant: string;
    price: number;
  };
  matchedProduct: {
    id: string;
    name: string;
    price: number;
  };
  quantity: number;
  preferredPrice: number | null;
  matchScore: number;
  matchReasons: string[];
  createdAt: string;
  status: string;
}

interface Opportunity {
  id: string;
  title: string;
  description: string;
  confidence: number;
  expectedRevenue: number;
  evidence: any;
  createdAt: string;
  status: string;
}

interface Metrics {
  totalMatches: number;
  highConfidence: number;
  potentialRevenue: number;
  readyToAct: number;
}

export default function DemandMatchingPage() {
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [potentialMatches, setPotentialMatches] = useState<BuyerDemandMatch[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({ totalMatches: 0, highConfidence: 0, potentialRevenue: 0, readyToAct: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeTab, setActiveTab] = useState<"opportunities" | "buyers">("opportunities");

  const loadData = async () => {
      setLoadError(false);
      try {
        const res = await fetch("/api/dashboard/demand-matching");
        if (res.ok) {
          const data = await res.json();
          setOpportunities(data.opportunities || []);
          setPotentialMatches(data.potentialMatches || []);
          setMetrics(data.metrics || { totalMatches: 0, highConfidence: 0, potentialRevenue: 0, readyToAct: 0 });
        } else {
          throw new Error("Failed to load data");
        }
      } catch (error) {
        console.error("Error loading demand matching data:", error);
        setOpportunities([]);
        setPotentialMatches([]);
        setMetrics({ totalMatches: 0, highConfidence: 0, potentialRevenue: 0, readyToAct: 0 });
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateOffer = async (match: BuyerDemandMatch) => {
    // Navigate to negotiation creation with prefilled data using Next.js router
    router.push(`/negotiation/create?buyerInterestId=${match.id}&productId=${match.matchedProduct.id}&quantity=${match.quantity}&suggestedPrice=${match.preferredPrice}`);
  };

  const handleAnalyzeMore = async () => {
    try {
      const res = await fetch("/api/ai/analyze-demand", { method: "POST" });
      if (res.ok) {
        showToast("Scanning marketplace activity for new matches...", "info");
        setTimeout(() => {
          void loadData();
        }, 2000);
      } else {
        showToast("Couldn't start the analysis. Try again in a moment.", "error");
      }
    } catch {
      showToast("Couldn't start the analysis. Try again in a moment.", "error");
    }
  };

  const getMatchBadge = (score: number) => {
    if (score >= 90) return { variant: "success" as const, label: "High Match" };
    if (score >= 75) return { variant: "amber" as const, label: "Good Match" };
    if (score >= 60) return { variant: "warning" as const, label: "Moderate Match" };
    return { variant: "info" as const, label: "Low Match" };
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-IN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <PageTransition>
      <section className="content">
        <header className="topbar">
          <div className="crumb">
            <span>Dashboard</span>
            <span>/</span>
            <strong>Demand Matching</strong>
          </div>
        </header>

        <div className="page-head">
          <FadeIn>
            <p className="eyebrow">BUYER DEMAND INTELLIGENCE</p>
            <h1>Find Buyers Looking for Your Products</h1>
            <p className="subhead">AKUMA automatically matches buyer demands from other merchants to your catalog. Create instant opportunities.</p>
          </FadeIn>
          <Button icon={<Sparkles size={16} />} onClick={handleAnalyzeMore}>
            Find More Matches
          </Button>
        </div>

        {!loading && !loadError && metrics.totalMatches > 0 && (
          <MetricGrid columns={3}>
            <MetricTile label="Total Matches" value={metrics.totalMatches} icon={Users} delta={`${metrics.highConfidence} high confidence`} trend="up" />
            <MetricTile label="Potential Revenue" value={formatMoney(metrics.potentialRevenue)} icon={TrendingUp} delta="Across open matches" trend="up" />
            <MetricTile label="Ready to Act" value={metrics.readyToAct} icon={Target} delta="Immediate opportunities" trend="neutral" />
          </MetricGrid>
        )}

        <div className="section-heading">
          <div>
            <p className="eyebrow">BUYER DEMAND DASHBOARD</p>
            <h2>Recent Buyer Demand Matches</h2>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button variant={activeTab === "opportunities" ? "primary" : "secondary"} size="sm" onClick={() => setActiveTab("opportunities")}>
              Opportunities ({opportunities.length})
            </Button>
            <Button variant={activeTab === "buyers" ? "primary" : "secondary"} size="sm" onClick={() => setActiveTab("buyers")}>
              Buyers ({potentialMatches.length})
            </Button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <p style={{ color: "var(--muted)" }}>Loading buyer demand intelligence...</p>
          </div>
        ) : loadError ? (
          <EmptyState icon={AlertCircle} title="Couldn't load demand matches" description="The request failed. Check your connection and try again." action={{ label: "Retry", onClick: () => loadData() }} />
        ) : activeTab === "buyers" && potentialMatches.length > 0 ? (
          <StaggerContainer delay={0.08}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))", gap: "20px" }}>
              {potentialMatches.map((match) => {
                const badge = getMatchBadge(match.matchScore);
                const potentialTotal = match.preferredPrice ? match.preferredPrice / 100 : match.matchedProduct.price * match.quantity / 100;

                return (
                  <StaggerItem key={match.id}>
                    <Card gradient hover>
                      <CardHeader>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "12px" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                              <Badge variant={badge.variant} size="sm">
                                {badge.label} ({match.matchScore}%)
                              </Badge>
                              <span style={{ fontSize: "10px", color: "var(--muted)" }}>
                                {formatDate(match.createdAt)}
                              </span>
                            </div>
                            <h3 style={{ fontSize: "16px", margin: "0 0 4px 0" }}>{match.buyerName}</h3>
                            <p style={{ fontSize: "11px", color: "var(--muted)", margin: 0 }}>
                              Looking for: "{match.originalProduct.name}"
                            </p>
                            <p style={{ fontSize: "10px", color: "var(--muted)", margin: "4px 0 0 0" }}>
                              Originally from: {match.originalProduct.merchant}
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardBody>
                        <div style={{ marginBottom: "16px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                            <div style={{ background: "var(--panel)", padding: "12px", borderRadius: "6px" }}>
                              <p style={{ fontSize: "10px", color: "var(--muted)", margin: "0 0 4px 0" }}>
                                <Package size={12} style={{ display: "inline", marginRight: "4px" }} />
                                Quantity
                              </p>
                              <p style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>{match.quantity} units</p>
                            </div>
                            <div style={{ background: "var(--panel)", padding: "12px", borderRadius: "6px" }}>
                              <p style={{ fontSize: "10px", color: "var(--muted)", margin: "0 0 4px 0" }}>
                                <DollarSign size={12} style={{ display: "inline", marginRight: "4px" }} />
                                Potential Value
                              </p>
                              <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "var(--green)" }}>
                                ₹{potentialTotal.toLocaleString("en-IN")}
                              </p>
                            </div>
                          </div>

                          <div style={{ background: "var(--panel)", padding: "12px", borderRadius: "6px", marginBottom: "12px" }}>
                            <p style={{ fontSize: "10px", color: "var(--muted)", margin: "0 0 6px 0" }}>Match Reasons:</p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                              {match.matchReasons.map((reason, idx) => (
                                <Badge key={idx} variant="info" size="sm">
                                  {reason}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <div style={{ background: "var(--panel)", padding: "12px", borderRadius: "6px" }}>
                            <p style={{ fontSize: "10px", color: "var(--muted)", margin: "0 0 6px 0" }}>
                              <AlertCircle size={12} style={{ display: "inline", marginRight: "4px" }} />
                              Your Matching Product
                            </p>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <p style={{ fontSize: "13px", margin: "0 0 2px 0", fontWeight: "500" }}>{match.matchedProduct.name}</p>
                                <p style={{ fontSize: "11px", color: "var(--muted)", margin: 0 }}>
                                  Price: ₹{(match.matchedProduct.price / 100).toLocaleString("en-IN")} per unit
                                </p>
                              </div>
                              <Badge variant="success" size="sm">
                                Match Found
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "8px" }}>
                          <Button variant="primary" size="sm" style={{ flex: 1 }} onClick={() => handleCreateOffer(match)}>
                            Create Offer
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  </StaggerItem>
                );
              })}
            </div>
          </StaggerContainer>
        ) : activeTab === "opportunities" && opportunities.length > 0 ? (
          <StaggerContainer delay={0.08}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
              {opportunities.map((opp) => (
                <StaggerItem key={opp.id}>
                  <Card gradient hover>
                    <CardHeader>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "8px" }}>
                        <div>
                          <p style={{ fontSize: "10px", color: "var(--amber)", fontWeight: "500", marginBottom: "4px" }}>
                            BUYER_DEMAND_MATCH
                          </p>
                          <h3 style={{ fontSize: "16px", margin: 0 }}>{opp.title}</h3>
                        </div>
                        <Badge variant={opp.confidence > 80 ? "success" : opp.confidence > 60 ? "warning" : "info"} size="sm">
                          {opp.confidence}%
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardBody>
                      <p style={{ fontSize: "11px", color: "var(--muted)", lineHeight: "1.5", marginBottom: "12px" }}>{opp.description}</p>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "10px", marginBottom: "12px" }}>
                        <div>
                          <p style={{ color: "var(--muted)", margin: "0 0 4px 0" }}>Revenue Impact</p>
                          <p style={{ margin: 0, fontSize: "13px", color: "var(--green)" }}>{formatMoney(opp.expectedRevenue)}</p>
                        </div>
                        <div>
                          <p style={{ color: "var(--muted)", margin: "0 0 4px 0" }}>Created</p>
                          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>{formatDate(opp.createdAt)}</p>
                        </div>
                      </div>

                      <Button variant="primary" size="sm" style={{ width: "100%" }} onClick={() => router.push("/dashboard/opportunities")}>
                        Review in Opportunities
                      </Button>
                    </CardBody>
                  </Card>
                </StaggerItem>
              ))}
            </div>
          </StaggerContainer>
        ) : (
          <EmptyState
            icon={Users}
            title="No demand matches found"
            description="When buyers express interest in products similar to yours, they'll appear here automatically."
            action={{
              label: "Add more products to your catalog",
              onClick: () => router.push("/dashboard/inventory")
            }}
          />
        )}

        {/* How It Works Section */}
        <div className="section-heading">
          <p className="eyebrow">HOW IT WORKS</p>
          <h2>AKUMA Demand Matching Engine</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px", marginTop: "20px" }}>
          <Card>
            <CardBody>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <div style={{ background: "var(--amber)", color: "var(--base)", width: "32px", height: "32px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Target size={16} />
                </div>
                <h3 style={{ fontSize: "14px", margin: 0 }}>Buyer Intent Detection</h3>
              </div>
              <p style={{ fontSize: "11px", color: "var(--muted)", lineHeight: "1.5", margin: 0 }}>
                AKUMA analyzes buyer interests expressed across all merchants. When buyers show interest in specific products, their requirements are anonymized and matched.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <div style={{ background: "var(--green)", color: "var(--base)", width: "32px", height: "32px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MapPin size={16} />
                </div>
                <h3 style={{ fontSize: "14px", margin: 0 }}>Multi-factor Matching</h3>
              </div>
              <p style={{ fontSize: "11px", color: "var(--muted)", lineHeight: "1.5", margin: 0 }}>
                Matches are scored by category, keywords, budget compatibility, and quantity. Only high-confidence matches (≥75%) are shown to prevent spam.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <div style={{ background: "var(--amber)", color: "var(--base)", width: "32px", height: "32px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Calendar size={16} />
                </div>
                <h3 style={{ fontSize: "14px", margin: 0 }}>Real-time Opportunities</h3>
              </div>
              <p style={{ fontSize: "11px", color: "var(--muted)", lineHeight: "1.5", margin: 0 }}>
                When a strong match is detected, an AI opportunity is created automatically. You get a notification and can reach out instantly.
              </p>
            </CardBody>
          </Card>
        </div>
      </section>
    </PageTransition>
  );
}