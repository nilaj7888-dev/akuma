// Mock data generators for akuma app
// Generates realistic data for pages without API endpoints

// Utility: Random number in range
const random = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Utility: Random item from array
const pick = <T,>(arr: T[]): T => arr[random(0, arr.length - 1)];

// Utility: Money formatter
export const formatMoney = (value?: number | null) => `₹${(value ?? 0).toLocaleString("en-IN")}`;

// Dashboard Metrics
export const generateDashboardMetrics = () => ({
  totalRevenue: 487250 + random(-50000, 100000),
  orders: 342 + random(-50, 100),
  customers: 89 + random(-20, 40),
  opportunities: random(8, 15),
  influencedRevenue: 156800 + random(-20000, 50000),
  actionsExecuted: 28 + random(-5, 10),
  conversionLift: 8.4 + random(-2, 4),
});

// Opportunity Types
type OpportunityType = "CROSS_SELL" | "REACTIVATION" | "REVENUE_LEAK" | "PRICE_OPTIMIZATION";

export const generateOpportunities = (count = 5) =>
  Array.from({ length: count }, (_, i) => {
    const types: OpportunityType[] = ["CROSS_SELL", "REACTIVATION", "REVENUE_LEAK", "PRICE_OPTIMIZATION"];
    const type = types[i % types.length];

    const titles: Record<OpportunityType, string[]> = {
      CROSS_SELL: ["Bundle headphones with laptop purchases", "Recommend accessories to phone buyers", "Suggest premium cables with chargers"],
      REACTIVATION: ["Win back customers inactive 90+ days", "Re-engage cart abandoners", "Reactivate Q1 buyers"],
      REVENUE_LEAK: ["Fix pricing errors on bulk orders", "Recover abandoned high-value carts", "Address discount code abuse"],
      PRICE_OPTIMIZATION: ["Increase margin on high-demand items", "Dynamic pricing for slow movers", "Optimize bundle pricing"],
    };

    const descriptions: Record<OpportunityType, string[]> = {
      CROSS_SELL: ["Customers buying laptops show 68% interest in audio accessories within 7 days"],
      REACTIVATION: ["127 customers haven't purchased in 90+ days but show high engagement with emails"],
      REVENUE_LEAK: ["₹45,000 monthly revenue lost due to manual discount approval delays"],
      PRICE_OPTIMIZATION: ["15 SKUs priced below market; competitors charge 8-12% more"],
    };

    return {
      id: `opp_${Date.now()}_${i}`,
      type,
      title: pick(titles[type]),
      description: pick(descriptions[type]),
      confidence: 75 + random(0, 20),
      expectedRevenue: 15000 + random(0, 50000),
      expectedLift: 5 + random(0, 15),
      riskScore: random(10, 30) / 10,
      marginImpact: 500 + random(0, 2000),
      status: pick(["PENDING", "APPROVED", "REJECTED", "ACTIVE"]),
      evidence: {
        affected_customers: random(50, 300),
        historical_conversion: `${random(5, 25)}%`,
        avg_order_value: formatMoney(random(2000, 8000)),
        time_to_impact: `${random(3, 14)} days`,
      },
      recommendedAction: pick([
        "Create targeted email campaign",
        "Enable AI-powered product recommendations",
        "Adjust pricing by 8-12%",
        "Send personalized discount offers",
      ]),
    };
  });

// Campaign Data
export const generateCampaigns = (count = 8) =>
  Array.from({ length: count }, (_, i) => ({
    id: `camp_${Date.now()}_${i}`,
    name: pick([
      "Laptop Bundle Promotion",
      "Weekend Flash Sale",
      "Loyalty Rewards Campaign",
      "Cart Recovery Automation",
      "New Customer Welcome Series",
      "Seasonal Electronics Sale",
    ]),
    status: pick(["ACTIVE", "PAUSED", "COMPLETED", "DRAFT"]),
    type: pick(["EMAIL", "SMS", "DISCOUNT", "PRODUCT_RECOMMENDATION"]),
    reach: random(100, 5000),
    conversions: random(10, 500),
    revenue: random(50000, 500000),
    startDate: new Date(Date.now() - random(1, 30) * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + random(1, 30) * 24 * 60 * 60 * 1000).toISOString(),
  }));

// Product/Inventory Data
export const generateProducts = (count = 20) =>
  Array.from({ length: count }, (_, i) => ({
    id: `prod_${Date.now()}_${i}`,
    sku: `SKU-${random(10000, 99999)}`,
    name: pick([
      "MacBook Air M2",
      "Sony WH-1000XM5 Headphones",
      "iPhone 15 Pro",
      "Samsung Galaxy S24",
      "Dell XPS 15 Laptop",
      "iPad Pro 12.9",
      "AirPods Pro",
      "Logitech MX Master 3S",
      "LG 27-inch Monitor",
      "Anker PowerCore 20000",
    ]),
    category: pick(["Laptops", "Audio", "Smartphones", "Accessories", "Monitors"]),
    price: random(2000, 120000),
    stock: random(0, 100),
    sold: random(10, 500),
    margin: random(15, 35),
  }));

// Customer Data
export const generateCustomers = (count = 50) =>
  Array.from({ length: count }, (_, i) => ({
    id: `cust_${Date.now()}_${i}`,
    name: pick(["Rahul Sharma", "Priya Patel", "Amit Kumar", "Sneha Reddy", "Vikram Singh", "Anjali Mehta"]),
    email: `customer${i}@example.com`,
    totalOrders: random(1, 20),
    totalSpent: random(5000, 200000),
    lastOrderDate: new Date(Date.now() - random(1, 180) * 24 * 60 * 60 * 1000).toISOString(),
    segment: pick(["High Value", "Regular", "At Risk", "New", "Churned"]),
    clv: random(10000, 500000),
    churnProbability: random(5, 95),
  }));

// Audit Log
export const generateAuditLog = (count = 20) =>
  Array.from({ length: count }, (_, i) => ({
    id: `audit_${Date.now()}_${i}`,
    actor: pick(["AI_AGENT", "USER", "SYSTEM"]),
    action: pick([
      "Created campaign",
      "Approved opportunity",
      "Updated pricing",
      "Modified inventory",
      "Rejected recommendation",
      "Executed discount",
    ]),
    detail: pick([
      "Campaign targeting 245 customers",
      "Opportunity #1234 with 85% confidence",
      "SKU-12345 price adjusted by 8%",
      "Stock level updated for 5 products",
      "Risk score exceeded threshold",
    ]),
    time: new Date(Date.now() - random(1, 48) * 60 * 60 * 1000).toLocaleString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    status: pick(["SUCCESS", "PENDING", "FAILED"]),
  }));

// Analytics Data
export const generateChurnAnalysis = () => ({
  atRiskCustomers: random(15, 50),
  churnRate: (random(5, 15) / 100).toFixed(3),
  averageDaysSinceLastOrder: random(60, 120),
  potentialRevenueLoss: random(100000, 500000),
  topChurnReasons: [
    { reason: "Price sensitivity", percentage: random(25, 40) },
    { reason: "Product availability", percentage: random(15, 25) },
    { reason: "Competitor offers", percentage: random(20, 35) },
    { reason: "Poor experience", percentage: random(10, 20) },
  ],
});

export const generateCLVAnalysis = () => ({
  averageCLV: random(50000, 150000),
  topSegmentCLV: random(200000, 500000),
  clvGrowth: random(5, 20),
  segments: [
    { name: "Champions", count: random(10, 30), clv: random(200000, 500000) },
    { name: "Loyal", count: random(20, 50), clv: random(100000, 200000) },
    { name: "Potential", count: random(30, 80), clv: random(50000, 100000) },
    { name: "At Risk", count: random(10, 40), clv: random(30000, 60000) },
  ],
});

export const generateFunnelData = () => ({
  steps: [
    { name: "Visited Site", count: random(5000, 10000), conversion: 100 },
    { name: "Viewed Product", count: random(2000, 4000), conversion: random(40, 60) },
    { name: "Added to Cart", count: random(800, 1500), conversion: random(20, 35) },
    { name: "Started Checkout", count: random(400, 800), conversion: random(10, 20) },
    { name: "Completed Purchase", count: random(200, 500), conversion: random(5, 12) },
  ],
  dropoffReasons: [
    { step: "Cart to Checkout", reason: "High shipping cost", percentage: 35 },
    { step: "Cart to Checkout", reason: "Long form", percentage: 25 },
    { step: "Checkout to Purchase", reason: "Payment issues", percentage: 40 },
  ],
});

// Pricing Data
export const generatePricingAnalysis = () => ({
  underpriced: random(5, 20),
  overpriced: random(3, 15),
  competitive: random(50, 100),
  opportunities: [
    {
      product: pick(["MacBook Air", "Sony Headphones", "iPhone 15"]),
      currentPrice: random(50000, 120000),
      suggestedPrice: random(55000, 130000),
      competitorAvg: random(52000, 125000),
      potentialRevenue: random(10000, 50000),
    },
  ],
});

// Segmentation Types
type Segment = { name: string; count: number; avgSpend: number; color: "amber" | "green" | "warning" | "error" };
type SegmentationData = { segments: Segment[]; recency: number; frequency: number; monetary: number };

// Segmentation Data
export const generateSegmentation = (): SegmentationData => ({
  segments: [
    { name: "High Value", count: random(20, 50), avgSpend: random(150000, 300000), color: "amber" },
    { name: "Regular", count: random(100, 200), avgSpend: random(50000, 100000), color: "green" },
    { name: "At Risk", count: random(30, 80), avgSpend: random(30000, 60000), color: "warning" },
    { name: "Churned", count: random(20, 60), avgSpend: random(10000, 30000), color: "error" },
  ],
  recency: random(30, 90),
  frequency: random(2, 10),
  monetary: random(50000, 200000),
});

// Goals/Experiments
export const generateGoals = (count = 5) =>
  Array.from({ length: count }, (_, i) => ({
    id: `goal_${Date.now()}_${i}`,
    title: pick([
      "Increase Q4 revenue by 25%",
      "Reduce cart abandonment to 40%",
      "Grow customer base by 500",
      "Achieve 90% fulfillment rate",
      "Increase average order value to ₹8,000",
    ]),
    progress: random(30, 90),
    target: random(100000, 1000000),
    current: random(50000, 800000),
    deadline: new Date(Date.now() + random(30, 90) * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN"),
  }));

export const generateExperiments = (count = 4) =>
  Array.from({ length: count }, (_, i) => ({
    id: `exp_${Date.now()}_${i}`,
    name: pick([
      "Homepage Banner A/B Test",
      "Checkout Flow Optimization",
      "Product Recommendation Algorithm",
      "Pricing Strategy Test",
    ]),
    status: pick(["RUNNING", "COMPLETED", "DRAFT"]),
    variantA: { name: "Control", conversions: random(100, 500), visitors: random(1000, 3000) },
    variantB: { name: "Variation", conversions: random(120, 550), visitors: random(1000, 3000) },
    significance: random(85, 99),
    winner: pick(["A", "B", "TIE", null]),
  }));
