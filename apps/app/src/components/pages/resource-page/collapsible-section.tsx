import { Heading } from "@strand/ui/heading";
import { ChevronRightIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import {
  useResourceSections,
  useResourceSectionsHydrated,
} from "~/lib/resource-sections-store";

export function CollapsibleSection({
  id,
  title,
  children,
  className,
  secondary,
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
  secondary?: ReactNode;
}) {
  const hydrated = useResourceSectionsHydrated();
  const collapsed = useResourceSections((s) => s.isCollapsed(id));
  const toggle = useResourceSections((s) => s.toggle);

  if (!hydrated) {
    return null;
  }

  return (
    <div className={className}>
      <button
        className="flex items-center gap-1"
        onClick={() => toggle(id)}
        type="button"
      >
        <motion.div
          animate={{ rotate: collapsed ? 0 : 90 }}
          initial={false}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          <ChevronRightIcon className="h-3.5 w-3.5 text-ui-fg-muted" />
        </motion.div>
        <Heading className="text-sm" level="h3">
          {title}
        </Heading>
        {secondary}
      </button>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            style={{ overflow: "hidden" }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
