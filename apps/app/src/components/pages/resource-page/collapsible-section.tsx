import type { ReactNode } from "react";
import { CollapsibleSection as BaseCollapsibleSection } from "~/components/common/collapsible-section";
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
    <BaseCollapsibleSection
      className={className}
      collapsed={collapsed}
      onToggle={() => toggle(id)}
      secondary={secondary}
      title={title}
    >
      {children}
    </BaseCollapsibleSection>
  );
}
