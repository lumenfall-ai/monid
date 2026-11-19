import { defineEndpoint } from "@shared/core";
import {
    dollarEvidence,
    dollarMicrosModel,
    zeroDollarEstimate,
} from "../../schema/usage.ts";
import { zVideoBody } from "./schema/inputs.ts";

export default defineEndpoint<typeof dollarMicrosModel, typeof zVideoBody>({
    meta: {
        displayName: "Lumenfall Generate Video",
        summary:
            "Generate a video from a prompt or a reference image, and poll until it is ready.",
        description: "Submit a text prompt, or a prompt plus reference " +
            "image URLs, to a Lumenfall video model such as sora-2. The " +
            "vendor returns a queued job. This run polls GET /videos/{id} " +
            "until the status is completed or failed, then returns the " +
            "video object. A completed job includes output.url, which " +
            "expires, and metadata.cost in USD, which is the charge. " +
            "Failed jobs and a completed job with no file or no USD cost " +
            "are not billed. Stopping the run asks Lumenfall to cancel " +
            "the job, then reads it once: a job that already finished " +
            "still settles its cost. The pre-run estimate is zero " +
            "because each model has its own price.",
        docsUrl: "https://docs.lumenfall.ai/api-reference/videos/generate",
        categories: ["video-generation"],
        notes: [
            "Polls every 5 seconds for up to 30 minutes. Statuses queued and in_progress stay in flight. An unrecognized status stays in flight rather than failing the job.",
            "Reference images are https URLs or data URIs. Multipart file uploads are not sent.",
            "Download output.url before expires_at.",
            "Cancel is best-effort. A video that has already completed is not undone, and its cost still settles.",
        ],
    },
    request: { method: "POST", path: "/videos" },
    input: { schema: { body: zVideoBody } },
    timeouts: { requestMs: 60_000, runMs: 1_800_000, pollMs: 5_000 },
    usage: {
        model: dollarMicrosModel,
        estimate: zeroDollarEstimate,
        evidence: dollarEvidence,
    },
    lifecycle: {
        start: async ({ utils, logger }) => {
            const res = await utils.request();
            if (res.status < 200 || res.status >= 300) {
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                };
            }
            const id = utils.json.optionalStr(res.body, "$.id");
            if (id === undefined) {
                logger.warn("lumenfall video submit returned no id", {
                    status: res.status,
                });
                return {
                    kind: "COMPLETED",
                    httpStatus: 502,
                    providerHttpStatus: res.status,
                    output: res.body,
                };
            }
            const status = utils.json.optionalStr(res.body, "$.status");
            if (status === "failed") {
                return {
                    kind: "COMPLETED",
                    httpStatus: 500,
                    providerHttpStatus: res.status,
                    output: res.body,
                };
            }
            if (status === "completed") {
                const outputUrl = utils.json.optionalStr(
                    res.body,
                    "$.output.url",
                );
                const cost = utils.json.optionalNum(
                    res.body,
                    "$.metadata.cost",
                );
                const currency = utils.json.optionalStr(
                    res.body,
                    "$.metadata.cost_currency",
                );
                if (
                    outputUrl === undefined || cost === undefined ||
                    cost < 0 ||
                    (currency !== undefined && currency !== "USD")
                ) {
                    return {
                        kind: "COMPLETED",
                        httpStatus: 502,
                        providerHttpStatus: res.status,
                        output: res.body,
                    };
                }
                return {
                    kind: "COMPLETED",
                    httpStatus: 200,
                    providerHttpStatus: res.status,
                    output: res.body,
                };
            }
            return {
                kind: "RUNNING",
                state: {
                    externalRunId: id,
                    ...(status !== undefined ? { stage: status } : {}),
                },
            };
        },
        poll: async ({ data, utils, logger }) => {
            const id = data.lifecycle.state.externalRunId;
            if (id === undefined) {
                throw Object.assign(
                    new Error("Lumenfall video poll without externalRunId"),
                    { retriable: false },
                );
            }
            const res = await utils.http({
                method: "GET",
                url: data.request.url + "/" + id,
            });
            if (res.status >= 500) {
                throw new Error(
                    "Lumenfall video poll returned " + String(res.status),
                );
            }
            if (res.status < 200 || res.status >= 300) {
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                };
            }
            const status = utils.json.optionalStr(res.body, "$.status");
            if (
                status === "queued" || status === "in_progress" ||
                status === undefined
            ) {
                return {
                    kind: "RUNNING",
                    state: {
                        externalRunId: id,
                        ...(status !== undefined ? { stage: status } : {}),
                    },
                };
            }
            if (status === "failed") {
                logger.warn("lumenfall video failed", { id });
                return {
                    kind: "COMPLETED",
                    httpStatus: 500,
                    providerHttpStatus: res.status,
                    output: res.body,
                };
            }
            if (status !== "completed") {
                logger.warn(
                    "lumenfall video status unrecognized — treating as in flight",
                    { id, status },
                );
                return {
                    kind: "RUNNING",
                    state: { externalRunId: id, stage: status },
                };
            }
            const outputUrl = utils.json.optionalStr(res.body, "$.output.url");
            const cost = utils.json.optionalNum(res.body, "$.metadata.cost");
            const currency = utils.json.optionalStr(
                res.body,
                "$.metadata.cost_currency",
            );
            if (
                outputUrl === undefined || cost === undefined || cost < 0 ||
                (currency !== undefined && currency !== "USD")
            ) {
                return {
                    kind: "COMPLETED",
                    httpStatus: 502,
                    providerHttpStatus: res.status,
                    output: res.body,
                };
            }
            return {
                kind: "COMPLETED",
                httpStatus: 200,
                providerHttpStatus: res.status,
                output: res.body,
            };
        },
        /** Best-effort cancel, then one read. A job that already
         *  completed settles. A job still queued or in progress is
         *  UNRESOLVED so the host can reconcile. */
        stop: async ({ data, utils, logger }) => {
            const id = data.lifecycle.state.externalRunId;
            if (id === undefined) return;
            const target = data.request.url + "/" + id;
            const deleted = await utils.http({ method: "DELETE", url: target });
            logger.warn("lumenfall video cancel attempted", {
                id,
                status: deleted.status,
            });
            const res = await utils.http({ method: "GET", url: target });
            if (res.status < 200 || res.status >= 300) {
                return {
                    kind: "UNRESOLVED",
                    reason: "Lumenfall video read after cancel returned " +
                        String(res.status),
                };
            }
            const status = utils.json.optionalStr(res.body, "$.status");
            if (status === "failed") {
                return {
                    kind: "COMPLETED",
                    httpStatus: 500,
                    providerHttpStatus: res.status,
                    output: res.body,
                };
            }
            if (status === "completed") {
                const outputUrl = utils.json.optionalStr(
                    res.body,
                    "$.output.url",
                );
                const cost = utils.json.optionalNum(
                    res.body,
                    "$.metadata.cost",
                );
                const currency = utils.json.optionalStr(
                    res.body,
                    "$.metadata.cost_currency",
                );
                if (
                    outputUrl === undefined || cost === undefined ||
                    cost < 0 ||
                    (currency !== undefined && currency !== "USD")
                ) {
                    return {
                        kind: "COMPLETED",
                        httpStatus: 502,
                        providerHttpStatus: res.status,
                        output: res.body,
                    };
                }
                return {
                    kind: "COMPLETED",
                    httpStatus: 200,
                    providerHttpStatus: res.status,
                    output: res.body,
                };
            }
            return {
                kind: "UNRESOLVED",
                reason: "Lumenfall video still " +
                    (status !== undefined ? status : "unreadable") +
                    " after cancel",
            };
        },
    },
});
