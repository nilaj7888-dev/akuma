"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PhoneOnboarding } from "@/components/phone-onboarding";
import { ArrowRight } from "lucide-react";

function PhoneAuthInner() {
  const searchParams = useSearchParams();
  const roleFromUrl = searchParams.get("role") as "MERCHANT" | "CONSUMER" | null;
  const [accountType, setAccountType] = useState<"MERCHANT" | "CONSUMER" | null>(roleFromUrl);

  if (!accountType) {
    return (
      <main className="onboarding-shell">
        <div className="onboarding-card">
          <div className="brand"><span className="brand-mark">A</span><span>AKUMA</span></div>
          <h1>Welcome to AKUMA</h1>
          <p className="subhead">AI-powered commerce for India. Choose your experience:</p>

          <div className="option-grid">
            <button
              className="option-card"
              onClick={() => setAccountType("MERCHANT")}
            >
              <h3>I&apos;m a Merchant</h3>
              <p>Sell products, manage inventory, grow revenue with AI insights</p>
              <ArrowRight size={16} />
            </button>

            <button
              className="option-card"
              onClick={() => setAccountType("CONSUMER")}
            >
              <h3>I&apos;m a Buyer</h3>
              <p>Shop smart, negotiate prices, discover local deals with AI</p>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="onboarding-shell">
      <PhoneOnboarding accountType={accountType} />
    </main>
  );
}

export default function PhoneAuthPage() {
  return (
    <Suspense fallback={
      <main className="auth-loading">
        <span className="brand-mark">A</span>
        <p>Loading...</p>
      </main>
    }>
      <PhoneAuthInner />
    </Suspense>
  );
}
