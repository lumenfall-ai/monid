import { z } from "zod";

/** One multimodal content part. Documented types are text and image_url
 *  (docs.lumenfall.ai/api-reference/chat/completions, 2026-11-19). */
const zContentPart = z.object({
    type: z.string().min(1).describe(
        "Part type. text and image_url are the documented kinds.",
    ),
    text: z.string().optional().describe("Text of a text part."),
    image_url: z.object({
        url: z.string().min(1).describe("Image URL or data URI."),
        detail: z.string().optional().describe(
            "Optional detail hint passed through to the model.",
        ),
    }).strict().optional(),
}).strict();

const zMessage = z.object({
    role: z.enum(["system", "user", "assistant", "tool"]).describe(
        "Who wrote the message.",
    ),
    content: z.union([z.string(), z.array(zContentPart), z.null()]).describe(
        "Message content: a string, a list of parts, or null on an " +
            "assistant message that only carries tool calls.",
    ),
    name: z.string().optional().describe("Optional participant name."),
    tool_calls: z.array(z.record(z.string(), z.any())).optional().describe(
        "Tool calls on an assistant message.",
    ),
    tool_call_id: z.string().optional().describe(
        "The tool call this tool message answers.",
    ),
}).strict();

/** POST /chat/completions body. OpenAI-compatible chat, routed through
 *  OpenRouter. Streaming is omitted: the engine reads one JSON body. */
export const zChatBody = z.object({
    model: z.string().min(1).describe(
        "OpenRouter model id, for example google/gemini-3-flash-preview " +
            "or openai/gpt-5.4. An openrouter/ prefix is optional.",
    ),
    messages: z.array(zMessage).min(1).describe(
        "The conversation so far, oldest first.",
    ),
    temperature: z.number().min(0).max(2).optional().describe(
        "Sampling temperature from 0 to 2. Omitted, Lumenfall uses 1.",
    ),
    max_tokens: z.number().int().positive().optional().describe(
        "Maximum tokens to generate.",
    ),
    top_p: z.number().min(0).max(1).optional().describe(
        "Nucleus sampling cutoff. Omitted, Lumenfall uses 1.",
    ),
    frequency_penalty: z.number().min(-2).max(2).optional().describe(
        "Penalty for tokens already used, from -2 to 2. Omitted, 0.",
    ),
    presence_penalty: z.number().min(-2).max(2).optional().describe(
        "Penalty for tokens that have appeared, from -2 to 2. Omitted, 0.",
    ),
    stop: z.union([z.string().min(1), z.array(z.string().min(1)).max(4)])
        .optional().describe(
            "Up to four sequences that stop generation.",
        ),
    tools: z.array(
        z.object({
            type: z.literal("function"),
            function: z.object({
                name: z.string().min(1),
                description: z.string().optional(),
                parameters: z.record(z.string(), z.any()).optional(),
            }).strict(),
        }).strict(),
    ).optional().describe(
        "Functions the model may call. Only type function is documented.",
    ),
    tool_choice: z.union([
        z.string().min(1),
        z.record(z.string(), z.any()),
    ]).optional().describe(
        "none, auto, required, or a specific function object.",
    ),
    response_format: z.object({
        type: z.string().min(1),
    }).strict().optional().describe(
        "Set type to json_object for JSON mode.",
    ),
    seed: z.number().int().optional().describe(
        "Seed for deterministic sampling. Not every model honors it.",
    ),
    user: z.string().min(1).optional().describe(
        "A caller-chosen end-user id.",
    ),
    logprobs: z.boolean().optional().describe(
        "When true, return log probabilities of output tokens.",
    ),
    top_logprobs: z.number().int().min(0).max(20).optional().describe(
        "How many top tokens to return at each position. Requires logprobs.",
    ),
}).strict();
