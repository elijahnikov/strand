import { FlickeringGrid } from "@strand/ui/flickering-grid";
import { motion } from "motion/react";
import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export function PdfPreview({ url }: { url: string }) {
  return <PdfPreviewInner key={url} url={url} />;
}

function PdfPreviewInner({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative mt-4">
      {!loaded && (
        <div
          className="relative w-full overflow-hidden rounded-xl border border-ui-border-base"
          style={{ aspectRatio: "8.5 / 11" }}
        >
          <FlickeringGrid
            className="absolute inset-0 z-0 size-full"
            color="#6B7280"
            flickerChance={0.1}
            gridGap={6}
            height={1200}
            maxOpacity={0.5}
            squareSize={4}
            width={800}
          />
        </div>
      )}
      <motion.div
        animate={{ opacity: loaded ? 1 : 0 }}
        className={
          loaded
            ? "overflow-hidden rounded-xl border border-ui-border-base"
            : "absolute top-0 left-0 h-0 overflow-hidden"
        }
        initial={false}
        transition={{ duration: 0.2 }}
      >
        <Document file={url} onLoadSuccess={() => setLoaded(true)}>
          <Page pageNumber={1} width={700} />
        </Document>
      </motion.div>
    </div>
  );
}
