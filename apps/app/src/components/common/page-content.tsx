import { cn } from "@strand/ui";

interface PageContentProps extends React.ComponentProps<"div"> {
  /** Desktop width class — applied at xl breakpoint. Default: "xl:w-[55%]" */
  width?: string;
}

/**
 * Centered, responsive content wrapper for page layouts.
 * Full-width on mobile, scales up through breakpoints.
 */
export function PageContent({
  width = "xl:w-[55%]",
  className,
  children,
  ...props
}: PageContentProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1000px] px-4 pt-8 md:w-[75%] md:px-0 md:pt-0 lg:w-[60%]",
        width,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
