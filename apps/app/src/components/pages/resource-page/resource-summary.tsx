import { Skeleton } from "@strand/ui/skeleton";
import { AnimatePresence, motion } from "motion/react";
import type { GetResourceData } from "~/lib/convex-types";
import { CollapsibleSection } from "./collapsible-section";

export function ResourceSummary({ resource }: { resource: GetResourceData }) {
  const status = resource.resourceAI?.status;
  const summary = resource.resourceAI?.summary;
  const isProcessing = status === "pending" || status === "processing";

  if (!(isProcessing || summary)) {
    return null;
  }

  return (
    <CollapsibleSection className="mt-12" id="summary" title="Summary">
      <AnimatePresence mode="wait">
        {isProcessing ? (
          <motion.div
            className="mt-2 flex flex-col gap-2"
            exit={{ opacity: 0 }}
            key="skeleton"
            transition={{ duration: 0.15 }}
          >
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </motion.div>
        ) : (
          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-sm text-ui-fg-subtle leading-relaxed"
            initial={{ opacity: 0, y: 4 }}
            key="summary"
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            {summary}
          </motion.p>
        )}
      </AnimatePresence>
    </CollapsibleSection>
  );
}
