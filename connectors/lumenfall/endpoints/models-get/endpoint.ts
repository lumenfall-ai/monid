import { defineEndpoint, UsageModelKind } from "@shared/core";
import { z } from "zod";

const zPath = z.object({
    model: z.string().min(1).describe(
        "Model id to read, for example gemini-3-pro-image. Ids that " +
            "contain a slash are percent-encoded in the path.",
    ),
}).strict();

export default defineEndpoint({
    meta: {
        displayName: "Lumenfall Get Model",
        summary: "Read one Lumenfall model id.",
        description: "Fetch one model by id: the id, when it was added, " +
            "and which organization publishes it. An unknown id is a " +
            "404 at no charge. This call is free and does not include " +
            "the model's price.",
        docsUrl: "https://docs.lumenfall.ai/api-reference/models/get",
        categories: [
            "text-generation",
            "image-generation",
            "video-generation",
        ],
    },
    request: { method: "GET", path: "/models/{model}" },
    input: { schema: { pathParams: zPath } },
    usage: { model: { kind: UsageModelKind.FREE } },
});
