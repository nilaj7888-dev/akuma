import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AgentConsole } from "@/components/agent-console";
import { getSession } from "@/lib/auth";

export default async function AgentPage() {
  if (!await getSession()) redirect("/");
  return <main className="agent-page"><div className="agent-page-top"><Link href="/" className="back-link"><ArrowLeft size={16} /> Back to workspace</Link><span className="mode"><span className="tiny-dot" /> DEMO MODE</span></div><div className="agent-page-inner"><p className="eyebrow">AKUMA / AGENT OPERATIONS</p><h1>Your commerce agent</h1><p className="agent-page-copy">A real Groq-backed conversation with trusted AKUMA tools. Financial actions remain behind policy and approval.</p><AgentConsole role="MERCHANT" /></div></main>;
}
