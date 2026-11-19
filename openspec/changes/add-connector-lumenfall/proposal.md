# Proposal: add-connector-lumenfall

## Why

Lumenfall is an OpenAI-compatible gateway for chat, image, and video
generation. One Bearer key and one base URL reach many underlying models.
Monid has no connector for that surface. Adding it lets the generic engine
compile and execute the public generation API, settling each run on the
dollar receipt Lumenfall already returns.

## What Changes

- **connectors/lumenfall** — Bearer auth, base URL
  `https://api.lumenfall.ai/openai/v1`, one US-dollar credit pool:
  - `POST /chat/completions` — one JSON chat completion. Any OpenRouter
    model id. Streaming is not accepted.
  - `POST /images/generations` — text to image.
  - `POST /images/edits` — edit or upscale from https URLs or data URIs.
    The vendor's multipart file upload is not sent; the engine speaks JSON.
  - `POST /videos` — async text-to-video and image-to-video. Submit, poll
    `GET /videos/{id}` until completed or failed, and best-effort cancel
    on stop.
  - `GET /models` and `GET /models/{model}` — free model catalog reads.
- **Billing.** No single published rate covers every model. Successful
  runs claim `metadata.cost` in USD (chat falls back to `usage.cost`).
  The rate card counts that receipt in micro-dollars so the derived fold
  matches the claim. Admission estimates are zero. A media 2xx without an
  image or a USD cost is a synthesized 502 at zero usage.
- **New category leaf** `text-generation`.
- Synthetic fixtures and sealed-unit tests. Live smoke tests stay gated
  on `LUMENFALL_CREDENTIALS_API_KEY`.

## Capabilities

- `lumenfall-connector`.

## Non-goals

- Account endpoints: balance, API keys, request history, webhook secret.
- Multipart binary uploads for image edits and video references.
- Streaming chat completions.
- A pinned per-model rate card. Prices live on the response.
- Recorded live fixtures. No vendor key is held in this repo.

## Impact

New connector tree, six ids in `connectors/ids.lock.json`, one category
leaf, and a short README note. No engine, schema, or compiler change.
`ENGINE_VERSION` stays put.
