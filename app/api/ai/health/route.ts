import { NextResponse } from "next/server";
import { availableToolNames, groqConfig } from "@/ai/llm/model-config";
import { groqHealth } from "@/ai/llm/groq-client";

export async function GET() {
  const health = await groqHealth();
  return NextResponse.json(
    {
      provider: "groq",
      model: health.model,
      fastModel: groqConfig.fastModel,
      status: health.connected ? "online" : "offline",
      latencyMs: health.latencyMs,
      availableTools: availableToolNames,
      ...(health.error ? { error: health.error } : {}),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
