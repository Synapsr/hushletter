import { useState, useCallback, useEffect } from "react";

export const READER_BACKGROUND_OPTIONS = {
  default: { label: "Default", color: "transparent" },
  paper: { label: "Paper", color: "#F7F1E5" },
  mist: { label: "Mist", color: "#EEF4FB" },
  sand: { label: "Sand", color: "#F3E7D3" },
  slate: { label: "Slate", color: "#E6EAF2" },
  night: { label: "Night", color: "#1B2230" },
} as const;

export const READER_FONT_OPTIONS = {
  original: "Original font",
  serif: "Serif",
  sans: "Sans",
  mono: "Monospace",
} as const;

export const READER_FONT_SIZE_OPTIONS = {
  small: { label: "Small", scale: 0.92 },
  medium: { label: "Medium", scale: 1 },
  large: { label: "Large", scale: 1.08 },
  xlarge: { label: "Extra large", scale: 1.16 },
} as const;

export type ReaderBackgroundPreference = keyof typeof READER_BACKGROUND_OPTIONS;
export type ReaderFontPreference = keyof typeof READER_FONT_OPTIONS;
export type ReaderFontSizePreference = keyof typeof READER_FONT_SIZE_OPTIONS;

export interface ReaderPreferences {
  background: ReaderBackgroundPreference;
  font: ReaderFontPreference;
  fontSize: ReaderFontSizePreference;
}

export const READER_PREFERENCES_STORAGE_KEY = "hushletter:reader-preferences:v1";

const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  background: "default",
  font: "original",
  fontSize: "medium",
};

function isReaderBackgroundPreference(
  value: unknown,
): value is ReaderBackgroundPreference {
  return (
    value === "default" ||
    value === "paper" ||
    value === "mist" ||
    value === "sand" ||
    value === "slate" ||
    value === "night"
  );
}

function isReaderFontPreference(value: unknown): value is ReaderFontPreference {
  return (
    value === "original" ||
    value === "serif" ||
    value === "sans" ||
    value === "mono"
  );
}

function isReaderFontSizePreference(
  value: unknown,
): value is ReaderFontSizePreference {
  return (
    value === "small" ||
    value === "medium" ||
    value === "large" ||
    value === "xlarge"
  );
}

function sanitizeReaderPreferences(
  value: unknown,
): ReaderPreferences | null {
  if (typeof value !== "object" || value === null) return null;
  const obj = value as Record<string, unknown>;

  if (!isReaderBackgroundPreference(obj.background) || !isReaderFontPreference(obj.font)) {
    return null;
  }

  return {
    background: obj.background,
    font: obj.font,
    fontSize: isReaderFontSizePreference(obj.fontSize)
      ? obj.fontSize
      : DEFAULT_READER_PREFERENCES.fontSize,
  };
}

export function useReaderPreferences() {
  const [preferences, setPreferences] = useState<ReaderPreferences>(
    DEFAULT_READER_PREFERENCES,
  );

  useEffect(() => {
    try {
      const stored = localStorage.getItem(READER_PREFERENCES_STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored) as unknown;
      const sanitized = sanitizeReaderPreferences(parsed);
      if (sanitized) {
        setPreferences(sanitized);
      }
    } catch {
      // Ignore malformed or inaccessible localStorage values.
    }
  }, []);

  const persist = useCallback((next: ReaderPreferences) => {
    try {
      localStorage.setItem(READER_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      console.warn(
        "[useReaderPreferences] Failed to persist preference to localStorage",
      );
    }
  }, []);

  const setBackground = useCallback(
    (background: ReaderBackgroundPreference) => {
      setPreferences((prev) => {
        const next = { ...prev, background };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const setFont = useCallback(
    (font: ReaderFontPreference) => {
      setPreferences((prev) => {
        const next = { ...prev, font };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const setFontSize = useCallback(
    (fontSize: ReaderFontSizePreference) => {
      setPreferences((prev) => {
        const next = { ...prev, fontSize };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  return {
    preferences,
    setBackground,
    setFont,
    setFontSize,
  };
}
