import { Badge } from "@omi/ui/badge";
import { motion } from "motion/react";
import type { ShareResourceData } from "./types";

export function ShareTags({ tags }: { tags: ShareResourceData["tags"] }) {
  if (tags.length === 0) {
    return null;
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center gap-1.5"
        initial={{ opacity: 0, y: 4 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      >
        {tags.map((tag) => (
          <Badge
            className="group flex items-center gap-x-0.5 text-xs"
            key={tag.name}
            variant="mono"
          >
            <span className="text-ui-fg-muted">#</span>
            {tag.name}
          </Badge>
        ))}
      </motion.div>
    </div>
  );
}
