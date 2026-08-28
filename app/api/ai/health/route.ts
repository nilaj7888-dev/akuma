import { NextResponse } from "next/server";
import { availableToolNames } from "@/ai/llm/model-config";
import { ollamaHealth } from "@/ai/llm/ollama-client";

export async function GET() {
  const health = await ollamaHealth();
  return NextResponse.json({ provider: "ollama", model: health.model, status: health.connected ? "online" : "offline", latencyMs: health.latencyMs, availableTools: availableToolNames });
}
