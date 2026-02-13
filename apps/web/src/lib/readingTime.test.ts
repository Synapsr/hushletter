import { describe, expect, it } from "vitest";
import { estimateReadMinutesFromContent } from "./readingTime";

function createWords(count: number): string {
  return Array.from({ length: count }, (_, index) => `word${index + 1}`).join(" ");
}

describe("estimateReadMinutesFromContent", () => {
  it("returns 0 for short content that takes under one minute", () => {
    expect(estimateReadMinutesFromContent("Quick newsletter update")).toBe(0);
  });

  it("strips script/style/noscript tags from html before counting words", () => {
    const html = `
      <html>
        <head>
          <style>.hidden { display: none; }</style>
        </head>
        <body>
          <p>Main article text here.</p>
          <script>console.log("ignore me")</script>
          <noscript>Ignore fallback text</noscript>
        </body>
      </html>
    `;

    expect(estimateReadMinutesFromContent(html)).toBe(0);
  });

  it("returns null for empty or whitespace-only content", () => {
    expect(estimateReadMinutesFromContent("   \n\t   ")).toBeNull();
  });

  it("rounds up word counts above 220 words", () => {
    const words = createWords(221);
    expect(estimateReadMinutesFromContent(words)).toBe(2);
  });

  it("returns 1 at exactly 220 words", () => {
    const words = createWords(220);
    expect(estimateReadMinutesFromContent(words)).toBe(1);
  });
});
