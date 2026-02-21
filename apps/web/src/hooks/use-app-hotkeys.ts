import {
  convertToModFormat,
  hasNonModifierKey,
  normalizeHotkey,
  validateHotkey,
  type Hotkey,
} from "@tanstack/react-hotkeys";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type HotkeyActionId =
  | "openSettingsDialog"
  | "openImportDialog"
  | "toggleGlobalSearch"
  | "closeInlineReaderPane"
  | "toggleReaderFullscreen";

export type HotkeyScope = "global" | "reader";

export type HotkeyBindingMap = Record<HotkeyActionId, Hotkey>;

export interface HotkeyActionDefinition {
  id: HotkeyActionId;
  label: string;
  description: string;
  scope: HotkeyScope;
  defaultHotkey: Hotkey;
}

export const HOTKEY_STORAGE_KEY = "hushletter:hotkeys:v1";

export const DEFAULT_HOTKEY_BINDINGS: HotkeyBindingMap = {
  openSettingsDialog: "Mod+,",
  openImportDialog: "Mod+I",
  toggleGlobalSearch: "Mod+K",
  closeInlineReaderPane: "Escape",
  toggleReaderFullscreen: "F",
};

const HOTKEY_ACTIONS: readonly HotkeyActionDefinition[] = [
  {
    id: "openSettingsDialog",
    label: "Open Settings",
    description: "Open the settings dialog.",
    scope: "global",
    defaultHotkey: DEFAULT_HOTKEY_BINDINGS.openSettingsDialog,
  },
  {
    id: "openImportDialog",
    label: "Open Import",
    description: "Open the import dialog.",
    scope: "global",
    defaultHotkey: DEFAULT_HOTKEY_BINDINGS.openImportDialog,
  },
  {
    id: "toggleGlobalSearch",
    label: "Toggle Search",
    description: "Open or close global search.",
    scope: "global",
    defaultHotkey: DEFAULT_HOTKEY_BINDINGS.toggleGlobalSearch,
  },
  {
    id: "closeInlineReaderPane",
    label: "Close Reader",
    description: "Close the inline reader pane.",
    scope: "reader",
    defaultHotkey: DEFAULT_HOTKEY_BINDINGS.closeInlineReaderPane,
  },
  {
    id: "toggleReaderFullscreen",
    label: "Toggle Fullscreen",
    description: "Toggle the reader fullscreen state.",
    scope: "reader",
    defaultHotkey: DEFAULT_HOTKEY_BINDINGS.toggleReaderFullscreen,
  },
] as const;

type HotkeyUpdateResult =
  | { ok: true; hotkey: Hotkey }
  | { ok: false; reason: "invalid" | "conflict"; conflictWith?: HotkeyActionId };

interface AppHotkeysContextValue {
  actions: readonly HotkeyActionDefinition[];
  bindings: HotkeyBindingMap;
  updateBinding: (
    actionId: HotkeyActionId,
    hotkey: string,
  ) => HotkeyUpdateResult;
  resetBindings: () => void;
  getConflict: (
    actionId: HotkeyActionId,
    hotkey: string,
  ) => HotkeyActionDefinition | null;
}

const AppHotkeysContext = createContext<AppHotkeysContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeBinding(hotkey: string): Hotkey | null {
  const trimmed = hotkey.trim();

  if (!trimmed) {
    return null;
  }

  const validation = validateHotkey(trimmed);
  if (!validation.valid || !hasNonModifierKey(trimmed)) {
    return null;
  }

  const normalized = normalizeHotkey(trimmed);
  return convertToModFormat(normalized) as Hotkey;
}

function normalizeForComparison(hotkey: string): string | null {
  const normalized = normalizeBinding(hotkey);
  if (!normalized) return null;
  return String(normalized).toUpperCase();
}

function findConflictId(
  bindings: HotkeyBindingMap,
  actionId: HotkeyActionId,
  hotkey: Hotkey,
): HotkeyActionId | null {
  const target = normalizeForComparison(hotkey);
  if (!target) return null;

  for (const action of HOTKEY_ACTIONS) {
    if (action.id === actionId) continue;

    const existing = normalizeForComparison(bindings[action.id]);
    if (existing === target) {
      return action.id;
    }
  }

  return null;
}

function sanitizeStoredBindings(stored: unknown): HotkeyBindingMap {
  const next: HotkeyBindingMap = { ...DEFAULT_HOTKEY_BINDINGS };

  if (!isRecord(stored)) {
    return next;
  }

  for (const action of HOTKEY_ACTIONS) {
    const value = stored[action.id];
    if (typeof value !== "string") continue;

    const normalized = normalizeBinding(value);
    if (normalized) {
      next[action.id] = normalized;
    }
  }

  const seen = new Set<string>();

  for (const action of HOTKEY_ACTIONS) {
    const candidate = next[action.id];
    const normalized = normalizeForComparison(candidate);

    if (!normalized) {
      next[action.id] = DEFAULT_HOTKEY_BINDINGS[action.id];
      seen.add(
        normalizeForComparison(DEFAULT_HOTKEY_BINDINGS[action.id]) ??
          DEFAULT_HOTKEY_BINDINGS[action.id],
      );
      continue;
    }

    if (seen.has(normalized)) {
      next[action.id] = DEFAULT_HOTKEY_BINDINGS[action.id];
      seen.add(
        normalizeForComparison(DEFAULT_HOTKEY_BINDINGS[action.id]) ??
          DEFAULT_HOTKEY_BINDINGS[action.id],
      );
      continue;
    }

    seen.add(normalized);
  }

  return next;
}

function persistBindings(bindings: HotkeyBindingMap) {
  try {
    localStorage.setItem(HOTKEY_STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    // Ignore persistence errors (private mode / quota issues).
  }
}

const FALLBACK_CONTEXT: AppHotkeysContextValue = {
  actions: HOTKEY_ACTIONS,
  bindings: DEFAULT_HOTKEY_BINDINGS,
  updateBinding: () => ({ ok: false, reason: "invalid" }),
  resetBindings: () => {},
  getConflict: () => null,
};

export function AppHotkeysProvider({ children }: { children: ReactNode }) {
  const [bindings, setBindings] = useState<HotkeyBindingMap>(
    DEFAULT_HOTKEY_BINDINGS,
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HOTKEY_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as unknown;
      const sanitized = sanitizeStoredBindings(parsed);
      setBindings(sanitized);
      persistBindings(sanitized);
    } catch {
      // Ignore malformed localStorage values.
    }
  }, []);

  const updateBinding = useCallback(
    (actionId: HotkeyActionId, hotkey: string): HotkeyUpdateResult => {
      const normalized = normalizeBinding(hotkey);
      if (!normalized) {
        return { ok: false, reason: "invalid" };
      }

      const conflictWith = findConflictId(bindings, actionId, normalized);
      if (conflictWith) {
        return { ok: false, reason: "conflict", conflictWith };
      }

      const next = {
        ...bindings,
        [actionId]: normalized,
      } satisfies HotkeyBindingMap;

      setBindings(next);
      persistBindings(next);

      return {
        ok: true,
        hotkey: normalized,
      };
    },
    [bindings],
  );

  const resetBindings = useCallback(() => {
    setBindings(DEFAULT_HOTKEY_BINDINGS);
    persistBindings(DEFAULT_HOTKEY_BINDINGS);
  }, []);

  const getConflict = useCallback(
    (actionId: HotkeyActionId, hotkey: string): HotkeyActionDefinition | null => {
      const normalized = normalizeBinding(hotkey);
      if (!normalized) {
        return null;
      }

      const conflictId = findConflictId(bindings, actionId, normalized);
      if (!conflictId) {
        return null;
      }

      return HOTKEY_ACTIONS.find((action) => action.id === conflictId) ?? null;
    },
    [bindings],
  );

  const value = useMemo<AppHotkeysContextValue>(
    () => ({
      actions: HOTKEY_ACTIONS,
      bindings,
      updateBinding,
      resetBindings,
      getConflict,
    }),
    [bindings, getConflict, resetBindings, updateBinding],
  );

  return createElement(AppHotkeysContext.Provider, { value }, children);
}

export function useAppHotkeys() {
  return useContext(AppHotkeysContext) ?? FALLBACK_CONTEXT;
}
