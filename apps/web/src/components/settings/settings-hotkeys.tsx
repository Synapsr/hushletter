"use client";

import { useMemo, useRef, useState } from "react";
import { Button, Kbd } from "@hushletter/ui/components";
import { cn } from "@hushletter/ui/lib/utils";
import { formatForDisplay, useHotkeyRecorder } from "@tanstack/react-hotkeys";
import { Pencil, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  useAppHotkeys,
  type HotkeyActionId,
  type HotkeyActionDefinition,
  type HotkeyScope,
} from "@/hooks/use-app-hotkeys";
import { m } from "@/paraglide/messages.js";

function getActionLabel(actionId: HotkeyActionId): string {
  switch (actionId) {
    case "openSettingsDialog":
      return m.settings_hotkeysActionOpenSettings();
    case "openImportDialog":
      return m.settings_hotkeysActionOpenImport();
    case "toggleGlobalSearch":
      return m.settings_hotkeysActionToggleSearch();
    case "closeInlineReaderPane":
      return m.settings_hotkeysActionCloseReader();
    case "toggleReaderFullscreen":
      return m.settings_hotkeysActionToggleFullscreen();
    default:
      return actionId;
  }
}

function getActionDescription(actionId: HotkeyActionId): string {
  switch (actionId) {
    case "openSettingsDialog":
      return m.settings_hotkeysFunctionOpenSettings();
    case "openImportDialog":
      return m.settings_hotkeysFunctionOpenImport();
    case "toggleGlobalSearch":
      return m.settings_hotkeysFunctionToggleSearch();
    case "closeInlineReaderPane":
      return m.settings_hotkeysFunctionCloseReader();
    case "toggleReaderFullscreen":
      return m.settings_hotkeysFunctionToggleFullscreen();
    default:
      return "";
  }
}

function getScopeLabel(scope: HotkeyScope): string {
  return scope === "global"
    ? m.settings_hotkeysScopeGlobal()
    : m.settings_hotkeysScopeReader();
}

function KeyPills({ hotkey }: { hotkey: string }) {
  const display = formatForDisplay(hotkey);
  const keys = display.split(/\s+/).filter(Boolean);

  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((key) => (
        <Kbd key={key} className="h-6 min-w-6 px-1.5 text-[11px]">
          {key}
        </Kbd>
      ))}
    </span>
  );
}

export const SettingsHotkeys = () => {
  const { actions, bindings, updateBinding, resetBindings } = useAppHotkeys();
  const [editingActionId, setEditingActionId] = useState<HotkeyActionId | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const clearTriggeredRef = useRef(false);

  const groupedActions = useMemo(() => {
    const scopeMap = new Map<HotkeyScope, HotkeyActionDefinition[]>();
    for (const action of actions) {
      const list = scopeMap.get(action.scope) ?? [];
      list.push(action);
      scopeMap.set(action.scope, list);
    }
    return Array.from(scopeMap, ([scope, items]) => ({
      scope,
      label: getScopeLabel(scope),
      actions: items,
    }));
  }, [actions]);

  const recorder = useHotkeyRecorder({
    onRecord: (hotkey) => {
      if (clearTriggeredRef.current && !hotkey.trim()) {
        clearTriggeredRef.current = false;
        return;
      }

      if (!editingActionId) return;

      const result = updateBinding(editingActionId, hotkey);

      if (!result.ok) {
        if (result.reason === "conflict" && result.conflictWith) {
          const conflictLabel = getActionLabel(result.conflictWith);
          const conflictError = m.settings_hotkeysConflictError({
            action: conflictLabel,
          });
          setError(conflictError);
          toast.error(conflictError);
        } else {
          const invalidError = m.settings_hotkeysInvalidError();
          setError(invalidError);
          toast.error(invalidError);
        }

        setEditingActionId(null);
        return;
      }

      setError(null);
      setEditingActionId(null);
      toast.success(m.settings_hotkeysUpdated());
    },
    onCancel: () => {
      setEditingActionId(null);
    },
    onClear: () => {
      clearTriggeredRef.current = true;
      const clearError = m.settings_hotkeysClearNotAllowed();
      setError(clearError);
      setEditingActionId(null);
      toast.error(clearError);
    },
  });

  const handleEdit = (actionId: HotkeyActionId) => {
    if (recorder.isRecording) {
      recorder.cancelRecording();
    }

    clearTriggeredRef.current = false;
    setError(null);
    setEditingActionId(actionId);
    recorder.startRecording();
  };

  const handleCancelRecording = () => {
    recorder.cancelRecording();
    setEditingActionId(null);
  };

  const handleReset = () => {
    if (recorder.isRecording) {
      recorder.cancelRecording();
    }

    clearTriggeredRef.current = false;
    setError(null);
    setEditingActionId(null);
    resetBindings();
    toast.success(m.settings_hotkeysResetSuccess());
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{m.settings_hotkeysTitle()}</h2>
        <p className="text-sm text-muted-foreground">
          {m.settings_hotkeysDescription()}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <div className="space-y-5">
        {groupedActions.map((group) => (
          <section key={group.scope} aria-label={group.label}>
            <div className="mb-2 flex items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="overflow-hidden rounded-lg border">
              {group.actions.map((action, index) => {
                const isEditing =
                  editingActionId === action.id && recorder.isRecording;
                const isLast = index === group.actions.length - 1;

                return (
                  <button
                    key={action.id}
                    type="button"
                    aria-pressed={isEditing}
                    aria-label={`${getActionLabel(action.id)}: ${formatForDisplay(bindings[action.id])}${isEditing ? ", recording new shortcut" : ""}`}
                    onClick={() => {
                      if (isEditing) {
                        handleCancelRecording();
                      } else {
                        handleEdit(action.id);
                      }
                    }}
                    className={cn(
                      "group flex w-full items-center justify-between gap-4 px-3.5 py-3 text-left transition-colors",
                      !isLast && "border-b",
                      isEditing
                        ? "bg-primary/5"
                        : "hover:bg-muted/50 cursor-pointer",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug">
                        {getActionLabel(action.id)}
                      </p>
                      <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                        {getActionDescription(action.id)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isEditing ? (
                        <span className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary animate-pulse">
                          {m.settings_hotkeysPressKeys()}
                        </span>
                      ) : (
                        <>
                          <KeyPills hotkey={bindings[action.id]} />
                          <Pencil className="size-3 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {m.settings_hotkeysResetHelp()}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-3" />
          {m.settings_hotkeysResetAll()}
        </Button>
      </div>
    </div>
  );
};
