import { z } from "zod";
import { zMediaUrl } from "../../../schema/images.ts";

const zReference = z.object({
    image_url: zMediaUrl,
}).strict();

/** POST /videos body. JSON only. Multipart file uploads are not sent.
 *  Vendor mirror (docs.lumenfall.ai/api-reference/videos/generate,
 *  2026-11-19), optionality only. `duration` is a vendor alias of
 *  `seconds` and is not a second field here. */
export const zVideoBody = z.object({
    prompt: z.string().min(1).describe(
        "What the video should show. Maximum length varies by model.",
    ),
    model: z.string().min(1).describe(
        "Lumenfall video model id, for example sora-2.",
    ),
    seconds: z.union([z.number().positive(), z.string().min(1)]).optional()
        .describe(
            "Duration in seconds, as a number or a numeric string. " +
                "Supported lengths vary by model.",
        ),
    size: z.string().min(1).optional().describe(
        "WIDTHxHEIGHT such as 1920x1080, or an aspect ratio such as 16:9. " +
            "Supported sizes vary by model.",
    ),
    n: z.number().int().min(1).max(4).optional().describe(
        "How many videos to generate, from 1 to 4. Omitted, Lumenfall uses 1.",
    ),
    aspect_ratio: z.string().min(1).optional().describe(
        "Aspect ratio such as 16:9, 9:16 or 1:1. Converted per provider.",
    ),
    resolution: z.string().min(1).optional().describe(
        "Resolution shorthand such as 720p or 1080p. Converted per provider.",
    ),
    input_reference: z.union([zReference, z.array(zReference).min(1)])
        .optional().describe(
            "Reference image or images for image-to-video. One object or " +
                "an array of {image_url}. Most models accept at most one. " +
                "Pass an https URL or a data URI, not a file upload.",
        ),
    negative_prompt: z.string().max(5000).optional().describe(
        "What the video should avoid. At most 5000 characters.",
    ),
    media_retention: z.string().min(1).optional().describe(
        "How long Lumenfall keeps the generated file. See Lumenfall media retention.",
    ),
    webhook_url: z.string().min(1).optional().describe(
        "URL Lumenfall notifies when the video completes or fails. The run " +
            "still polls until it finishes.",
    ),
    idempotency_key: z.string().min(1).max(256).optional().describe(
        "Repeat-safe key, at most 256 characters. A repeat returns the " +
            "existing video instead of starting another.",
    ),
    metadata: z.record(z.string(), z.string()).optional().describe(
        "String key-value pairs stored on the video object.",
    ),
    user: z.string().min(1).optional().describe(
        "A caller-chosen end-user id. Only some providers read it.",
    ),
}).strict();
