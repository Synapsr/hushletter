import { useFormContext } from "@/hooks/form/form-context";
import { Form, type FormProps } from "@hushletter/ui/components";
import type { PropsWithChildren } from "react";

type Props = FormProps;

export const FormForm = ({ children, ...props }: PropsWithChildren<Props>) => {
  const form = useFormContext();

  return (
    <Form
      {...props}
      onSubmit={(e) => {
        e.preventDefault();
        //e.stopPropagation();
        form.handleSubmit();
      }}
    >
      {children}
    </Form>
  );
};
