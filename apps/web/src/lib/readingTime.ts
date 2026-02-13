const LIKELY_HTML_PATTERN = /<[a-z][\s\S]*>/i;
const DEFAULT_WORDS_PER_MINUTE = 220;

/**
 * Estimate reading time from newsletter content.
 * Returns null when there is no readable text.
 */
export function estimateReadMinutesFromContent(
  rawContent: string,
  wordsPerMinute = DEFAULT_WORDS_PER_MINUTE,
): number | null {
  const trimmed = rawContent.trim();
  if (!trimmed) {
    return null;
  }

  let extractedText = rawContent;
  if (LIKELY_HTML_PATTERN.test(trimmed)) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawContent, "text/html");
    doc.querySelectorAll("script, style, noscript").forEach((node) => {
      node.remove();
    });
    extractedText = doc.body?.textContent ?? doc.documentElement.textContent ?? "";
  }

  const normalized = extractedText.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (wordCount === 0) {
    return null;
  }

  const effectiveWordsPerMinute =
    Number.isFinite(wordsPerMinute) && wordsPerMinute > 0
      ? wordsPerMinute
      : DEFAULT_WORDS_PER_MINUTE;

  const rawMinutes = wordCount / effectiveWordsPerMinute;
  if (rawMinutes < 1) {
    return 0;
  }

  return Math.ceil(rawMinutes);
}
