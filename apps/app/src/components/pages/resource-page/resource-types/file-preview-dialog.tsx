import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@strand/ui";
import { buttonVariants } from "@strand/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogPortal,
  DialogTrigger,
} from "@strand/ui/dialog";
import { DownloadIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { downloadFile } from "~/lib/download";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export function ImagePreviewDialog({
  src,
  alt,
  fileName,
  children,
}: {
  src: string;
  alt: string;
  fileName?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger className="cursor-zoom-in outline-none" render={<div />}>
        {children}
      </DialogTrigger>
      <DialogPortal>
        <DialogBackdrop className="bg-white/50 backdrop-blur-sm dark:bg-black/50" />
        <DialogPrimitive.Popup className="fixed inset-0 z-50 flex items-center justify-center p-8 outline-none data-ending-style:opacity-0 data-starting-style:opacity-0">
          <DialogPrimitive.Close className="absolute inset-0" />
          <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-t from-blue-500 to-blue-400 text-white outline-none transition-colors hover:from-blue-600 hover:to-blue-500"
              onClick={() => downloadFile(src, fileName)}
              type="button"
            >
              <DownloadIcon className="h-4 w-4" />
            </button>
            <DialogPrimitive.Close
              className={cn(
                "min-size-8! flex size-8! items-center justify-center rounded-full! outline-none",
                buttonVariants({ variant: "outline" })
              )}
            >
              <XIcon className="h-4 w-4 shrink-0" />
            </DialogPrimitive.Close>
          </div>
          <img
            alt={alt}
            className="relative z-10 max-h-full max-w-full rounded-lg object-contain"
            height="auto"
            src={src}
            width="auto"
          />
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}

export function PdfPreviewDialog({
  url,
  fileName,
  children,
}: {
  url: string;
  fileName?: string;
  children: React.ReactNode;
}) {
  const [numPages, setNumPages] = useState<number>(0);

  return (
    <Dialog>
      <DialogTrigger className="cursor-zoom-in outline-none" render={<div />}>
        {children}
      </DialogTrigger>
      <DialogPortal>
        <DialogBackdrop className="bg-black/80 backdrop-blur-sm dark:bg-black/80" />
        <DialogPrimitive.Popup className="fixed inset-0 z-50 flex flex-col outline-none data-ending-style:opacity-0 data-starting-style:opacity-0">
          <DialogPrimitive.Close className="absolute inset-0" />
          <div className="relative z-10 flex items-center justify-end gap-2 p-4">
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-t from-blue-500 to-blue-400 text-white outline-none transition-colors hover:from-blue-600 hover:to-blue-500"
              onClick={() => downloadFile(url, fileName)}
              type="button"
            >
              <DownloadIcon className="h-4 w-4" />
            </button>
            <DialogPrimitive.Close className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white outline-none transition-colors hover:bg-white/20">
              <XIcon className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="relative z-10 flex-1 overflow-y-auto">
            <Document
              file={url}
              onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            >
              <div className="flex flex-col items-center gap-2 pb-8">
                {Array.from({ length: numPages }, (_, i) => (
                  <div
                    className="flex flex-col items-center"
                    key={`page-${i + 1}`}
                  >
                    <Page
                      pageNumber={i + 1}
                      width={Math.min(680, window.innerWidth - 64)}
                    />
                    <span className="mt-1 mb-3 font-mono text-white/50 text-xs">
                      {i + 1} / {numPages}
                    </span>
                  </div>
                ))}
              </div>
            </Document>
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
