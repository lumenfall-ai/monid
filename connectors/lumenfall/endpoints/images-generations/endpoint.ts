import { defineEndpoint } from "@shared/core";
import { zImageGenerateBody } from "../../schema/images.ts";
import {
    dollarEvidence,
    dollarMicrosModel,
    zeroDollarEstimate,
} from "../../schema/usage.ts";

export default defineEndpoint<
    typeof dollarMicrosModel,
    typeof zImageGenerateBody
>({
    meta: {
        displayName: "Lumenfall Generate Images",
        summary:
            "Generate images from a text prompt with a Lumenfall image model.",
        description: "Create one or more images from a prompt. Pass a " +
            "Lumenfall image model id such as gemini-3-pro-image, " +
            "gpt-image-1.5 or flux.2-max. Size, quality, format and " +
            "prompt enhancement are normalized across the provider that " +
            "runs the request. The response is OpenAI-shaped: data[].url " +
            "or data[].b64_json, plus metadata.cost in USD, which is the " +
            "charge. A 2xx body without an image or a USD cost is " +
            "rejected and not billed. The pre-run estimate is zero " +
            "because each model has its own price.",
        docsUrl: "https://docs.lumenfall.ai/api-reference/images/generate",
        categories: ["image-generation"],
        notes: [
            "Supported sizes and quality values depend on the model. A value the model rejects comes back as a vendor error at zero usage.",
            "Hosted image URLs are on media.lumenfall.ai. Save them if you need the file after the URL expires.",
        ],
    },
    request: { method: "POST", path: "/images/generations" },
    input: { schema: { body: zImageGenerateBody } },
    timeouts: { requestMs: 180_000, runMs: 200_000 },
    usage: {
        model: dollarMicrosModel,
        estimate: zeroDollarEstimate,
        evidence: dollarEvidence,
    },
});
