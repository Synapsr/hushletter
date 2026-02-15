"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import type * as React from "react";

import { cn } from "@hushletter/ui/lib/utils";

const landingButtonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center font-medium outline-none transition-colors disabled:pointer-events-none disabled:opacity-60",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        sm: "gap-1 rounded-lg px-4 py-1.5 text-sm",
        default: "gap-2 rounded-full px-6 py-3 text-sm",
        lg: "gap-2 rounded-full px-8 py-4 text-lg font-semibold",
        full: "w-full gap-2 rounded-xl px-4 py-3 text-sm font-semibold",
      },
      variant: {
        default: "bg-gray-900 text-white hover:bg-gray-800",
        secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
        outline:
          "border border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
        inverted: "bg-white text-gray-900 hover:bg-gray-100",
        ghost: "text-gray-500 hover:text-gray-900",
        filled:
          "bg-foreground text-background hover:bg-foreground/80",
      },
    },
  },
);

type LandingButtonVariants = VariantProps<typeof landingButtonVariants>;

interface LandingButtonProps
  extends useRender.ComponentProps<"button">,
    LandingButtonVariants {}

function LandingButton({
  className,
  variant,
  size,
  render,
  ...props
}: LandingButtonProps) {
  const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>["type"] =
    render ? undefined : "button";

  const defaultProps = {
    className: cn(landingButtonVariants({ className, size, variant })),
    type: typeValue,
  };

  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(defaultProps, props),
    render,
  });
}

export { LandingButton, landingButtonVariants, type LandingButtonProps };
