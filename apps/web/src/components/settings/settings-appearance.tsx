"use client";

import { useState, useEffect } from "react";
import { Button, Label, Separator } from "@hushletter/ui/components";
import { Monitor, Moon, Sun } from "lucide-react";
import { getLocale, locales } from "@/paraglide/runtime.js";
import type { Locale } from "@/paraglide/runtime.js";

type Theme = "light" | "dark" | "system";

const localeLabels: Record<string, string> = {
  en: "English",
  fr: "Francais",
};

export const SettingsAppearance = () => {
  const [theme, setTheme] = useState<Theme>("system");
  const currentLocale = getLocale();
  const [selectedLocale, setSelectedLocale] = useState<Locale>(currentLocale);

  // Read current theme from DOM on mount
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (root.classList.contains("dark")) {
      setTheme("dark");
    } else if (root.classList.contains("light")) {
      setTheme("light");
    } else {
      setTheme("system");
    }
  }, []);

  const applyTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    const root = document.documentElement;
    root.classList.remove("light", "dark");

    if (newTheme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.add(prefersDark ? "dark" : "light");
    } else {
      root.classList.add(newTheme);
    }

    localStorage.setItem("theme", newTheme);
  };

  const handleLanguageChange = (locale: Locale) => {
    setSelectedLocale(locale);
    document.cookie = `PARAGLIDE_LOCALE=${locale}; path=/; max-age=34560000`;
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Appearance</h2>
        <p className="text-sm text-muted-foreground">
          Customize the look and feel of your dashboard.
        </p>
      </div>

      <Separator />

      {/* Theme */}
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-sm font-medium">Theme</Label>
          <p className="text-xs text-muted-foreground">
            Select your preferred color scheme.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <ThemeCard
            label="Light"
            icon={Sun}
            active={theme === "light"}
            onClick={() => applyTheme("light")}
          />
          <ThemeCard
            label="Dark"
            icon={Moon}
            active={theme === "dark"}
            onClick={() => applyTheme("dark")}
          />
          <ThemeCard
            label="System"
            icon={Monitor}
            active={theme === "system"}
            onClick={() => applyTheme("system")}
          />
        </div>
      </div>

      <Separator />

      {/* Language */}
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-sm font-medium">Language</Label>
          <p className="text-xs text-muted-foreground">
            Choose your preferred language.
          </p>
        </div>

        <div className="flex gap-2">
          {locales.map((locale: Locale) => (
            <Button
              key={locale}
              variant={selectedLocale === locale ? "default" : "outline"}
              size="sm"
              onClick={() => handleLanguageChange(locale)}
            >
              {localeLabels[locale] ?? locale}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

function ThemeCard({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof Sun;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
        active
          ? "border-primary bg-primary/5 text-foreground"
          : "border-transparent bg-muted/50 text-muted-foreground hover:border-border hover:bg-muted"
      }`}
    >
      <Icon className="size-5" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
