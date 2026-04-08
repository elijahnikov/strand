export interface Chunk {
  content: string;
  endOffset: number;
  metadata?: { pageNumber?: number; sectionHeader?: string };
  startOffset: number;
}

export interface ChunkOptions {
  chunkOverlap?: number;
  chunkSize?: number;
  minChunkSize?: number;
}

const DEFAULT_CHUNK_SIZE = 1500;
const DEFAULT_CHUNK_OVERLAP = 200;
const DEFAULT_MIN_CHUNK_SIZE = 100;

const SENTENCE_TERMINATORS = /(?<=[.!?])\s+|\n/;

function splitIntoSentences(text: string): string[] {
  return text.split(SENTENCE_TERMINATORS).filter((s) => s.length > 0);
}

function splitLargeParagraph(paragraph: string, chunkSize: number): string[] {
  const sentences = splitIntoSentences(paragraph);
  const pieces: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current.length + sentence.length > chunkSize && current.length > 0) {
      pieces.push(current.trim());
      current = "";
    }
    current += (current.length > 0 ? " " : "") + sentence;
  }

  if (current.trim().length > 0) {
    pieces.push(current.trim());
  }

  return pieces;
}

export function chunkText(text: string, options?: ChunkOptions): Chunk[] {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const chunkOverlap = options?.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;
  const minChunkSize = options?.minChunkSize ?? DEFAULT_MIN_CHUNK_SIZE;

  const paragraphs = text.split(/\n\n+/);
  const chunks: Chunk[] = [];
  let currentContent = "";
  let currentStart = 0;
  let textOffset = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i] as string;
    const paragraphStart = text.indexOf(paragraph, textOffset);
    textOffset = paragraphStart + paragraph.length;

    if (paragraph.length > chunkSize) {
      // Flush current chunk if any
      if (currentContent.length > 0) {
        chunks.push({
          content: currentContent.trim(),
          startOffset: currentStart,
          endOffset: currentStart + currentContent.length,
        });
        currentContent = "";
      }

      // Split large paragraph into sentence-bounded pieces
      const pieces = splitLargeParagraph(paragraph, chunkSize);
      let pieceOffset = paragraphStart;
      for (const piece of pieces) {
        const pieceStart = text.indexOf(piece, pieceOffset);
        chunks.push({
          content: piece,
          startOffset: pieceStart,
          endOffset: pieceStart + piece.length,
        });
        pieceOffset = pieceStart + piece.length;
      }

      currentStart = textOffset;
      continue;
    }

    const wouldExceed =
      currentContent.length + paragraph.length + 2 > chunkSize;

    if (wouldExceed && currentContent.length > 0) {
      chunks.push({
        content: currentContent.trim(),
        startOffset: currentStart,
        endOffset: currentStart + currentContent.length,
      });

      // Start next chunk with overlap
      const overlapStart = Math.max(0, currentContent.length - chunkOverlap);
      const overlapText = currentContent.slice(overlapStart);
      currentContent = overlapText + "\n\n" + paragraph;
      currentStart = currentStart + overlapStart;
    } else if (currentContent.length === 0) {
      currentStart = paragraphStart;
      currentContent = paragraph;
    } else {
      currentContent += "\n\n" + paragraph;
    }
  }

  // Flush remaining content
  if (currentContent.trim().length >= minChunkSize) {
    chunks.push({
      content: currentContent.trim(),
      startOffset: currentStart,
      endOffset: currentStart + currentContent.length,
    });
  }

  return chunks;
}

export interface PdfPage {
  pageNumber: number;
  text: string;
}

export function chunkPdfPages(
  pages: PdfPage[],
  options?: ChunkOptions
): Chunk[] {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const chunkOverlap = options?.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;
  const minChunkSize = options?.minChunkSize ?? DEFAULT_MIN_CHUNK_SIZE;

  const chunks: Chunk[] = [];
  let currentContent = "";
  let currentStart = 0;
  let currentPageNumber = 1;
  let globalOffset = 0;

  for (const page of pages) {
    const paragraphs = page.text.split(/\n\n+/);

    for (const paragraph of paragraphs) {
      if (paragraph.trim().length === 0) {
        globalOffset += paragraph.length + 2;
        continue;
      }

      const wouldExceed =
        currentContent.length + paragraph.length + 2 > chunkSize;

      if (wouldExceed && currentContent.length > 0) {
        chunks.push({
          content: currentContent.trim(),
          startOffset: currentStart,
          endOffset: currentStart + currentContent.length,
          metadata: { pageNumber: currentPageNumber },
        });

        const overlapStart = Math.max(0, currentContent.length - chunkOverlap);
        const overlapText = currentContent.slice(overlapStart);
        currentContent = overlapText + "\n\n" + paragraph;
        currentStart = currentStart + overlapStart;
        currentPageNumber = page.pageNumber;
      } else if (currentContent.length === 0) {
        currentStart = globalOffset;
        currentPageNumber = page.pageNumber;
        currentContent = paragraph;
      } else {
        currentContent += "\n\n" + paragraph;
      }

      globalOffset += paragraph.length + 2;
    }
  }

  if (currentContent.trim().length >= minChunkSize) {
    chunks.push({
      content: currentContent.trim(),
      startOffset: currentStart,
      endOffset: currentStart + currentContent.length,
      metadata: { pageNumber: currentPageNumber },
    });
  }

  return chunks;
}
