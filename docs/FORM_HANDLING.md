---
title: TanStack Form
description: Build forms in React using TanStack Form and Zod.
links:
  doc: https://tanstack.com/form
---

This guide explores how to build forms using TanStack Form.

## Approach

This form leverages TanStack Form for powerful, headless form handling. We'll build our form using the `<Field />` component, which gives you **complete flexibility over the markup and styling**.

- Uses TanStack Form's `useAppForm` hook for form state management.
- `form.Field` component with render prop pattern for controlled inputs.
- `<Field />` components for building accessible forms.
- Client-side validation using Zod.
- Real-time validation feedback.

## 1 Context

before starting lets see our base.
- at @/hooks/form/form.tsx we have our custom wrapper.
- at @/components/form/*.tsx we have all our extend fields e.g. form-input.tsx, form-checkbox.tsx, form-checkbox-goup.tsx those are the basic components from ou packages/ui but extends with form logique, (label, error handling, validation, custom logique, etc...). if your creating a form and one is missing you should add it first at "@/components/form/*.tsx" and then in "@/hooks/form/form.tsx".

```tsx showLineNumbers {15-31}
import { createFormHook, useStore } from "@tanstack/react-form";
import { fieldContext, formContext, useFormContext } from "./form-context";
import { Button, type ButtonProps } from "@hushletter/ui/components";

import { FormForm } from "@/components/form/form-form";

export const { useAppForm, withForm, withFieldGroup } = createFormHook({
  fieldComponents: {},
  formComponents: {
    // all the extend form components are defined here:
    // e.g.
    // Input: FormInput,
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
```

## Full example

```tsx
export default function FullFormExample() {
  const queryClient = useQueryClient();

  const mutation = useMutation(
    orpc.mutation.mutationOptions({
      onError: (error) => {
        toast.error(error.message || "Une erreur est survenue");
      },
    }),
  );

  const schema = z.object({
    email: z.string();,
    password: z.string().min(8),
  });

  const form = useAppForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(
        {
          ...value
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: orpc.query.queryKey(),
            });
            form.reset();
          },
        },
      );
    },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "change",
    }),
    validators: {
      onSubmit: schema,
    },
  });

  return (
    <form.AppForm>
      <form.Form>
        {/* Form */}
        <div className="space-y-5">
          {/* Current password - only show if user has one */}
          <form.AppField name="email">
            {(field) =>
                <field.Input
                    label="Email"
                    placeholder="e.g. johndoe@email.com"
                />
            }
          </form.AppField>

          <form.AppField name="password">
            {(field) => (
              <field.Input
                label="Password"
                type="password"
                placeholder="**********"
                isRevealable
              />
            )}
          </form.AppField>


          <form.SubscribeButton>
            {mutation.isPending
              ? "Enregistrement..."
              : hasPassword
                ? "Modifier mon mot de passe"
                : "Créer un mot de passe"}
          </form.SubscribeButton>
        </div>
      </form.Form>
    </form.AppForm>
  );
}
```

Most of the time that will be enough. but form more complexe form, we can follow this partern with the tanstack/form doc.
- for schema validation, i have  a preference if its under @lib/validators/validator.<name>.ts
- for all async handling use react query with orpc.

