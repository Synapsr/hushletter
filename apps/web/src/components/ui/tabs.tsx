import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  tabValues: string[];
  registerTab: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

function useTabsContext() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be used within a Tabs provider");
  }
  return context;
}

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ value, onValueChange, children, className, ...props }, ref) => {
    const [tabValues, setTabValues] = React.useState<string[]>([]);

    const registerTab = React.useCallback((tabValue: string) => {
      setTabValues((prev) => {
        if (prev.includes(tabValue)) return prev;
        return [...prev, tabValue];
      });
    }, []);

    return (
      <TabsContext.Provider value={{ value, onValueChange, tabValues, registerTab }}>
        <div ref={ref} className={cn("w-full", className)} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  },
);
Tabs.displayName = "Tabs";

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="tablist"
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),
);
TabsList.displayName = "TabsList";

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, ...props }, ref) => {
    const { value: selectedValue, onValueChange, tabValues, registerTab } = useTabsContext();
    const isSelected = selectedValue === value;

    // Register this tab value on mount
    React.useEffect(() => {
      registerTab(value);
    }, [value, registerTab]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const currentIndex = tabValues.indexOf(value);
      if (currentIndex === -1) return;

      let nextIndex: number | null = null;

      switch (event.key) {
        case "ArrowLeft":
          nextIndex = currentIndex > 0 ? currentIndex - 1 : tabValues.length - 1;
          break;
        case "ArrowRight":
          nextIndex = currentIndex < tabValues.length - 1 ? currentIndex + 1 : 0;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = tabValues.length - 1;
          break;
        default:
          return;
      }

      if (nextIndex !== null) {
        event.preventDefault();
        onValueChange(tabValues[nextIndex]);
        // Focus the next tab - find by data attribute
        const nextTab = document.querySelector(
          `[role="tab"][data-value="${tabValues[nextIndex]}"]`,
        ) as HTMLElement;
        nextTab?.focus();
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isSelected}
        aria-controls={`tabpanel-${value}`}
        tabIndex={isSelected ? 0 : -1}
        data-state={isSelected ? "active" : "inactive"}
        data-value={value}
        onClick={() => onValueChange(value)}
        onKeyDown={handleKeyDown}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          isSelected
            ? "bg-background text-foreground shadow-sm"
            : "hover:bg-background/50 hover:text-foreground",
          className,
        )}
        {...props}
      />
    );
  },
);
TabsTrigger.displayName = "TabsTrigger";

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, children, ...props }, ref) => {
    const { value: selectedValue } = useTabsContext();

    if (selectedValue !== value) {
      return null;
    }

    return (
      <div
        ref={ref}
        id={`tabpanel-${value}`}
        role="tabpanel"
        aria-labelledby={`tab-${value}`}
        tabIndex={0}
        data-state="active"
        className={cn(
          "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
