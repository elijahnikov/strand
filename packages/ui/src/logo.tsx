import { cn } from "@omi/ui";
import { Card } from "@omi/ui/card";

interface LogoProps {
  size?: "xsmall" | "small" | "base" | "large";
}

export function Logo({ size = "base" }: LogoProps) {
  return (
    <Card
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden",
        {
          "h-7.5 w-7.5 rounded-lg p-1": size === "xsmall",
          "h-12 w-12 rounded-[14px] p-1.5": size === "small",
          "h-16 w-16 rounded-2xl p-2": size === "base",
          "h-20 w-20 rounded-[18px] p-2.5": size === "large",
        }
      )}
    >
      <div className="flex gap-x-0">
        <div className="flex flex-col items-center gap-0.5">
          <div className="h-0.75 w-0.75 bg-white" />
          <div className="h-1.75 w-1.75 bg-white" />
          <div className="h-1.75 w-1.75 bg-white opacity-0" />
          <div className="h-1.25 w-1.25 bg-white" />
          <div className="h-0.75 w-0.75 bg-white" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="h-0.75 w-0.75 bg-white" />
          <div className="h-1.25 w-1.25 bg-white" />
          <div className="h-1.75 w-1.75 bg-white" />
          <div className="h-1.25 w-1.25 bg-white" />
          <div className="h-0.75 w-0.75 bg-white" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="h-0.75 w-0.75 bg-white" />
          <div className="h-1.25 w-1.25 bg-white" />
          <div className="h-1.75 w-1.75 bg-white" />
          <div className="h-1.25 w-1.25 bg-white" />
          <div className="h-0.75 w-0.75 bg-white" />
        </div>
      </div>
    </Card>
  );
}
