import { Unit, type UsageEvidenceFn, UsageModelKind } from "@shared/core";

/**
 * Lumenfall bills US dollars and puts the authoritative figure on the
 * response (`metadata.cost`, docs.lumenfall.ai/billing, checked 2026-11-19).
 * Chat completions routed through OpenRouter may instead report
 * `usage.cost`. There is no single published rate: hundreds of models,
 * and the catalog price is approximate until the response arrives.
 *
 * The rate card therefore counts micro-dollars (1e-6 USD) read off that
 * receipt. `metadata.cost` wins when both fields are present. A missing
 * or non-positive receipt counts nothing, so the derived fold is zero
 * and an empty vendor claim falls back to that fold. Keep this read in
 * lockstep with `provider.ts` `usage.consolidate`.
 */
export const dollarMicrosModel = {
    kind: UsageModelKind.PER_UNIT,
    unit: Unit.CREDIT,
    every: 1,
    label: "micro-dollars",
    description:
        "Lumenfall's USD receipt converted to millionths of a dollar. " +
        "One million micro-dollars equal one US dollar.",
    consumes: { credit: "default", amount: 0.000001 },
} as const;

/** Admission estimates are zero: the price depends on the model and the
 *  output, which this pure fn cannot know. Settlement uses the receipt. */
export const zeroDollarEstimate = () => ({ counts: {} });

export const dollarEvidence: UsageEvidenceFn = ({ data, utils }) => {
    const metadataCost = utils.json.optionalNum(
        data.output,
        "$.metadata.cost",
    );
    const usageCost = utils.json.optionalNum(data.output, "$.usage.cost");
    const dollars = metadataCost !== undefined ? metadataCost : usageCost;
    const currency = utils.json.optionalStr(
        data.output,
        "$.metadata.cost_currency",
    );
    const micros = dollars !== undefined && dollars > 0 &&
            (currency === undefined || currency === "USD")
        ? Math.round(dollars * 1_000_000)
        : undefined;
    return {
        counts: {
            ...(micros !== undefined ? { CREDIT: micros } : {}),
        },
    };
};
