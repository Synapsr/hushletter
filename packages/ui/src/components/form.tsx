"use client";

import { Form as FormPrimitive } from "@base-ui/react/form";

import { cn } from "@hushletter/ui/lib/utils";

type FormProps = FormPrimitive.Props;

function Form({ className, ...props }: FormProps) {
  return (
    <FormPrimitive
      className={cn("flex w-full flex-col gap-4", className)}
      data-slot="form"
      {...props}
    />
  );
}

export { Form, type FormProps };
