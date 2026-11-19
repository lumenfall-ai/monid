import { defineEndpoint } from "@shared/core";
import {
    dollarEvidence,
    dollarMicrosModel,
    zeroDollarEstimate,
} from "../../schema/usage.ts";
import { zChatBody } from "./schema/inputs.ts";

export default defineEndpoint<typeof dollarMicrosModel, typeof zChatBody>({
    meta: {
        displayName: "Lumenfall Chat Completion",
        summary:
            "Generate a chat completion with any OpenRouter model through Lumenfall.",
        description: "Send a conversation and get one assistant message " +
            "back. The model id is any OpenRouter id, such as " +
            "google/gemini-3-flash-preview or openai/gpt-5.4, with an " +
            "optional openrouter/ prefix. Supports tools, JSON mode, " +
            "and image parts on a message. Streaming is not available: " +
            "the run waits for the full completion. Token counts come " +
            "back on usage. The USD charge is metadata.cost when Lumenfall " +
            "sends it, otherwise usage.cost. A completion with neither " +
            "receipt settles at zero. The pre-run estimate is zero " +
            "because each model has its own price.",
        docsUrl: "https://docs.lumenfall.ai/api-reference/chat/completions",
        categories: ["text-generation"],
        notes: [
            "Do not send stream. This connector returns one JSON body.",
            "Undocumented OpenRouter parameters are rejected. Use the fields this endpoint lists.",
        ],
    },
    request: { method: "POST", path: "/chat/completions" },
    input: { schema: { body: zChatBody } },
    timeouts: { requestMs: 120_000, runMs: 150_000 },
    usage: {
        model: dollarMicrosModel,
        estimate: zeroDollarEstimate,
        evidence: dollarEvidence,
    },
});
