/**
 * Custom shadcn-compatible components for BlockNote.
 *
 * These use Radix UI primitives (required for BlockNote API compatibility)
 * styled with Strand design tokens. No portals — BlockNote manages its own
 * positioning layer.
 */

import type { ShadCNComponents } from "@blocknote/shadcn";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Slot } from "@radix-ui/react-slot";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@strand/ui";
import { cva, type VariantProps } from "class-variance-authority";
import { CheckIcon, ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import type * as React from "react";

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium text-sm outline-none transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg:not([class*=size-])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-ui-button-inverted text-ui-fg-base shadow-buttons-neutral hover:bg-ui-button-inverted-hover active:bg-ui-button-inverted-pressed",
        destructive:
          "bg-ui-button-danger text-ui-fg-on-color shadow-buttons-danger hover:bg-ui-button-danger-hover",
        outline:
          "bg-ui-button-neutral text-ui-fg-base shadow-buttons-neutral hover:bg-ui-button-neutral-hover",
        secondary:
          "bg-[rgba(0,0,0,0.05)] text-ui-fg-base hover:bg-[rgba(0,0,0,0.1)] dark:bg-[rgba(255,255,255,0.05)] dark:hover:bg-[rgba(255,255,255,0.1)]",
        ghost:
          "text-ui-fg-base hover:bg-ui-button-transparent-hover active:bg-ui-button-transparent-pressed",
        link: "text-ui-fg-interactive underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3 py-1.5",
        sm: "h-7 gap-1.5 rounded-lg px-2",
        lg: "h-10 rounded-lg px-4",
        icon: "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      data-slot="button"
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// DropdownMenu
// ---------------------------------------------------------------------------

function DropdownMenu(
  props: React.ComponentProps<typeof DropdownMenuPrimitive.Root>
) {
  return <DropdownMenuPrimitive.Root {...props} />;
}

function DropdownMenuTrigger(
  props: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>
) {
  return <DropdownMenuPrimitive.Trigger {...props} />;
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        className={cn(
          "z-50 min-w-52 origin-(--radix-dropdown-menu-content-transform-origin) overflow-y-auto overflow-x-hidden rounded-lg border bg-ui-bg-base p-1",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=open]:animate-in",
          className
        )}
        sideOffset={sideOffset}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        "txt-compact-small relative flex cursor-pointer select-none items-center gap-2 rounded-xl px-2 py-1.5 font-medium text-ui-fg-subtle outline-none transition-colors",
        "focus:bg-ui-bg-component-hover focus:text-ui-fg-base",
        "data-[disabled]:pointer-events-none data-[disabled]:text-ui-fg-disabled",
        "data-[variant=destructive]:text-ui-fg-error data-[variant=destructive]:focus:bg-ui-bg-component-hover",
        "[&_svg]:mr-2 [&_svg]:size-4 [&_svg]:text-ui-fg-subtle focus:[&_svg]:text-ui-fg-base",
        "data-[inset]:pl-8",
        className
      )}
      data-inset={inset}
      data-variant={variant}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      checked={checked}
      className={cn(
        "txt-compact-small relative flex cursor-pointer select-none items-center gap-2 rounded-xl py-1.5 pr-2 pl-8 font-medium text-ui-fg-subtle outline-none transition-colors",
        "focus:bg-ui-bg-component-hover focus:text-ui-fg-base",
        "data-[disabled]:pointer-events-none data-[disabled]:text-ui-fg-disabled",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn(
        "px-2 py-1.5 font-medium text-ui-fg-muted text-xs data-[inset]:pl-8",
        className
      )}
      data-inset={inset}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-ui-fg-muted/10", className)}
      {...props}
    />
  );
}

function DropdownMenuSub(
  props: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>
) {
  return <DropdownMenuPrimitive.Sub {...props} />;
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      className={cn(
        "txt-compact-small flex cursor-pointer select-none items-center rounded-xl px-2 py-1.5 font-medium text-ui-fg-subtle outline-none transition-colors",
        "focus:bg-ui-bg-component-hover focus:text-ui-fg-base",
        "data-[state=open]:bg-ui-bg-component-hover data-[state=open]:text-ui-fg-base",
        "data-[inset]:pl-8",
        className
      )}
      data-inset={inset}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4 opacity-80" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.SubContent
        className={cn(
          "z-50 min-w-52 origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-lg border bg-ui-bg-base p-1",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=open]:animate-in",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

// ---------------------------------------------------------------------------
// Popover
// ---------------------------------------------------------------------------

function StrandPopover(
  props: React.ComponentProps<typeof PopoverPrimitive.Root>
) {
  return <PopoverPrimitive.Root {...props} />;
}

function StrandPopoverTrigger(
  props: React.ComponentProps<typeof PopoverPrimitive.Trigger>
) {
  return <PopoverPrimitive.Trigger {...props} />;
}

function StrandPopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        className={cn(
          "z-50 w-72 overflow-hidden rounded-lg border bg-ui-bg-base p-1 text-ui-fg-base outline-none",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=open]:animate-in",
          className
        )}
        sideOffset={sideOffset}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

// ---------------------------------------------------------------------------
// Select
// ---------------------------------------------------------------------------

function StrandSelect(
  props: React.ComponentProps<typeof SelectPrimitive.Root>
) {
  return <SelectPrimitive.Root {...props} />;
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default";
}) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "flex w-fit items-center justify-between gap-2 whitespace-nowrap rounded-lg border bg-ui-bg-field-component px-2 py-1.5 text-sm text-ui-fg-base shadow-borders-base outline-none transition-all",
        "placeholder:text-ui-fg-muted hover:bg-ui-bg-field-component-hover",
        "focus-visible:shadow-borders-interactive-with-active",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[size=default]:h-8 data-[size=sm]:h-7",
        "[&_svg:not([class*=size-])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      data-size={size}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Content
      className={cn(
        "relative z-50 min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-2xl border bg-ui-bg-component p-1 shadow-elevation-flyout",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=open]:animate-in",
        position === "popper" &&
          "data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  );
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "txt-compact-small relative flex w-full cursor-pointer select-none items-center gap-2 rounded-xl py-1.5 pr-8 pl-2 font-medium text-ui-fg-subtle outline-none transition-colors",
        "focus:bg-ui-bg-component-hover focus:text-ui-fg-base",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectValue(
  props: React.ComponentProps<typeof SelectPrimitive.Value>
) {
  return <SelectPrimitive.Value {...props} />;
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

function StrandTooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />;
}

function StrandTooltip(
  props: React.ComponentProps<typeof TooltipPrimitive.Root>
) {
  return (
    <StrandTooltipProvider>
      <TooltipPrimitive.Root {...props} />
    </StrandTooltipProvider>
  );
}

function StrandTooltipTrigger(
  props: React.ComponentProps<typeof TooltipPrimitive.Trigger>
) {
  return <TooltipPrimitive.Trigger {...props} />;
}

function StrandTooltipContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Content
      className={cn(
        "z-50 w-fit rounded-xl border bg-ui-bg-component px-2 py-1 text-ui-fg-base text-xs shadow-elevation-flyout",
        "fade-in-0 zoom-in-95 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 animate-in data-[state=closed]:animate-out",
        className
      )}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Toggle
// ---------------------------------------------------------------------------

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium text-sm outline-none transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg:not([class*=size-])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "text-ui-fg-subtle hover:bg-ui-bg-subtle-hover hover:text-ui-fg-base data-[state=on]:bg-ui-bg-component-hover data-[state=on]:text-ui-fg-base",
        outline:
          "border shadow-borders-base hover:bg-ui-bg-subtle-hover hover:text-ui-fg-base data-[state=on]:bg-ui-bg-component-hover data-[state=on]:text-ui-fg-base",
      },
      size: {
        default: "h-8 min-w-8 px-2",
        sm: "h-7 min-w-7 px-1.5",
        lg: "h-10 min-w-10 px-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function StrandTabs(props: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root {...props} />;
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex items-center justify-center gap-0.5 rounded-lg p-0.5 text-ui-fg-muted",
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 font-medium text-sm outline-none transition-all",
        "hover:text-ui-fg-base",
        "focus-visible:shadow-borders-focus",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:bg-ui-bg-base data-[state=active]:text-ui-fg-base data-[state=active]:shadow-sm",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function StrandInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "txt-compact-medium h-8 w-full appearance-none rounded-lg bg-ui-bg-field-component px-2 py-1.5 text-ui-fg-base placeholder-ui-fg-muted caret-ui-fg-base shadow-borders-base outline-none transition-all",
        "hover:bg-ui-bg-field-component-hover",
        "focus-visible:shadow-borders-interactive-with-active",
        "disabled:cursor-not-allowed disabled:bg-ui-bg-disabled disabled:text-ui-fg-disabled",
        className
      )}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Label
// ---------------------------------------------------------------------------

function StrandLabel({ className, ...props }: React.ComponentProps<"label">) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: htmlFor is passed via props by BlockNote
    <label
      className={cn(
        "inline-flex items-center gap-2 font-medium text-sm text-ui-fg-base",
        className
      )}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-sm border border-transparent px-1 font-medium text-xs",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive text-white",
        outline: "border-input bg-background text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function StrandBadge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  return (
    <span className={cn(badgeVariants({ variant, className }))} {...props} />
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function StrandCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("w-full rounded-md bg-ui-bg-field px-4 py-3", className)}
      {...props}
    />
  );
}

function StrandCardContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("px-6", className)} {...props} />;
}

// ---------------------------------------------------------------------------
// Form (minimal — BlockNote barely uses it)
// ---------------------------------------------------------------------------

function StrandForm(props: React.ComponentProps<"form">) {
  return <form {...props} />;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function StrandSkeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-ui-bg-subtle", className)}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Export as shadCNComponents object
// ---------------------------------------------------------------------------

export const strandShadCNComponents = {
  Badge: { Badge: StrandBadge },
  Button: { Button },
  Card: { Card: StrandCard, CardContent: StrandCardContent },
  DropdownMenu: {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
  },
  Form: { Form: StrandForm },
  Input: { Input: StrandInput },
  Label: { Label: StrandLabel },
  Popover: {
    Popover: StrandPopover,
    PopoverContent: StrandPopoverContent,
    PopoverTrigger: StrandPopoverTrigger,
  },
  Select: {
    Select: StrandSelect,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  },
  Skeleton: { Skeleton: StrandSkeleton },
  Tabs: {
    Tabs: StrandTabs,
    TabsContent,
    TabsList,
    TabsTrigger,
  },
  Toggle: { Toggle },
  Tooltip: {
    Tooltip: StrandTooltip,
    TooltipContent: StrandTooltipContent,
    TooltipProvider: StrandTooltipProvider,
    TooltipTrigger: StrandTooltipTrigger,
  },
} satisfies Partial<ShadCNComponents>;
