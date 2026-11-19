import { z } from "zod";

/** HTTPS URL or base64 data URI. Lumenfall's edit and video reference
 *  fields accept both (docs.lumenfall.ai, checked 2026-11-19). */
export const zMediaUrl = z.string().regex(
    /^(https:\/\/\S+|data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+)$/,
).describe(
    "An https URL or a base64 data URI (data:image/...;base64,...).",
);

const zImageKnobs = {
    model: z.string().min(1).describe(
        "Lumenfall model id, for example gemini-3-pro-image or gpt-image-1.5.",
    ),
    n: z.number().int().min(1).max(10).optional().describe(
        "How many images to generate, from 1 to 10. Some models only allow 1. " +
            "Omitted, Lumenfall uses 1.",
    ),
    size: z.string().min(1).optional().describe(
        "Output size. Common values are 256x256, 512x512, 1024x1024, " +
            "1024x1792 and 1792x1024. Supported sizes vary by model. " +
            "Omitted, Lumenfall uses 1024x1024.",
    ),
    quality: z.string().min(1).optional().describe(
        "Quality tier. Generation commonly uses standard or hd. Edits also " +
            "accept auto, low, medium and high. Supported values vary by model.",
    ),
    response_format: z.enum(["url", "b64_json"]).optional().describe(
        "url returns a hosted image URL. b64_json returns the bytes inline. " +
            "Omitted, Lumenfall returns a URL.",
    ),
    output_format: z.enum(["png", "jpeg", "gif", "webp", "avif"]).optional()
        .describe(
            "File format. avif is limited to 1600px on the longest side. " +
                "Omitted, Lumenfall uses png.",
        ),
    output_compression: z.number().int().min(1).max(100).optional().describe(
        "Compression quality for jpeg, webp and avif, from 1 to 100. " +
            "Omitted, Lumenfall uses 100.",
    ),
    thinking: z.string().min(1).optional().describe(
        "Reasoning effort. Models advertise their own set, commonly a " +
            "subset of off, on, minimal and high. thinking_level is a " +
            "vendor alias this connector does not send.",
    ),
    prompt_enhancement: z.enum(["on", "off"]).optional().describe(
        "Whether Lumenfall rewrites the prompt before generation. A rewrite " +
            "comes back as revised_prompt. Omitted, the model default is used.",
    ),
    user: z.string().min(1).optional().describe(
        "A caller-chosen end-user id. Only some providers read it.",
    ),
};

/** POST /images/generations body. Vendor mirror, optionality only. */
export const zImageGenerateBody = z.object({
    prompt: z.string().min(1).describe(
        "What the image should show. Maximum length varies by model.",
    ),
    style: z.enum(["vivid", "natural"]).optional().describe(
        "Style hint. Only some models, such as DALL-E 3, read it.",
    ),
    ...zImageKnobs,
}).strict();

/** POST /images/edits body. The vendor's documented upload is multipart
 *  file bytes. This connector sends JSON: image and mask are https URLs
 *  or data URIs, because the engine speaks JSON only. */
export const zImageEditBody = z.object({
    image: z.union([zMediaUrl, z.array(zMediaUrl).min(1)]).describe(
        "The image or images to edit, as https URLs or data URIs. One " +
            "string or an array. Binary multipart uploads are not sent.",
    ),
    prompt: z.string().min(1).optional().describe(
        "The edit to make. Required except when calling an upscale model, " +
            "which takes scale_factor instead.",
    ),
    mask: zMediaUrl.optional().describe(
        "Optional PNG mask URL or data URI. Fully transparent pixels are " +
            "the region to edit. Must match the source dimensions.",
    ),
    scale_factor: z.number().positive().optional().describe(
        "Upscale multiplier on each axis, used only by upscale models. " +
            "Ignored by other models. Omitted, the upscale model uses its default.",
    ),
    ...zImageKnobs,
}).strict();
