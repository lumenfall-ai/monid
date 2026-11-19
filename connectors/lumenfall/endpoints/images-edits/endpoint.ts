import { defineEndpoint } from "@shared/core";
import { zImageEditBody } from "../../schema/images.ts";
import {
    dollarEvidence,
    dollarMicrosModel,
    zeroDollarEstimate,
} from "../../schema/usage.ts";

export default defineEndpoint<typeof dollarMicrosModel, typeof zImageEditBody>({
    meta: {
        displayName: "Lumenfall Edit Images",
        summary: "Edit or upscale images by URL with a Lumenfall image model.",
        description: "Edit one or more images from a prompt, or upscale " +
            "them with an upscale model and scale_factor. Pass https " +
            "URLs or data URIs. An optional mask URL marks the region " +
            "to change. The response matches image generation: image " +
            "URLs or base64, and metadata.cost in USD, which is the " +
            "charge. A call with neither a prompt nor scale_factor is " +
            "rejected before it is sent. The pre-run estimate is zero " +
            "because each model has its own price.",
        docsUrl: "https://docs.lumenfall.ai/api-reference/images/edit",
        categories: ["image-generation"],
        notes: [
            "Lumenfall's documented edit upload is multipart file bytes. This connector sends JSON image URLs or data URIs instead, and does not upload local files.",
            "Upscale models take scale_factor and may omit prompt. Other models need a prompt.",
        ],
    },
    request: { method: "POST", path: "/images/edits" },
    input: { schema: { body: zImageEditBody } },
    timeouts: { requestMs: 180_000, runMs: 200_000 },
    usage: {
        model: dollarMicrosModel,
        estimate: zeroDollarEstimate,
        evidence: dollarEvidence,
    },
});
