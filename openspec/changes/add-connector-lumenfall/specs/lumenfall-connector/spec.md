# lumenfall-connector (delta)

## ADDED Requirements

### Requirement: Lumenfall provider
The provider SHALL declare name `lumenfall`, Bearer authentication, base
URL `https://api.lumenfall.ai/openai/v1`, and one credit pool named
`default` labeled US dollars. A successful run that carries
`metadata.cost` in USD SHALL settle that amount. A chat run with no
`metadata.cost` SHALL settle `usage.cost` when that field is a positive
number of USD. The pre-run estimate SHALL be zero credits.

#### Scenario: An image receipt settles
- **WHEN** image generation returns a URL and `metadata.cost` of 0.04 USD
- **THEN** the run completes with that image URL
- **AND** usage credits for `default` equal 0.04

#### Scenario: A vendor error is not billed
- **WHEN** the vendor returns a non-2xx error envelope
- **THEN** the run completes as a provider error with zero usage

### Requirement: Chat, images, and model reads
The connector SHALL expose chat completions, image generation, image
edits, a model list, and a single-model read. Chat SHALL require a model
and at least one message, and SHALL NOT accept `stream`. Image edits
SHALL accept https URLs or data URIs. An edit with neither `prompt` nor
`scale_factor` SHALL fail before any upstream call. Model reads SHALL be
free. A 2xx image body without an image or a non-negative USD cost SHALL
complete as a provider error with zero usage.

#### Scenario: Edit instruction required
- **WHEN** an edit supplies an image and neither a prompt nor scale_factor
- **THEN** the run completes with HTTP 400 and zero usage
- **AND** no upstream request is made

### Requirement: Asynchronous video
The connector SHALL expose video generation as a lifecycle run. A queued
submit SHALL be polled until `completed` or `failed`. A completed video
with `output.url` and a USD cost SHALL settle that cost. A failed video,
a rejected submit, and a completed video without a file SHALL settle at
zero. Stop SHALL cancel the job and, when the follow-up read is already
completed, settle that cost. A job still in progress after cancel SHALL
be unresolved.

#### Scenario: A video completes
- **WHEN** submit returns a video id and a later poll is completed with a file and a cost
- **THEN** the run output includes that file URL
- **AND** usage settles from `metadata.cost`
