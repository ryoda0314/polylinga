// Shared checks for pattern-library content (hand-written seed data and AI drafts alike).

export const LANGS = ["ja", "en", "ko", "zh"];

/**
 * Validate one batch of library content.
 * @param {{functions?: object[], patterns: object[], sentences: object[]}} data
 * @param {{knownPatterns?: Map<string, string>}} [opts] pattern id -> lang for patterns already in the database
 * @returns {{problems: string[], marks: {key: string, lang: string, pattern_id: string, start_index: number, end_index: number}[]}}
 */
export function validateLibrary(data, opts = {}) {
  const problems = [];
  const marks = [];
  const patternLang = new Map(opts.knownPatterns ?? []);
  for (const p of data.patterns) patternLang.set(p.id, p.lang);

  const functionIds = new Set((data.functions ?? []).map((f) => f.id));
  for (const f of data.functions ?? []) {
    for (const l of LANGS) if (!f.label?.[l]) problems.push(`function ${f.id}: missing label.${l}`);
  }

  const seenPatterns = new Set();
  for (const p of data.patterns) {
    if (seenPatterns.has(p.id)) problems.push(`pattern ${p.id}: duplicate id`);
    seenPatterns.add(p.id);
    if (!LANGS.includes(p.lang)) problems.push(`pattern ${p.id}: bad lang ${p.lang}`);
    if (!p.form?.trim()) problems.push(`pattern ${p.id}: empty form`);
    for (const l of LANGS) if (!p.meaning?.[l]?.trim()) problems.push(`pattern ${p.id}: missing meaning.${l}`);
    if (functionIds.size && p.function_id && !functionIds.has(p.function_id)) {
      problems.push(`pattern ${p.id}: unknown function ${p.function_id}`);
    }
  }

  const seenKeys = new Set();
  const seenTexts = new Map();
  for (const s of data.sentences) {
    if (seenKeys.has(s.key)) problems.push(`sentence ${s.key}: duplicate key`);
    seenKeys.add(s.key);
    for (const l of LANGS) {
      const text = s[l]?.trim();
      if (!text) {
        problems.push(`sentence ${s.key}: missing ${l}`);
        continue;
      }
      if (text.length > 120) problems.push(`sentence ${s.key}: ${l} longer than 120 characters`);
      const dup = seenTexts.get(`${l}:${text}`);
      if (dup) problems.push(`sentence ${s.key}: same ${l} text as ${dup}`);
      seenTexts.set(`${l}:${text}`, s.key);

      const mark = s.marks?.[l];
      if (!mark) continue;
      const [patternId, sub] = mark;
      const lang = patternLang.get(patternId);
      if (!lang) {
        problems.push(`sentence ${s.key}: unknown pattern ${patternId}`);
        continue;
      }
      if (lang !== l) problems.push(`sentence ${s.key}: pattern ${patternId} is ${lang}, used for ${l}`);
      if (!sub) {
        problems.push(`sentence ${s.key}: empty ${l} mark`);
        continue;
      }
      const start = text.indexOf(sub);
      if (start === -1) problems.push(`sentence ${s.key}: "${sub}" not found in ${l} "${text}"`);
      else if (sub.length >= text.length) problems.push(`sentence ${s.key}: ${l} mark covers the whole sentence`);
      else if (text.indexOf(sub, start + 1) !== -1) {
        // Positions are found by text search, so a mark that occurs twice would light up the wrong place
        // (たい inside 冷たい before 飲みたい). The writer must rephrase or use a longer mark.
        problems.push(`sentence ${s.key}: ${l} mark "${sub}" appears more than once in "${text}"`);
      } else marks.push({ key: s.key, lang: l, pattern_id: patternId, start_index: start, end_index: start + sub.length });
    }
  }
  return { problems, marks };
}

/**
 * Every row of a query, 1000 at a time (the API returns at most 1000 rows per request).
 * @param {(from: number, to: number) => PromiseLike<{data: any[] | null, error: any}>} page
 */
export async function fetchAll(page) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}
