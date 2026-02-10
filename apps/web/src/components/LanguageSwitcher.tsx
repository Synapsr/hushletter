import { getLocale, locales, setLocale } from "@/paraglide/runtime.js";
import type { Locale } from "@/paraglide/runtime.js";

const localeNames: Record<string, string> = {
  en: "English",
  fr: "Fran\u00e7ais",
};

const DASHBOARD_PREFIXES = [
  "/newsletters",
  "/settings",
  "/import",
  "/community",
  "/admin",
];

function isDashboardRoute(pathname: string): boolean {
  return DASHBOARD_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export function LanguageSwitcher() {
  const currentLocale = getLocale();

  const handleLocaleChange = (locale: Locale) => {
    if (typeof window !== "undefined" && isDashboardRoute(window.location.pathname)) {
      // Dashboard: set cookie and reload (no URL prefix change)
      document.cookie = `PARAGLIDE_LOCALE=${locale}; path=/; max-age=34560000`;
      window.location.reload();
    } else {
      // Public pages: navigate to localized URL
      setLocale(locale);
    }
  };

  return (
    <div className="flex gap-1">
      {locales.map((locale: Locale) => (
        <button
          key={locale}
          onClick={() => handleLocaleChange(locale)}
          className={`px-2 py-1 text-sm rounded transition-colors ${
            locale === currentLocale
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
          aria-label={`Switch to ${localeNames[locale] ?? locale}`}
          aria-current={locale === currentLocale ? "true" : undefined}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
