import type { createOpenAI } from "@ai-sdk/openai";
import type { CoreMessage } from "ai";
import { ResourceEnricher } from "./base";

export interface FileEnricherInput {
  fileName: string;
  fileUrl: string;
  mimeType: string;
  title: string;
}

function isPdf(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export class FileEnricher extends ResourceEnricher {
  private readonly input: FileEnricherInput;

  constructor(
    provider: ReturnType<typeof createOpenAI>,
    input: FileEnricherInput
  ) {
    super(provider);
    this.input = input;
  }

  protected buildMessages(): CoreMessage[] {
    const basePrompt = `You are an expert document analyst for a personal knowledge management system.

Analyze the following file and extract structured metadata. Be concise and accurate.

File: ${this.input.fileName}
Title: ${this.input.title}`;

    if (isPdf(this.input.mimeType)) {
      return [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${basePrompt}

Carefully read the PDF and extract key information including a summary, tags, entities, and notable quotes.`,
            },
            {
              type: "file",
              data: new URL(this.input.fileUrl),
              filename: this.input.fileName,
              mimeType: "application/pdf",
            },
          ],
        },
      ];
    }

    if (isImage(this.input.mimeType)) {
      return [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${basePrompt}

Describe the image in detail. Extract any visible text (OCR). Identify subjects, objects, scenes, and themes. Note the dominant colors, visual style (photo, illustration, screenshot, diagram, etc.), and overall mood or aesthetic.`,
            },
            {
              type: "image",
              image: new URL(this.input.fileUrl),
            },
          ],
        },
      ];
    }

    return [
      {
        role: "user",
        content: `${basePrompt}
MIME type: ${this.input.mimeType}

Based on the file name and type, provide your best assessment of what this file likely contains. Generate appropriate tags and a brief description.`,
      },
    ];
  }
}
