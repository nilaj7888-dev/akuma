"use client";

import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

interface StatusConfig {
  icon: string;
  title: string;
  message: string;
  color: "green" | "red" | "amber" | "blue";
  ctaText: string;
  ctaHref: string;
}

const statusMap: Record<string, StatusConfig> = {
  accepted: {
    icon: "✓",
    title: "Offer Accepted",
    message:
      "You've successfully accepted the customer's offer. The negotiation has been confirmed and the customer will be notified to proceed to checkout.",
    color: "green",
    ctaText: "Back to Dashboard",
    ctaHref: "/dashboard",
  },
  rejected: {
    icon: "✕",
    title: "Offer Rejected",
    message:
      "You've declined this offer. The customer has been notified and may submit a new offer or explore other products.",
    color: "red",
    ctaText: "Back to Dashboard",
    ctaHref: "/dashboard",
  },
  expired: {
    icon: "⏱",
    title: "Link Expired",
    message:
      "This negotiation link has expired or is no longer valid. Offers must be acted on within 24 hours. Please return to your dashboard to view active negotiations.",
    color: "amber",
    ctaText: "View Active Negotiations",
    ctaHref: "/merchant/negotiations",
  },
  already_processed: {
    icon: "⚠",
    title: "Already Processed",
    message:
      "This offer has already been processed. Each offer can only be acted on once. Please check your dashboard for the current status.",
    color: "blue",
    ctaText: "View Negotiations",
    ctaHref: "/merchant/negotiations",
  },
  error: {
    icon: "!",
    title: "Something Went Wrong",
    message:
      "An unexpected error occurred while processing your decision. Please try again or contact support.",
    color: "red",
    ctaText: "Go to Dashboard",
    ctaHref: "/dashboard",
  },
};

function NegotiationStatusContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const state = searchParams.get("state") || "error";

  const config = statusMap[state] || statusMap.error;

  const colorClasses = {
    green: {
      bg: "bg-green-50",
      icon: "bg-green-100 text-green-600",
      button: "bg-green-600 hover:bg-green-700",
    },
    red: {
      bg: "bg-red-50",
      icon: "bg-red-100 text-red-600",
      button: "bg-red-600 hover:bg-red-700",
    },
    amber: {
      bg: "bg-amber-50",
      icon: "bg-amber-100 text-amber-600",
      button: "bg-amber-600 hover:bg-amber-700",
    },
    blue: {
      bg: "bg-blue-50",
      icon: "bg-blue-100 text-blue-600",
      button: "bg-blue-600 hover:bg-blue-700",
    },
  };

  const colors = colorClasses[config.color];

  return (
    <div className={`min-h-screen ${colors.bg} flex items-center justify-center px-4 py-8`}>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header with icon */}
          <div className="bg-gradient-to-r from-slate-100 to-slate-50 px-6 py-12 flex flex-col items-center">
            <div
              className={`${colors.icon} w-24 h-24 rounded-full flex items-center justify-center mb-4`}
            >
              <span className="text-6xl font-bold">{config.icon}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 text-center">{config.title}</h1>
          </div>

          {/* Content */}
          <div className="px-6 py-8">
            <p className="text-slate-600 text-center leading-relaxed mb-8">{config.message}</p>

            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              <Link
                href={config.ctaHref}
                className={`${colors.button} text-white font-semibold py-3 px-6 rounded-lg text-center transition-colors duration-200`}
              >
                {config.ctaText}
              </Link>

              <button
                onClick={() => router.back()}
                className="text-slate-600 hover:text-slate-900 font-medium py-3 px-6 rounded-lg transition-colors duration-200 border border-slate-200"
              >
                Go Back
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
            <p className="text-xs text-slate-500 text-center">
              Need help? Contact merchant support or check your email for details.
            </p>
          </div>
        </div>

        {/* Back link for mobile */}
        <div className="mt-6 text-center">
          <Link href="/dashboard" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function NegotiationStatusPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <NegotiationStatusContent />
    </Suspense>
  );
}
