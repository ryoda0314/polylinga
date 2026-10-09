// Token accounting for content scripts, so a big run shows what it cost.
// Prices are assumptions (USD per 1M tokens); check the OpenAI dashboard for the real bill.

const totals = { calls: 0, input: 0, cached: 0, output: 0, reasoning: 0 };

export function track(completion) {
  const u = completion?.usage;
  if (!u) return;
  totals.calls++;
  totals.input += u.prompt_tokens ?? 0;
  totals.cached += u.prompt_tokens_details?.cached_tokens ?? 0;
  totals.output += u.completion_tokens ?? 0;
  totals.reasoning += u.completion_tokens_details?.reasoning_tokens ?? 0;
}

export function report(label) {
  const inPrice = Number(process.env.OPENAI_PRICE_INPUT_PER_M ?? 1.75);
  const outPrice = Number(process.env.OPENAI_PRICE_OUTPUT_PER_M ?? 14);
  const usd = (totals.input * inPrice + totals.output * outPrice) / 1e6;
  console.log(
    `[usage] ${label}: ${totals.calls} calls · ${totals.input} input tokens (${totals.cached} cached) · ` +
      `${totals.output} output tokens (${totals.reasoning} reasoning) · about $${usd.toFixed(2)} ` +
      `at $${inPrice}/$${outPrice} per 1M (assumed)`,
  );
}

/** Small CLI helper: --name=value or default. */
export function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
