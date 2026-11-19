import { assert, assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { type Json, RunKind, StopKind } from "@shared/core";
import {
    liveSkip,
    loadEndpoint,
    loadFixture,
    runEndpoint,
    testSealedUnit,
} from "@shared/testing";

const HERE = fromFileUrl(new URL("./", import.meta.url));
const fixture = (name: string) => loadFixture(`${HERE}fixtures/${name}.json`);

const CHAT = "lumenfall#chat/completions";
const IMAGE = "lumenfall#images/generations";
const EDIT = "lumenfall#images/edits";
const VIDEO = "lumenfall#videos";
const MODELS = "lumenfall#models";
const MODEL = "lumenfall#models/{model}";

const chatBody = {
    model: "google/gemini-3-flash-preview",
    messages: [{ role: "user", content: "Why are capybaras so chill?" }],
};
const imageBody = {
    model: "gemini-3-pro-image",
    prompt: "A capybara relaxing in a hot spring",
    n: 1,
    size: "1024x1024",
};
const videoBody = {
    model: "sora-2",
    prompt: "A capybara swimming in a pool",
    seconds: 5,
    size: "1920x1080",
};

/** The receipt and the micro-dollar fold, computed the same way the fns do. */
const receipt = (dollars: number) => {
    const micros = Math.round(dollars * 1_000_000);
    return {
        credits: { default: micros * 0.000001 },
        evidence: { CREDIT: micros },
    };
};

const replay = async (
    id: string,
    name: string,
    input: { body?: Json; pathParams?: Record<string, string> },
) => await runEndpoint({
    unit: await testSealedUnit(id),
    input,
    mode: "replay",
    fixture: await fixture(name),
});

Deno.test("lumenfall image: a USD receipt settles and the image stays", async () => {
    const result = await replay(IMAGE, "synthetic-image-ok", {
        body: imageBody,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);
    assertEquals(result.usage, receipt(0.04));
    const output = result.output as { data: Array<{ url: string }> };
    assertEquals(output.data[0].url, "https://media.lumenfall.ai/abc123.png");
});

Deno.test("lumenfall image: base64 output with a receipt settles", async () => {
    const result = await replay(IMAGE, "synthetic-image-b64", {
        body: { ...imageBody, response_format: "b64_json" },
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, receipt(0.04));
});

Deno.test("lumenfall image: a 200 without an image or a cost is not billed", async () => {
    const result = await replay(IMAGE, "synthetic-image-invalid", {
        body: imageBody,
    });
    assertEquals(result.httpStatus, 502);
    assertEquals(result.providerHttpStatus, 200);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    assertEquals(
        (result.output as { code: string }).code,
        "invalid_response",
    );
});

Deno.test("lumenfall image: a non-USD currency is rejected", async () => {
    const result = await replay(IMAGE, "synthetic-currency", {
        body: imageBody,
    });
    assertEquals(result.httpStatus, 502);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    assertEquals(
        (result.output as { code: string }).code,
        "unexpected_currency",
    );
});

Deno.test("lumenfall image: the pre-run estimate is zero", async () => {
    const loaded = await loadEndpoint({
        unit: await testSealedUnit(IMAGE),
        input: { body: imageBody },
        mode: "replay",
    });
    assertEquals(loaded.estimate({ body: imageBody }), {
        credits: {},
        evidence: {},
    });
});

Deno.test("lumenfall edit: an image URL settles like generation", async () => {
    const result = await replay(EDIT, "synthetic-image-ok", {
        body: {
            model: "gemini-3-pro-image",
            image: "https://example.com/capybara.png",
            prompt: "Add a red hat",
        },
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, receipt(0.04));
});

Deno.test("lumenfall edit: scale_factor alone is sent", async () => {
    const result = await replay(EDIT, "synthetic-image-ok", {
        body: {
            model: "upscale",
            image: "https://example.com/capybara.png",
            scale_factor: 2,
        },
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, receipt(0.04));
});

Deno.test("lumenfall edit: neither prompt nor scale_factor never calls upstream", async () => {
    const result = await runEndpoint({
        unit: await testSealedUnit(EDIT),
        input: {
            body: {
                model: "gemini-3-pro-image",
                image: "https://example.com/capybara.png",
            },
        },
        mode: "replay",
    });
    assertEquals(result.httpStatus, 400);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    assertEquals(
        (result.output as { code: string }).code,
        "missing_edit_instruction",
    );
});

Deno.test("lumenfall chat: metadata.cost settles and the message stays", async () => {
    const result = await replay(CHAT, "synthetic-chat-ok", { body: chatBody });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, receipt(0.04));
    const output = result.output as {
        choices: Array<{ message: { content: string } }>;
        usage: { total_tokens: number };
    };
    assertEquals(output.choices[0].message.content, "Capybaras are calm.");
    assertEquals(output.usage.total_tokens, 18);
});

Deno.test("lumenfall chat: usage.cost settles when metadata.cost is absent", async () => {
    const result = await replay(CHAT, "synthetic-chat-usage-cost", {
        body: chatBody,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, receipt(0.04));
});

Deno.test("lumenfall chat: no dollar receipt succeeds at zero", async () => {
    const result = await replay(CHAT, "synthetic-chat-no-cost", {
        body: chatBody,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);
    assertEquals(result.usage, { credits: {}, evidence: {} });
});

Deno.test("lumenfall chat: empty choices are not billed", async () => {
    const result = await replay(CHAT, "synthetic-chat-empty", {
        body: chatBody,
    });
    assertEquals(result.httpStatus, 502);
    assertEquals(result.usage, { credits: {}, evidence: {} });
});

Deno.test("lumenfall: a vendor error is data at zero usage", async () => {
    const result = await replay(CHAT, "synthetic-provider-error", {
        body: chatBody,
    });
    assertEquals(result.httpStatus, 401);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    assertEquals(result.output, {
        message: "Invalid API key",
        type: "authentication_error",
        code: "AUTHENTICATION_FAILED",
        raw: {
            error: {
                message: "Invalid API key",
                type: "authentication_error",
                code: "AUTHENTICATION_FAILED",
            },
        },
    });
});

Deno.test("lumenfall models: the list is free", async () => {
    const result = await replay(MODELS, "synthetic-models-ok", {});
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    const output = result.output as { data: Array<{ id: string }> };
    assertEquals(output.data[0].id, "gemini-3-pro-image");
});

Deno.test("lumenfall models: one model is free", async () => {
    const result = await replay(MODEL, "synthetic-model-ok", {
        pathParams: { model: "gemini-3-pro-image" },
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    assertEquals(
        (result.output as { id: string }).id,
        "gemini-3-pro-image",
    );
});

Deno.test("lumenfall models: an unknown id is a 404 at no charge", async () => {
    const result = await replay(MODEL, "synthetic-model-missing", {
        pathParams: { model: "missing" },
    });
    assertEquals(result.httpStatus, 404);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    assertEquals(
        (result.output as { message: string }).message,
        "Model 'missing' not found",
    );
});

Deno.test("lumenfall video: polls to a file and settles metadata.cost", async () => {
    const result = await replay(VIDEO, "synthetic-video-ok", {
        body: videoBody,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);
    assertEquals(result.usage, receipt(0.21));
    const output = result.output as { status: string; output: { url: string } };
    assertEquals(output.status, "completed");
    assertEquals(
        output.output.url,
        "https://media.lumenfall.ai/video_abc123.mp4",
    );
});

Deno.test("lumenfall video: a failed job is not billed", async () => {
    const result = await replay(VIDEO, "synthetic-video-failed", {
        body: videoBody,
    });
    assertEquals(result.httpStatus, 500);
    assertEquals(result.providerHttpStatus, 200);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    assertEquals(
        (result.output as { message: string }).message,
        "The provider rejected the prompt.",
    );
});

Deno.test("lumenfall video: completed without a file is not billed", async () => {
    const result = await replay(VIDEO, "synthetic-video-no-output", {
        body: videoBody,
    });
    assertEquals(result.httpStatus, 502);
    assertEquals(result.providerHttpStatus, 200);
    assertEquals(result.usage, { credits: {}, evidence: {} });
});

Deno.test("lumenfall video: a rejected submit does not poll or bill", async () => {
    const result = await replay(VIDEO, "synthetic-video-rejected", {
        body: videoBody,
    });
    assertEquals(result.httpStatus, 402);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    assertEquals(
        (result.output as { code: string }).code,
        "INSUFFICIENT_BALANCE",
    );
});

Deno.test("lumenfall video: stop settles a job that already completed", async () => {
    const input = { body: videoBody };
    const loaded = await loadEndpoint({
        unit: await testSealedUnit(VIDEO),
        input,
        mode: "replay",
        fixture: await fixture("synthetic-video-stop-settled"),
    });
    const started = await loaded.start(input, { runId: "run-1" });
    assert(started.kind === RunKind.RUNNING);
    const stopped = await loaded.stop(input, started.state, { runId: "run-1" });
    assert(stopped.kind === RunKind.COMPLETED);
    assertEquals(stopped.usage, receipt(0.21));
});

Deno.test("lumenfall video: stop of a job still running is unresolved", async () => {
    const input = { body: videoBody };
    const loaded = await loadEndpoint({
        unit: await testSealedUnit(VIDEO),
        input,
        mode: "replay",
        fixture: await fixture("synthetic-video-stop-open"),
    });
    const started = await loaded.start(input, { runId: "run-2" });
    assert(started.kind === RunKind.RUNNING);
    const stopped = await loaded.stop(input, started.state, { runId: "run-2" });
    assertEquals(stopped.kind, StopKind.UNRESOLVED);
});

Deno.test("lumenfall: schemas reject before the wire", async () => {
    const rejects = async (
        id: string,
        input: { body?: Json; pathParams?: Record<string, string> },
    ) => {
        await assertRejects(
            async () =>
                await runEndpoint({
                    unit: await testSealedUnit(id),
                    input,
                    mode: "replay",
                }),
            Error,
            "INVALID_INPUT",
        );
    };
    await rejects(CHAT, { body: { model: "m", messages: [] } });
    await rejects(CHAT, {
        body: { ...chatBody, stream: true },
    });
    await rejects(IMAGE, { body: { model: "m" } });
    await rejects(IMAGE, { body: { ...imageBody, n: 0 } });
    await rejects(EDIT, {
        body: {
            model: "m",
            image: "http://example.com/a.png",
            prompt: "x",
        },
    });
    await rejects(VIDEO, {
        body: { ...videoBody, negative_prompt: "x".repeat(5001) },
    });
    await rejects(MODEL, { pathParams: { model: "" } });
});

Deno.test({
    name: "lumenfall image live (gated on LUMENFALL_CREDENTIALS_API_KEY)",
    ignore: liveSkip("lumenfall"),
    fn: async () => {
        const result = await runEndpoint({
            unit: await testSealedUnit(IMAGE),
            input: { body: imageBody },
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        assert(result.usage.evidence.CREDIT > 0);
    },
});

Deno.test({
    name: "lumenfall models live (gated on LUMENFALL_CREDENTIALS_API_KEY)",
    ignore: liveSkip("lumenfall"),
    fn: async () => {
        const result = await runEndpoint({
            unit: await testSealedUnit(MODELS),
            input: {},
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        assertEquals(result.usage, { credits: {}, evidence: {} });
        assert(Array.isArray((result.output as { data: unknown }).data));
    },
});
