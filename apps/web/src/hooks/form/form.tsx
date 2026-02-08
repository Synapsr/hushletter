import { createFormHook, useStore } from "@tanstack/react-form";
import { fieldContext, formContext, useFormContext } from "./form-context";
import { Button, type ButtonProps } from "@hushletter/ui/components";

import { FormForm } from "@/components/form/form-form";
import { FormInput } from "@/components/form/form-input";

export const { useAppForm, withForm, withFieldGroup } = createFormHook({
  fieldComponents: {
    Input: FormInput,
  },
  formComponents: {
    Form: FormForm,
    SubscribeButton,
  },

  fieldContext,
  formContext,
});

function SubscribeButton({
  children,
  isDefaultValueDisabled,
  ...props
}: ButtonProps & {
  isDefaultValueDisabled?: boolean;
}) {
  const form = useFormContext();

  const isDefaultValue = useStore(form.store, (state) => state.isDefaultValue);

  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {() => (
        <Button
          {...props}
          disabled={
            props.disabled || form.state.isSubmitting || (isDefaultValueDisabled && isDefaultValue)
          }
          isPending={props.isPending ?? form.state.isSubmitting}
          onClick={(e) => {
            // Allow callers to run side-effects (eg. set submit intent) before submit.
            props.onClick?.(e);

            // If the caller prevented the default press behavior, do not submit.
            // `PressEvent` shape is owned by `react-aria-components`, so keep this resilient.
            if ((e as unknown as { defaultPrevented?: boolean }).defaultPrevented) {
              return;
            }

            // Submit after the press handler finishes so state updates can flush first.
            if (typeof globalThis.queueMicrotask === "function") {
              globalThis.queueMicrotask(() => form.handleSubmit());
            } else {
              Promise.resolve().then(() => form.handleSubmit());
            }
          }}
        >
          {children}
        </Button>
      )}
    </form.Subscribe>
  );
}

export type AppForm = ReturnType<typeof useAppForm>;
