import { motion } from "motion/react";
import { CollapsibleSection } from "~/components/common/collapsible-section";

export function ShareSummary({ summary }: { summary?: string }) {
  if (!summary) {
    return null;
  }
  return (
    <CollapsibleSection className="mt-12" title="Summary">
      <motion.p
        animate={{ opacity: 1, y: 0 }}
        className="mt-2 text-sm text-ui-fg-subtle leading-relaxed"
        initial={{ opacity: 0, y: 4 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      >
        {summary}
      </motion.p>
    </CollapsibleSection>
  );
}
