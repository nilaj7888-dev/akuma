"use client";

import { AgentConsole } from "@/components/agent-console";

export default function AskPage() {
  return (
    <div className="content">
      <div className="topbar">
        <div className="crumb">
          <span>SHOP</span>
          <span>→</span>
          <strong>ASK AKUMA</strong>
        </div>
        <div className="top-actions">
          <span className="mode">
            <span className="tiny-dot" />
            AGENT MODE
          </span>
        </div>
      </div>
      <div className="page-head">
        <div>
          <p className="eyebrow">CONSUMER AGENT</p>
          <h1>Talk to AKUMA about what you need.</h1>
          <p className="subhead">Describe your shopping intent, budget, quantity, or any preference. AKUMA will search real inventory, compare, and negotiate where possible.</p>
        </div>
      </div>
      <AgentConsole role="BUYER" />
    </div>
  );
}