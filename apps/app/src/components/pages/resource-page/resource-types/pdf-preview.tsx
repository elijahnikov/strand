import { FlickeringGrid } from "@strand/ui/flickering-grid";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const PREVIEW_HEIGHT = 420;

export function PdfPreview({ url }: { url: string }) {
  return <PdfPreviewInner key={url} url={url} />;
}

function PdfPreviewInner({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState<number | undefined>();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const update = () => {
      setPageWidth(el.clientWidth);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="relative mt-4 w-full cursor-zoom-in overflow-hidden rounded-xl border border-ui-border-base"
      ref={containerRef}
      style={{ height: PREVIEW_HEIGHT }}
    >
      {!loaded && (
        <FlickeringGrid
          className="absolute inset-0 z-0 size-full"
          color="#6B7280"
          flickerChance={0.1}
          gridGap={6}
          maxOpacity={0.5}
          squareSize={4}
        />
      )}
      <motion.div
        animate={{ opacity: loaded ? 1 : 0 }}
        className="absolute inset-x-0 top-0"
        initial={false}
        transition={{ duration: 0.2 }}
      >
        <Document file={url} onLoadSuccess={() => setLoaded(true)}>
          {pageWidth ? <Page pageNumber={1} width={pageWidth} /> : null}
        </Document>
      </motion.div>
    </div>
  );
}
