export type OpportunityStatus = "AWAITING_APPROVAL" | "ACTIVE" | "BLOCKED";
export type AuditActor = "AI_AGENT" | "GUARDRAIL" | "USER" | "SYSTEM";

export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
};

type Order = {
  id: string;
  customerId: string;
  productIds: string[];
  amount: number;
  createdAt: string;
};

export type Opportunity = {
  id: string;
  title: string;
  type: string;
  description: string;
  sourceProducts: string[];
  targetProduct: string;
  confidence: number;
  expectedRevenue: number;
  expectedLift: number;
  riskScore: number;
  marginImpact: number;
  status: OpportunityStatus;
  evidence: { coPurchaseRate: number; orders: number; customers: number; window: string };
  discountPercent: number;
  createdAt: string;
};

export type AuditEvent = {
  id: string;
  actor: AuditActor;
  action: string;
  detail: string;
  time: string;
  status: "PASS" | "PENDING" | "BLOCKED" | "SUCCESS";
};

export type CheckoutResult = {
  orderId: string;
  amount: number;
  currency: string;
  status: "CAPTURED";
  products: Product[];
};

export const policy = {
  maxDiscountPercent: 10,
  maxCampaignBudget: 5000,
  maxSingleTransaction: 10000,
  requireApprovalAbove: 1000,
};

export const products: Product[] = [
  { id: "p_headphones", name: "Sonic Pro Headphones", category: "Audio", price: 3499, cost: 2180, stock: 42 },
  { id: "p_case", name: "Protective Case", category: "Audio", price: 499, cost: 180, stock: 116 },
  { id: "p_keyboard", name: "Wireless Keyboard", category: "Peripherals", price: 2499, cost: 1550, stock: 68 },
  { id: "p_mouse", name: "Wireless Mouse", category: "Peripherals", price: 899, cost: 420, stock: 94 },
  { id: "p_stand", name: "Laptop Stand", category: "Workspace", price: 1499, cost: 760, stock: 31 },
  { id: "p_hub", name: "USB-C Hub", category: "Workspace", price: 1299, cost: 650, stock: 55 },
];

const orders: Order[] = Array.from({ length: 1284 }, (_, index) => {
  const pair = index % 3;
  const productIds = pair === 0 ? ["p_headphones", ...(index % 10 < 3 ? ["p_case"] : [])] : pair === 1 ? ["p_keyboard", ...(index % 3 !== 0 ? ["p_mouse"] : [])] : ["p_stand", ...(index % 4 !== 0 ? ["p_hub"] : [])];
  const amount = productIds.reduce((sum, id) => sum + (products.find((product) => product.id === id)?.price ?? 0), 0);
  const date = new Date(Date.now() - (1284 - index) * 86_400_000 / 18);
  return { id: `ord_${index + 1}`, customerId: `cus_${(index % 927) + 1}`, productIds, amount, createdAt: date.toISOString() };
});

let opportunities: Opportunity[] = [];
let auditEvents: AuditEvent[] = [
  { id: "audit_1", actor: "SYSTEM", action: "Workspace initialized", detail: "Nova Electronics connected to AKUMA demo mode", time: "09:42:11", status: "SUCCESS" },
  { id: "audit_2", actor: "AI_AGENT", action: "Historical patterns indexed", detail: "1,284 orders analyzed across 927 customers", time: "09:42:14", status: "SUCCESS" },
];
let auditSequence = 2;
const checkoutOperations = new Map<string, CheckoutResult>();

const nowTime = () => new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const addAudit = (actor: AuditActor, action: string, detail: string, status: AuditEvent["status"]) => {
  auditSequence += 1;
  auditEvents = [{ id: `audit_${auditSequence}`, actor, action, detail, time: nowTime(), status }, ...auditEvents];
};

export function dashboardMetrics() {
  const totalRevenue = orders.reduce((sum, order) => sum + order.amount, 0);
  const uniqueCustomers = new Set(orders.map((order) => order.customerId)).size;
  const activeOpportunities = opportunities.filter((item) => item.status === "ACTIVE");
  const influencedRevenue = activeOpportunities.reduce((sum, item) => sum + item.expectedRevenue, 0);
  return {
    totalRevenue,
    orders: orders.length,
    customers: uniqueCustomers,
    opportunities: opportunities.length,
    pendingApprovals: opportunities.filter((item) => item.status === "AWAITING_APPROVAL").length,
    influencedRevenue,
    actionsExecuted: activeOpportunities.length,
  };
}

export function analyze() {
  const detected: Opportunity = {
    id: "opp_headphones_case",
    title: "Headphones → Protective Case",
    type: "CROSS_SELL",
    description: "A compliant bundle can convert a proven post-purchase behavior into incremental revenue.",
    sourceProducts: ["Sonic Pro Headphones"],
    targetProduct: "Protective Case",
    confidence: 91,
    expectedRevenue: 18420,
    expectedLift: 6.1,
    riskScore: 18,
    marginImpact: -299,
    status: "AWAITING_APPROVAL",
    evidence: { coPurchaseRate: 31.4, orders: 1284, customers: 382, window: "14 days" },
    discountPercent: 8,
    createdAt: new Date().toISOString(),
  };
  opportunities = [detected];
  addAudit("AI_AGENT", "Opportunity detected", "31.4% of headphone buyers purchase a case within 14 days", "SUCCESS");
  addAudit("AI_AGENT", "Action proposed", "8% bundle discount · expected incremental revenue ₹18,420", "PENDING");
  addAudit("GUARDRAIL", "Policy check passed", "Requested discount 8% ≤ merchant maximum 10%", "PASS");
  return detected;
}

export function getOpportunities() { return opportunities; }
export function getAudit() { return auditEvents; }

export function approveOpportunity(id: string) {
  const opportunity = opportunities.find((item) => item.id === id);
  if (!opportunity) throw new Error("Opportunity not found");
  if (opportunity.status !== "AWAITING_APPROVAL") throw new Error("Opportunity already resolved");
  opportunity.status = "ACTIVE";
  addAudit("USER", "Action approved", "Merchant approval received for Weekend Bundle campaign", "SUCCESS");
  addAudit("SYSTEM", "Campaign activated", "Headphones + Protective Case · 8% offer · 382 customers", "SUCCESS");
  return opportunity;
}

export function createCheckout(query: string, productIds: string[], operationId = `checkout_${Date.now()}`): CheckoutResult {
  const existing: CheckoutResult | undefined = checkoutOperations.get(operationId);
  if (existing) return existing;
  const selected = productIds.map((id) => products.find((product) => product.id === id)).filter((product): product is Product => Boolean(product));
  const amount = selected.reduce((sum, product) => sum + product.price, 0);
  if (!selected.length || amount > policy.maxSingleTransaction) throw new Error("Checkout does not satisfy catalog or policy constraints");
  const orderId = `demo_order_${Date.now()}`;
  addAudit("SYSTEM", "Test order created", `${query} · ${selected.map((product) => product.name).join(" + ")} · ₹${amount.toLocaleString("en-IN")}`, "SUCCESS");
  addAudit("SYSTEM", "Payment verified", "LOCAL DEMO SIMULATION · no live money moved", "SUCCESS");
  const result: CheckoutResult = { orderId, amount, currency: "INR", status: "CAPTURED", products: selected };
  checkoutOperations.set(operationId, result);
  return result;
}

export function catalogSearch(query: string) {
  const normalized = query.toLowerCase();
  const matches = products.filter((product) => normalized.includes(product.name.toLowerCase().split(" ")[1]) || normalized.includes(product.category.toLowerCase()) || (normalized.includes("headphone") && product.id === "p_headphones") || (normalized.includes("keyboard") && product.id === "p_keyboard") || (normalized.includes("mouse") && product.id === "p_mouse"));
  return matches.length ? matches : products.slice(0, 3);
}
