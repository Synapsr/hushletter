# Napkin

## Corrections
| Date | Source | What Went Wrong | What To Do Instead |
|------|--------|----------------|-------------------|
| 2026-02-13 | self | Tried reading `.claude/napkin.md` before it existed | Create `.claude/napkin.md` at session start when missing |
| 2026-02-13 | self | Large multi-hunk patch to `newsletters.ts` failed due drifted context | Apply smaller targeted patches for long files with active local changes |
| 2026-02-13 | self | Ran test path with `$id` unquoted and shell expanded it away | Quote route test paths containing `$` (e.g. `'.../$id.test.tsx'`) |
| 2026-02-13 | self | Used a stale context block in `apply_patch` while editing `SenderFolderItem.tsx` and patch failed | Re-read current numbered lines (`nl -ba`) and patch tight ranges after each file mutation |
| 2026-02-13 | self | Used `rg` with a newline escape in a single-line regex and got a parse error | Use simpler single-line patterns or enable multiline mode explicitly (`-U`) when needed |

## User Preferences
- Implement plans end-to-end when asked, with strong UX polish (optimistic updates and perceived performance).

## Patterns That Work
- Use Convex + TanStack Query with local optimistic overlay state for instant UI feedback while waiting for reactive sync.
- Keep optimistic state in one route-level controller and pass pure callbacks down to list/sidebar/reader to prevent duplicated mutation logic.

## Patterns That Don't Work
- Using broad `queryClient.invalidateQueries()` for high-frequency UI actions causes avoidable jitter.

## Domain Notes
- Newsletters list already supports hidden filtering via route search params and separate hidden query.
- `SenderFolderSidebar` currently has a `starred` tab shell but no backend behavior yet.

## Session Notes (2026-02-13)
- Reader/content file paths with `$` (e.g. `apps/web/src/routes/_authed/community/$contentId.tsx`) must be single-quoted in shell commands to avoid variable expansion.
- `ReaderView` breakage risk is primarily from rendering email HTML inside Tailwind `prose` plus restrictive sanitizer attrs for table-based email markup.
- For iframe-based reader rendering tests, assert against `iframe.srcdoc` rather than `screen.getByText`, since iframe contents are not part of the parent testing-library query tree.
- Reader personalization (font/background) should be applied at iframe `srcDoc` composition time; storing base sanitized doc in cache avoids refetch/re-sanitize while allowing preference-only re-renders.
- Reader background themes need iframe-document-level override (`html, body { background-color: ... !important; }`) because many newsletters paint full-width white backgrounds that hide container-only theming.
- Hooks order bug pattern: never place an early return before all hooks in a component. In `NewslettersPage`, `if (isPending) return ...` had to be moved below `useMemo` calls to prevent "Rendered more hooks than during the previous render".
| 2026-02-13 | self | Injected `<style>...</style>` string as style textContent in ReaderView override | For DOM-created style nodes, set raw CSS text only (no `<style>` wrapper) |
- Tiny iframe scrollbars in email reader are usually measurement rounding artifacts; add a small height buffer and disable iframe scrolling to avoid 1-4px internal overflow.
- Some emails use near-white values (`#fefefe`, `rgb(250,250,250)`, low-saturation high-lightness HSL), not exact white; remapping should use a near-white threshold instead of strict equality.
- For nested sidebar rows with both expand and select actions, keep separate interactive targets (disclosure trigger vs folder select button) to avoid accidental route-state mutations when users only toggle expansion.

- Browser reload prompt source: Convex client default `unsavedChangesWarning` when requests are inflight; disable in `apps/web/src/router.tsx` via `unsavedChangesWarning: false` to prevent false-positive refresh warning for reader flows.
- Reader appearance controls should live at pane-level (ReaderActionBar) with shared preference state passed into ReaderView; keep ReaderView as a pure renderer and apply font-size via iframe CSS override scale.
- Read-time UX can stay client-side: compute once from fetched raw content, cache per `userNewsletterId`, and emit via optional `ReaderView` callback so `InlineReaderPane` avoids hardcoded placeholders.
- For tiny newsletters, returning `0` minutes from read-time estimation lets UI render localized `<1 min ...` without adding new i18n keys or generation steps.
- Font-size preference can be ineffective on email HTML unless `font-size` declarations are rewritten directly (inline + style tags); root-level CSS alone is not enough for heavily inline-styled templates.
- Applying reader theme only inside ReaderView feels abrupt; extend the same background to InlineReaderPane container/scroll area for smoother visual continuity across header, summary, and content.
- Iframe auto-height can runaway if a safety buffer is added unconditionally on every measurement; only add buffer when `scrollHeight > clientHeight` to avoid ResizeObserver growth loops.
- `about:srcdoc` sandbox script warnings can still happen even after sanitization (often browser extension injection); use post-sanitize attribute/protocol cleanup and treat persistent warnings as expected unless `allow-scripts` is enabled.
