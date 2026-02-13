/* "use client";

import { Input as InputPrimitive } from "@base-ui/react/input";
import type * as React from "react";
import { tv } from "tailwind-variants";

import { cn } from "../lib/utils";

const inputVariants = tv({
  slots: {
    wrapper: [
      // Layout and border
      "relative inline-flex w-full rounded-lg border border-input",
      // Color and background
      "bg-background text-base text-foreground not-dark:bg-clip-padding",
      // Shadow and ring
      "shadow-xs/5 ring-ring/24 transition-shadow",
      // Before pseudo-element
      "before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)]",
      // Focus/invalid handling and autofill
      "not-has-disabled:not-has-focus-visible:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)]",
      "has-focus-visible:has-aria-invalid:border-destructive/64 has-focus-visible:has-aria-invalid:ring-destructive/16",
      "has-focus-visible:border-ring has-aria-invalid:border-destructive/36",
      "has-autofill:bg-foreground/4 has-disabled:opacity-64",
      "has-[:disabled,:focus-visible,[aria-invalid]]:shadow-none",
      "has-focus-visible:ring-[3px]",
      // Typography and responsive
      "sm:text-sm",
      // Dark mode
      "dark:bg-input/32 dark:has-autofill:bg-foreground/8 dark:has-aria-invalid:ring-destructive/24",
      "dark:not-has-disabled:not-has-focus-visible:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)]",
    ],
    inputField: [
      "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
      " w-full min-w-0 rounded-[inherit] px-[calc(--spacing(3)-1px)]  outline-none [transition:background-color_5000000s_ease-in-out_0s]",
    ],
    inputWrapper: "flex w-full items-center",
    prefix: "pl-1.5 text-sm font-medium text-muted-foreground",
    suffix: "pr-1.5 text-sm font-medium text-muted-foreground",
  },
  variants: {
    size: {
      sm: {
        inputField: "h-7.5 px-[calc(--spacing(2.5)-1px)] leading-7.5 ",
      },
      default: {
        inputField: ["h-10 leading-10"],
      },
      lg: {
        inputField: "h-12 leading-10",
      },
    },
  },
  defaultVariants: {
    size: "default",
  },
});

type InputClassNames = {
  [K in keyof ReturnType<typeof inputVariants>]?: string;
};

type InputProps = Omit<
  InputPrimitive.Props & React.RefAttributes<HTMLInputElement>,
  "size"
> & {
  size?: "sm" | "default" | "lg" | number;
  unstyled?: boolean;
  nativeInput?: boolean;
  prefix?: React.ReactNode | React.ReactElement;
  suffix?: React.ReactNode | React.ReactElement;
  classNames?: InputClassNames;
};

function Input({
  className,
  classNames,
  size = "default",
  unstyled = false,
  nativeInput = false,
  prefix,
  suffix,
  ...props
}: InputProps) {
  const slots = inputVariants({
    size: typeof size === "number" ? "default" : size,
  });

  const typeClasses = cn(
    props.type === "search" &&
      "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none",
    props.type === "file" &&
      "text-muted-foreground file:me-3 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
  );

  const InputComponent = nativeInput ? "input" : InputPrimitive;

  return (
    <span
      className={
        unstyled
          ? undefined
          : slots.wrapper({ class: cn(className, classNames?.wrapper) })
      }
      data-size={size}
      data-slot="input-control"
    >
      <div className={slots.inputWrapper({ class: classNames?.inputWrapper })}>
        {prefix && (
          <span className={slots.prefix({ class: classNames?.prefix })}>
            {prefix}
          </span>
        )}
        <InputComponent
          className={slots.inputField({
            class: cn(typeClasses, classNames?.inputField),
          })}
          data-slot="input"
          size={typeof size === "number" ? size : undefined}
          {...props}
        />
        {suffix && (
          <span className={slots.suffix({ class: classNames?.suffix })}>
            {suffix}
          </span>
        )}
      </div>
    </span>
  );
}

export { Input, inputVariants, type InputProps, type InputClassNames };
 */

"use client";

import { Input as InputPrimitive } from "@base-ui/react/input";
import type * as React from "react";

import { cn } from "@hushletter/ui/lib/utils";

type InputProps = Omit<
  InputPrimitive.Props & React.RefAttributes<HTMLInputElement>,
  "size"
> & {
  size?: "sm" | "default" | "lg" | number;
  unstyled?: boolean;
  nativeInput?: boolean;
};

function Input({
  className,
  size = "default",
  unstyled = false,
  nativeInput = false,
  ...props
}: InputProps) {
  const inputClassName = cn(
    "h-8.5 w-full min-w-0 rounded-[inherit] px-[calc(--spacing(3)-1px)] leading-8.5 outline-none placeholder:text-muted-foreground/72 sm:h-7.5 sm:leading-7.5 [transition:background-color_5000000s_ease-in-out_0s]",
    size === "sm" &&
      "h-7.5 px-[calc(--spacing(2.5)-1px)] leading-7.5 sm:h-6.5 sm:leading-6.5",
    size === "lg" && "h-9.5 leading-9.5 sm:h-8.5 sm:leading-8.5",
    props.type === "search" &&
      "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none",
    props.type === "file" &&
      "text-muted-foreground file:me-3 file:bg-transparent file:font-medium file:text-foreground file:text-sm",
  );

  return (
    <span
      className={
        cn(
          !unstyled &&
            "relative inline-flex w-full rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base text-foreground shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-has-disabled:not-has-focus-visible:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] has-focus-visible:has-aria-invalid:border-destructive/64 has-focus-visible:has-aria-invalid:ring-destructive/16 has-aria-invalid:border-destructive/36 has-focus-visible:border-ring has-autofill:bg-foreground/4 has-disabled:opacity-64 has-[:disabled,:focus-visible,[aria-invalid]]:shadow-none has-focus-visible:ring-[3px] sm:text-sm dark:bg-input/32 dark:has-autofill:bg-foreground/8 dark:has-aria-invalid:ring-destructive/24 dark:not-has-disabled:not-has-focus-visible:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)]",
          className,
        ) || undefined
      }
      data-size={size}
      data-slot="input-control"
    >
      {nativeInput ? (
        <input
          className={inputClassName}
          data-slot="input"
          size={typeof size === "number" ? size : undefined}
          {...props}
        />
      ) : (
        <InputPrimitive
          className={inputClassName}
          data-slot="input"
          size={typeof size === "number" ? size : undefined}
          {...props}
        />
      )}
    </span>
  );
}

export { Input, type InputProps };
