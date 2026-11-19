import { defineEndpoint, UsageModelKind } from "@shared/core";

export default defineEndpoint({
    meta: {
        displayName: "Lumenfall List Models",
        summary: "List the model ids Lumenfall can run.",
        description: "Return every model id currently available through " +
            "Lumenfall, with the organization that publishes it. Use an " +
            "id from this list as the model field on chat, image, or " +
            "video. This call is free. It does not include prices; the " +
            "charge for a generation is on that generation's response.",
        docsUrl: "https://docs.lumenfall.ai/api-reference/models/list",
        categories: [
            "text-generation",
            "image-generation",
            "video-generation",
        ],
    },
    request: { method: "GET", path: "/models" },
    usage: { model: { kind: UsageModelKind.FREE } },
});
