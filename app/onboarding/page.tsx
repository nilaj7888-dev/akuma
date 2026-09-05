"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { OnboardingScreen } from "@/components/onboarding-screen";

function OnboardingPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roleParam = searchParams.get("role");

  const [role, setRole] = useState<"MERCHANT" | "BUYER" | null>(null);

  useEffect(() => {
    // If no role in URL, try to get from session via /api/onboarding
    if (!roleParam) {
      fetch("/api/onboarding")
        .then(res => res.json())
        .then(data => {
          if (data.context?.role) {
            setRole(data.context.role === "BUYER" ? "BUYER" : "MERCHANT");
          }
        })
        .catch(() => {});
    } else {
      setRole(roleParam === "CONSUMER" ? "BUYER" : roleParam === "MERCHANT" ? "MERCHANT" : null);
    }
  }, [roleParam]);

  const handleComplete = (accountType: "MERCHANT" | "CONSUMER") => {
    router.push(accountType === "CONSUMER" ? "/shop" : "/dashboard");
  };

  const handleBack = () => {
    router.push("/");
  };

  if (!role) {
    return (
      <main className="auth-loading">
        <span className="brand-mark">A</span>
        <p>Loading your profile...</p>
      </main>
    );
  }

  return <OnboardingScreen role={role} onComplete={handleComplete} onBack={handleBack} />;
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <main className="auth-loading">
        <span className="brand-mark">A</span>
        <p>Loading...</p>
      </main>
    }>
      <OnboardingPageInner />
    </Suspense>
  );
}