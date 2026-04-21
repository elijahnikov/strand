import { describe, expect, it } from "vitest";
import { chunkPdfPages, chunkText } from "./chunking";

describe("chunkText", () => {
  it("returns empty array for empty input", () => {
    expect(chunkText("")).toEqual([]);
  });

  it("returns a single chunk for text under chunkSize", () => {
    const text = "This is a short note about something.";
    // Default minChunkSize is 100 and would drop this text in the final flush.
    // Real chunking callers use long content; drop the floor for this case.
    const chunks = chunkText(text, { minChunkSize: 1 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe(text);
    expect(chunks[0]?.startOffset).toBe(0);
    expect(chunks[0]?.endOffset).toBe(text.length);
  });

  it("splits at paragraph boundaries when total exceeds chunkSize", () => {
    const p1 = "A".repeat(120);
    const p2 = "B".repeat(120);
    const p3 = "C".repeat(120);
    const text = [p1, p2, p3].join("\n\n");

    const chunks = chunkText(text, {
      chunkSize: 150,
      chunkOverlap: 20,
      minChunkSize: 10,
    });

    expect(chunks.length).toBeGreaterThan(1);
    // First chunk should contain p1
    expect(chunks[0]?.content).toContain("A");
    // Some chunk must contain each paragraph's distinctive char
    const joined = chunks.map((c) => c.content).join("\n");
    expect(joined).toContain("A");
    expect(joined).toContain("B");
    expect(joined).toContain("C");
  });

  it("applies overlap between consecutive chunks", () => {
    const p1 = "X".repeat(200);
    const p2 = "Y".repeat(200);
    const text = `${p1}\n\n${p2}`;

    const chunks = chunkText(text, {
      chunkSize: 220,
      chunkOverlap: 50,
      minChunkSize: 10,
    });

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // The overlap means the second chunk's start offset should be less than the
    // first chunk's end offset, and there should be shared tail content.
    const first = chunks[0];
    const second = chunks[1];
    if (first && second) {
      expect(second.startOffset).toBeLessThan(first.endOffset);
    }
  });

  it("splits a single paragraph larger than chunkSize into sentence pieces", () => {
    const sentences = [
      "First sentence here.",
      "Second one follows.",
      "Third keeps going.",
      "Fourth finishes it.",
    ];
    const paragraph = sentences.join(" ");

    const chunks = chunkText(paragraph, {
      chunkSize: 30,
      chunkOverlap: 0,
      minChunkSize: 1,
    });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeGreaterThan(0);
    }
  });

  it("flushes remaining content at end of text", () => {
    const text = "One paragraph.\n\nTwo paragraph.";
    const chunks = chunkText(text, { minChunkSize: 1 });
    const joined = chunks.map((c) => c.content).join(" ");
    expect(joined).toContain("One paragraph");
    expect(joined).toContain("Two paragraph");
  });
});

describe("chunkPdfPages", () => {
  it("returns no chunks for empty pages", () => {
    expect(chunkPdfPages([])).toEqual([]);
  });

  it("preserves page number in metadata", () => {
    const pages = [
      { pageNumber: 1, text: "A".repeat(150) },
      { pageNumber: 2, text: "B".repeat(150) },
    ];
    const chunks = chunkPdfPages(pages, {
      chunkSize: 200,
      chunkOverlap: 20,
      minChunkSize: 10,
    });

    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.metadata?.pageNumber).toBeGreaterThanOrEqual(1);
      expect(chunk.metadata?.pageNumber).toBeLessThanOrEqual(2);
    }
  });

  it("produces at least one chunk spanning multi-page content", () => {
    const pages = [
      { pageNumber: 1, text: "Alpha content on page one." },
      { pageNumber: 2, text: "Beta content on page two." },
    ];
    const chunks = chunkPdfPages(pages, {
      chunkSize: 1500,
      chunkOverlap: 200,
      minChunkSize: 10,
    });

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    const joined = chunks.map((c) => c.content).join(" ");
    expect(joined).toContain("Alpha");
    expect(joined).toContain("Beta");
  });
});
