import { useFieldContext } from "@/hooks/form/form-context";
import { useStore } from "@tanstack/react-form";

import { Input, Label, type InputProps } from "@hushletter/ui/components";

type FormInputProps = InputProps & {
  label: string;
};

export function FormInput({ ...props }: FormInputProps) {
  const field = useFieldContext<string>();

  const error = useStore(field.store, (state) => state.meta.errors)[0];

  return (
    <div className="space-y-1">
      <div className="space-y-2">
        <Label htmlFor={field.name}>{props.label}</Label>
        <Input
          {...props}
          id={field.name}
          onBlur={field.handleBlur}
          onValueChange={(value) => field.handleChange(value)}
          value={field.state.value}
        />
      </div>
      {error && <div className="text-sm text-red-400">{error.message}</div>}
    </div>
  );
}
