import { cn } from "@omi/ui";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

const headingVariants = cva("font-medium font-sans", {
  variants: {
    level: {
      h1: "h1-core",
      h2: "h2-core",
      h3: "h3-core",
    },
  },
  defaultVariants: {
    level: "h1",
  },
});

interface HeadingProps
  extends VariantProps<typeof headingVariants>,
    React.HTMLAttributes<HTMLHeadingElement>,
    React.ComponentProps<"h1"> {}

const Heading = ({ level = "h1", className, ...props }: HeadingProps) => {
  const Component = level || "h1";

  return (
    <Component
      className={cn(headingVariants({ level }), className)}
      {...props}
    />
  );
};

export { Heading, headingVariants };
