# Tasks: add-connector-lumenfall

## Connector

- [x] Add the `text-generation` category leaf.
- [x] Add the provider: Bearer auth, dollar pool, receipt claim, sync relay, error digestion.
- [x] Add chat, image generation, image edit, video, and model endpoints.
- [x] Register the six ids in `connectors/ids.lock.json`.
- [x] Add synthetic fixtures and sealed-unit tests, plus gated live smokes.
- [x] Note the connector in the README.

## Verification

- [x] `deno fmt` and `deno lint` on the new tree.
- [x] `deno task check`.
- [x] `deno test` for `connectors/lumenfall` (23 passed, 2 credential-gated skips), then the full offline suite (1342 passed, 0 failed, 228 skipped).

## Follow-up

- [ ] Record live fixtures and run `deno task test:live` when a Lumenfall key is available.
- [ ] Revisit JSON image edits against the live multipart endpoint.
