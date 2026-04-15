import { Kbd, KbdGroup } from "@strand/ui/kbd";

export function ShortcutTooltipBody({
  title,
  shortcut,
}: {
  title: string;
  shortcut?: string[];
}) {
  if (!shortcut?.length) {
    return <span>{title}</span>;
  }
  return (
    <span className="flex items-center gap-x-2">
      <span>{title}</span>
      <KbdGroup>
        {shortcut.map((key, idx) => (
          <span
            className="flex items-center gap-1"
            key={`${key}-${idx.toString()}`}
          >
            {idx > 0 ? (
              <span className="text-[11px] text-ui-fg-subtle">then</span>
            ) : null}
            <Kbd className="h-4! min-w-4 border-[0.5px] font-mono text-[10px] text-ui-fg-base">
              {key}
            </Kbd>
          </span>
        ))}
      </KbdGroup>
    </span>
  );
}
