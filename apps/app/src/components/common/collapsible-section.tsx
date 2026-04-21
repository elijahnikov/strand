import { Heading } from "@omi/ui/heading";
import { ChevronRightIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useState } from "react";

export function CollapsibleSection({
  title,
  children,
  className,
  secondary,
  defaultCollapsed = false,
  collapsed: controlledCollapsed,
  onToggle,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  secondary?: ReactNode;
  defaultCollapsed?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const isControlled = controlledCollapsed !== undefined;
  const collapsed = isControlled ? controlledCollapsed : internalCollapsed;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    }
    if (!isControlled) {
      setInternalCollapsed((prev) => !prev);
    }
  };

  return (
    <div className={className}>
      <button
        className="flex items-center gap-1"
        onClick={handleToggle}
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
