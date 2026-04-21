import { cn } from "@omi/ui";
import { useMemo } from "react";

export function TextShimmer({
  children,
  className,
  duration = 1.5,
  spread = 3,
}: {
  children: string;
  className?: string;
  duration?: number;
  spread?: number;
}) {
  const dynamicSpread = useMemo(
    () => (children?.length ?? 0) * spread,
    [children, spread]
  );

  return (
    <>
      <style>{`
        @keyframes text-shimmer {
          0% { background-position: 100% center; }
          100% { background-position: 0% center; }
        }
      `}</style>
      <span
        className={cn(
          "relative bg-[size:250%_100%,auto] bg-clip-text text-transparent",
          "[--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--fg-base),#0000_calc(50%+var(--spread)))] [background-repeat:no-repeat,padding-box]",
          className
        )}
        style={
          {
            "--spread": `${dynamicSpread}px`,
            backgroundImage:
              "var(--bg), linear-gradient(var(--fg-disabled), var(--fg-disabled))",
            animation: `text-shimmer ${duration}s linear infinite`,
          } as React.CSSProperties
        }
      >
        {children}
      </span>
    </>
  );
}
