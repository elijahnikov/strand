import "./promise-try-polyfill";
import { extractText } from "unpdf";

export interface PdfPage {
  pageNumber: number;
  text: string;
}

export interface PdfExtraction {
  fullText: string;
  pageCount: number;
  pages: PdfPage[];
}

const MAX_PAGES = 50;

export async function extractPdfText(
  pdfBuffer: ArrayBuffer
): Promise<PdfExtraction> {
  const { text, totalPages } = await extractText(new Uint8Array(pdfBuffer), {
    mergePages: false,
  });

  const pages: PdfPage[] = text
    .slice(0, MAX_PAGES)
    .map((pageText, i) => ({
      pageNumber: i + 1,
      text: pageText.trim(),
    }))
    .filter((p) => p.text.length > 0);

  const fullText = pages.map((p) => p.text).join("\n\n");

  return {
    fullText,
    pages,
    pageCount: totalPages,
  };
}
