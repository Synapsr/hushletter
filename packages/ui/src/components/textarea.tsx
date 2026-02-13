import { cn } from "@hushletter/ui/lib/utils";

type TextareaProps = React.ComponentProps<"textarea"> & {
  unstyled?: boolean;
};

function Textarea({ className, unstyled = false, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        !unstyled &&
          "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm min-h-[80px]",
        !unstyled && "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        !unstyled &&
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className,
      ) || undefined}
      {...props}
    />
  );
}

export { Textarea, type TextareaProps };
