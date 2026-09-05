import { runAkumaAgent } from "./ai/agents/akuma-agent";

async function test() {
    const input = {
        username: "demo@nova-electronics.test",
        role: "MERCHANT" as const,
        message: "Analyze my store and find the best opportunity to increase revenue.",
    };

    console.log("Input:", input.message);

    try {
        const result = await runAkumaAgent(input);
        console.log("Agent Response:\n", result.content);
        console.log("\nTools Used:", result.toolActivity);
    } catch (e: unknown) {
        console.error("Error:", e instanceof Error ? e.message : String(e));
    }
}

test();
