"use client";

import { useState } from "react";
import { resetAkumaState } from "@/components/brand-reset";
import { ArrowRight, Check, ChevronLeft, MapPin, Sparkles } from "lucide-react";

type Role = "MERCHANT" | "BUYER";
type Context = { role: Role; businessName?: string; categories?: string[]; productCount?: number; catalogSource?: string; location?: string; deliveryRadius?: string; negotiationPreference?: string; primaryGoal?: string; buyerPriority?: string; conditionPreference?: string };
type Step = { field: string; question: string; hint: string; options?: string[]; placeholder?: string };

const merchantSteps: Step[] = [
  { field: "businessName", question: "What should I call your business?", hint: "This will shape your merchant workspace.", placeholder: "e.g. TechHub Bangalore" },
  { field: "categories", question: "What do you sell?", hint: "What category of products?", options: ["Electronics", "Fashion", "Furniture", "Food", "Services"] },
  { field: "location", question: "Where does your business operate?", hint: "A city or area is enough.", placeholder: "e.g. Bangalore" },
  { field: "negotiationPreference", question: "Should AKUMA negotiate with buyers?", hint: "You always keep final say.", options: ["Yes, automatically", "Ask me before negotiating", "No negotiation"] },
  { field: "primaryGoal", question: "What matters most right now?", hint: "AKUMA will focus on this.", options: ["Increase sales", "Find new customers", "Clear inventory", "Increase profit", "Balanced"] },
  { field: "emailNotifications", question: "Email notifications for opportunities?", hint: "Get alerted when buyers show interest.", options: ["Yes, email me", "No emails"] },
];
const buyerSteps: Step[] = [
  { field: "buyerPriority", question: "What matters most when you buy?", hint: "I will rank future recommendations around this.", options: ["Lowest price", "Best quality", "Fastest delivery", "Nearest seller", "Best overall value"] },
  { field: "lookingFor", question: "What are you looking for right now?", hint: "Tell me what product you need - I'll help you find it.", placeholder: "e.g. headphones, laptop, shoes" },
  { field: "buyerBudget", question: "What's your budget?", hint: "This helps me find products in your price range.", placeholder: "e.g. 5000" },
  { field: "buyerLocation", question: "Where are you located?", hint: "So I can find sellers near you.", placeholder: "e.g. Indiranagar, Bangalore" },
  { field: "conditionPreference", question: "Do you prefer new products, used products, or both?", hint: "You can change this preference anytime.", options: ["New only", "Used only", "Both"] },
  { field: "negotiationPreference", question: "Would you like AKUMA to negotiate prices for you?", hint: "I can try to get you a better deal.", options: ["Yes", "Ask me first", "No"] },
  { field: "emailNotifications", question: "Email notifications for responses?", hint: "Get alerted when merchants respond to your offers.", options: ["Yes, email me", "No emails"] },
];

export function OnboardingScreen({ role, onComplete, onBack }: { role: Role; onComplete: (accountType: "MERCHANT" | "CONSUMER") => void; onBack?: () => void }) {
  const steps = role === "MERCHANT" ? merchantSteps : buyerSteps;
  const [index, setIndex] = useState(0);
  const [context, setContext] = useState<Context>({ role });
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const step = steps[index];

  // Get current value from answers map, or from context if already saved
  const getValue = () => {
    if (answers[step.field] !== undefined) return answers[step.field];
    const contextValue = (context as Record<string, unknown>)[step.field];
    if (Array.isArray(contextValue)) return contextValue.join(", ");
    if (typeof contextValue === "string") return contextValue;
    return "";
  };

  const value = getValue();

  const setValue = (newValue: string) => {
    setAnswers((prev) => ({ ...prev, [step.field]: newValue }));
  };

  void error;
  const submit = async () => { if (!value.trim()) return; setSaving(true); setError(""); if (step.field === "storeUrl") { const ingestion = await fetch("/api/store-connection", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: value.trim() }) }); const ingestionResult = await ingestion.json(); if (!ingestion.ok) { setError(ingestionResult.error?.message ?? "We couldn't automatically import this store."); setSaving(false); return; } } const response = await fetch("/api/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role, field: step.field, value, complete: index === steps.length - 1 }) }); const result = await response.json(); setSaving(false); if (!response.ok) { setError(result.error?.message ?? "That answer could not be saved."); return; } const next = result.context as Context; const accountType = result.accountType || (role === "BUYER" ? "CONSUMER" : "MERCHANT"); setContext(next); if (index < steps.length - 1) setIndex(index + 1); else setConfirmed(true); };
  const summary = role === "MERCHANT" ? [{ label: "Business", value: context.businessName }, { label: "Categories", value: Array.isArray(context.categories) ? context.categories.join(", ") : context.categories }, { label: "Catalog", value: context.catalogSource }, { label: "Location", value: context.location }, { label: "Delivery", value: context.deliveryRadius }, { label: "Goal", value: context.primaryGoal }, { label: "Negotiation", value: context.negotiationPreference }] : [{ label: "Priority", value: context.buyerPriority }, { label: "Condition", value: context.conditionPreference }, { label: "Negotiation", value: context.negotiationPreference }];

  const handleBack = () => {
    if (index > 0) {
      setIndex(index - 1);
    } else if (onBack) {
      // At first question and user clicks back - go to role selection
      onBack();
    }
  };

  const handleBrandClick = () => {
    // Full reset rather than a client-side push: abandoning setup half-way
    // should not leave partial onboarding state behind.
    resetAkumaState("/");
  };

  if (confirmed) {
    const accountType = role === "BUYER" ? "CONSUMER" : "MERCHANT";
    return <main className="onboarding-shell"><div className="onboarding-card confirmation-card"><div className="success-mark"><Check size={22} /></div><p className="eyebrow">YOUR AKUMA CONTEXT</p><h1>Here&apos;s what I understood.</h1><p className="onboarding-copy">This profile will shape the agent around your priorities. Nothing changes until you confirm it.</p><div className="profile-summary">{summary.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value || "Not specified"}</strong></div>)}</div><div className="confirmation-actions"><button className="primary-button" onClick={() => onComplete(accountType)}>Looks good <ArrowRight size={16} /></button><button className="skip-button" onClick={() => onComplete(accountType)}>Complete later</button></div></div></main>;
  }
  return <main className="onboarding-shell"><div className="onboarding-card"><div className="onboarding-top"><button className="brand-button" onClick={handleBrandClick} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><div className="brand"><span className="brand-mark">A</span><span>AKUMA</span></div></button><span className="role-chip">{role === "MERCHANT" ? "MERCHANT SETUP" : "BUYER SETUP"}</span></div><div className="progress-label"><span>GETTING AKUMA READY</span><span>{index + 1} / {steps.length}</span></div><div className="progress-track"><span style={{ width: `${((index + 1) / steps.length) * 100}%` }} /></div><div className="agent-line"><span className="mini-avatar">A</span><div><strong>AKUMA</strong><p>{index === 0 ? "Great. Before I set things up, I want to understand how you plan to use me." : "Thanks. One more signal will help me personalize your workspace."}</p></div></div><div className="question-block"><p className="eyebrow">{role === "MERCHANT" ? "BUSINESS CONTEXT" : "SHOPPING CONTEXT"}</p><h1>{step.question}</h1><p>{step.hint}</p>{step.options ? <div className="option-grid">{step.options.map((option) => <button key={option} className={value === option ? "selected" : ""} onClick={() => setValue(option)}>{option}{value === option && <Check size={15} />}</button>)}</div> : <input autoFocus value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} placeholder={step.placeholder} />}<div className="question-actions"><button className="back-button" onClick={handleBack}><ChevronLeft size={16} /> Back</button><button className="primary-button" onClick={submit} disabled={!value.trim() || saving}>{saving ? "Saving..." : index === steps.length - 1 ? "Build my workspace" : "Continue"}<ArrowRight size={16} /></button></div><button className="skip-button" onClick={() => index < steps.length - 1 ? setIndex(index + 1) : setConfirmed(true)}>Skip for now</button></div><div className="onboarding-foot"><Sparkles size={14} /> Your answers become structured agent context, not a transcript.</div></div><div className="onboarding-aside"><MapPin size={17} /><span>Adaptive setup</span><p>Questions change based on your answers. Local sellers see delivery setup; national sellers can move on.</p></div></main>;
}
