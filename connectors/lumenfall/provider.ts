import { defineProvider, presets, type UsageConsolidateFn } from "@shared/core";

/**
 * Lumenfall (lumenfall.ai) — one OpenAI-compatible API for chat, images
 * and video across many underlying models.
 *
 * Base URL `https://api.lumenfall.ai/openai/v1`, Bearer auth
 * (docs.lumenfall.ai/authentication, checked 2026-11-19).
 *
 * BILLING. There is no single rate card. Every media response carries
 * `metadata.cost` in USD, and that figure is the authoritative charge
 * (docs.lumenfall.ai/billing). Chat completions document token counts;
 * when the body also carries `metadata.cost` or OpenRouter's
 * `usage.cost`, that dollar figure is the claim. The derived fold counts
 * the same receipt in micro-dollars so the two agree. A receipt that is
 * missing settles at zero. Admission estimates are zero on purpose: the
 * price depends on the chosen model and the output.
 *
 * LIFECYCLE. A provider `start` relays the synchronous endpoints (chat,
 * images, model reads) and turns a 2xx that is not a usable result into
 * a non-2xx, so the engine zero-bills it. Video overrides `start` and
 * adds `poll` and `stop` — a provider-level poll would make the
 * synchronous endpoints pollable.
 */
export const dollarClaim: UsageConsolidateFn = ({ data, utils }) => {
    const kind = utils.json.optionalStr(data.usage, "$.model.kind");
    const metadataCost = utils.json.optionalNum(
        data.output,
        "$.metadata.cost",
    );
    const usageCost = utils.json.optionalNum(data.output, "$.usage.cost");
    const dollars = metadataCost !== undefined ? metadataCost : usageCost;
    const currency = utils.json.optionalStr(
        data.output,
        "$.metadata.cost_currency",
    );
    const billed = kind !== "FREE" && dollars !== undefined && dollars > 0 &&
            (currency === undefined || currency === "USD")
        ? Math.round(dollars * 1_000_000) * 0.000001
        : undefined;
    return {
        credits: {
            ...(billed !== undefined ? { default: billed } : {}),
        },
        output: data.output,
    };
};

export default defineProvider({
    name: "lumenfall",
    meta: {
        displayName: "Lumenfall",
        summary: "One OpenAI-compatible API for chat, image, and video models.",
        description: "Generate text, images, and video through Lumenfall's " +
            "OpenAI-compatible API. Chat uses any OpenRouter model id. " +
            "Images and video use Lumenfall model ids and are normalized " +
            "across the provider that actually runs the request. Video is " +
            "asynchronous: a request returns a job id and the run polls " +
            "until the file is ready. The bill is the USD amount on the " +
            "response, which depends on the model and the output.",
        homepageUrl: "https://lumenfall.ai",
        docsUrl: "https://docs.lumenfall.ai",
        categories: [
            "text-generation",
            "image-generation",
            "video-generation",
        ],
        notes: [
            "The pre-run estimate is zero. Lumenfall prices each model " +
            "separately, and the authoritative charge is metadata.cost " +
            "in USD on the completed response (usage.cost on a chat " +
            "receipt that uses that field).",
            "A successful response with no USD receipt settles at zero. " +
            "Media responses are documented to include metadata.cost; a " +
            "2xx image body without a USD cost or an image is rejected.",
            "Streaming chat is not available. The run returns one JSON " +
            "completion.",
            "Image edits and video reference images are https URLs or " +
            "data URIs. This connector does not upload multipart file bytes.",
            "Generated video URLs expire. Save the file before expires_at.",
        ],
    },
    auth: { inject: presets.auth.bearer() },
    request: { baseUrl: "https://api.lumenfall.ai/openai/v1" },
    timeouts: { requestMs: 30_000, runMs: 45_000 },
    usage: {
        /** THE credit system: Lumenfall meters a prepaid or invoiced
         *  balance in US dollars. The pool is dollars. */
        credits: { default: { label: "US dollars" } },
        consolidate: dollarClaim,
    },
    lifecycle: {
        /**
         * Synchronous relay for chat, images and model reads. Video
         * replaces this. Outcomes:
         *   - vendor non-2xx → relayed (engine zero-bills)
         *   - image edit with neither prompt nor scale_factor → 400,
         *     no transport call
         *   - 2xx that is not a usable chat or image, or a non-USD
         *     currency → synthesized 502
         *   - 2xx model read or a valid chat/image → relayed
         */
        start: async ({ data, utils, logger }) => {
            const url = data.request.url;
            const editing = url.endsWith("/images/edits");
            if (editing) {
                const body = data.input.body ?? {};
                const prompt = utils.json.optionalStr(body, "$.prompt");
                const scale = utils.json.optionalNum(body, "$.scale_factor");
                if (
                    prompt === undefined && !(scale !== undefined && scale > 0)
                ) {
                    return {
                        kind: "COMPLETED",
                        httpStatus: 400,
                        output: {
                            error: {
                                code: "missing_edit_instruction",
                                message:
                                    "Image edits need a prompt, or scale_factor when calling an upscale model.",
                            },
                        },
                    };
                }
            }
            const res = await utils.request();
            if (res.status < 200 || res.status >= 300) {
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                };
            }
            const error = utils.json.optionalGet(res.body, "$.error");
            if (error !== undefined && error !== null) {
                logger.warn("lumenfall 2xx carried an error object", {
                    status: res.status,
                });
                return {
                    kind: "COMPLETED",
                    httpStatus: 502,
                    providerHttpStatus: res.status,
                    output: res.body,
                };
            }
            const currency = utils.json.optionalStr(
                res.body,
                "$.metadata.cost_currency",
            );
            if (currency !== undefined && currency !== "USD") {
                return {
                    kind: "COMPLETED",
                    httpStatus: 502,
                    providerHttpStatus: res.status,
                    output: {
                        error: {
                            code: "unexpected_currency",
                            message:
                                "Lumenfall reported a cost currency other than USD.",
                        },
                    },
                };
            }
            if (url.endsWith("/chat/completions")) {
                const choices = utils.json.optionalGet(res.body, "$.choices");
                if (!Array.isArray(choices) || choices.length === 0) {
                    return {
                        kind: "COMPLETED",
                        httpStatus: 502,
                        providerHttpStatus: res.status,
                        output: {
                            error: {
                                code: "invalid_response",
                                message:
                                    "Lumenfall returned a chat response without choices.",
                            },
                        },
                    };
                }
            }
            if (
                url.endsWith("/images/generations") ||
                url.endsWith("/images/edits")
            ) {
                const images = utils.json.optionalGet(res.body, "$.data");
                const cost = utils.json.optionalNum(
                    res.body,
                    "$.metadata.cost",
                );
                const validImages = Array.isArray(images) &&
                    images.length > 0 &&
                    images.every((item) => {
                        if (
                            item === null || typeof item !== "object" ||
                            Array.isArray(item)
                        ) {
                            return false;
                        }
                        const imageUrl = item.url;
                        const b64 = item.b64_json;
                        const hasUrl = typeof imageUrl === "string" &&
                            imageUrl !== "";
                        const hasB64 = typeof b64 === "string" && b64 !== "";
                        return hasUrl || hasB64;
                    });
                if (!validImages || cost === undefined || cost < 0) {
                    logger.warn(
                        "lumenfall image response missing images or USD cost",
                        { validImages, hasCost: cost !== undefined },
                    );
                    return {
                        kind: "COMPLETED",
                        httpStatus: 502,
                        providerHttpStatus: res.status,
                        output: {
                            error: {
                                code: "invalid_response",
                                message:
                                    "Lumenfall returned an image response without a USD cost or an image.",
                            },
                        },
                    };
                }
            }
            return {
                kind: "COMPLETED",
                httpStatus: res.status,
                output: res.body,
            };
        },
    },
    output: {
        /** OpenAI-style error envelope `{error: {message, type, code}}`.
         *  The raw body stays under `raw`. */
        fromError: ({ data, utils }) => {
            const message = utils.json.optionalStr(
                data.output,
                "$.error.message",
            );
            const type = utils.json.optionalStr(data.output, "$.error.type");
            const code = utils.json.optionalStr(data.output, "$.error.code");
            const flat = utils.json.optionalStr(data.output, "$.message");
            return {
                message: message !== undefined
                    ? message
                    : flat !== undefined
                    ? flat
                    : "Lumenfall API error",
                ...(type !== undefined ? { type } : {}),
                ...(code !== undefined ? { code } : {}),
                raw: data.output,
            };
        },
    },
});
