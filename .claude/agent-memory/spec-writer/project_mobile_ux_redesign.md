---
name: Mobile UX Redesign Spec
description: Spec written for mobile/tablet layout redesign — MobileShell, BottomNav, touch gestures, chat/search/history tabs
type: project
---

Spec at `planning/tasks/mobile-ux-redesign/spec.md`. Iteration 2 (architect-reviewed, 72→revised). Key decisions:

- `AppLayoutSwitcher` at `web/src/layouts/AppLayoutSwitcher.tsx` — `"use client"`, accepts only `children`, wrapped in `React.memo`. Does NOT wrap providers. `AppSidebar` is never mounted on mobile/tablet.
- `useScreenSize` extended with `isTablet`. SSR behavior: both `isMobile` and `isTablet` return `false` until `isMounted` fires. A CSS `@media` rule in `AppLayoutSwitcher` hides AppSidebar pre-JS to prevent flash.
- `MobileShell` URL routing: `router.replace()` is called ONLY on BottomNav tab button click or History row tap. External pathname changes are synced via `usePathname()` useEffect.
- Chat data flow: `isMobile` is read once in `ChatUI.tsx` and passed as a prop to message components — not called per-message (avoids N resize listeners).
- Tablet sidebar: Option A — new lightweight `TabletSidebar` component (no DnD, no modals). `AppSidebar` is too complex to reuse.
- History tab: infinite scroll via `useSWRInfinite` (20 sessions/page), client-side filter by title only, SWR error state with `IllustrationContent` retry.
- Tab error boundaries: `TabErrorBoundary.tsx` wraps each tab panel; renders `IllustrationContent` on failure.
- Touch gesture fallbacks: `useLongPress` calls `preventDefault` on `touchstart` to block hybrid device double-trigger. `pointer: coarse` media query controls `Hoverable` suppression.
- Design tokens: `BottomNav` uses `bg-background-neutral-01`, `border-border-02`, `Interactive.Stateful` for tabs. ActionSheet/BottomSheetSelect use `bg-background-neutral-01` with `bg-background-neutral-05/60` backdrop. Delete button: `bg-action-danger-02`.
- Playwright fixtures: sessions seeded via API in `beforeEach`, long-press via `page.mouse.down()` + 600ms wait, keyboard via viewport height reduction.

**Why:** Admin stays desktop-only. Only chat and search flows in scope.
**How to apply:** AppLayoutSwitcher insertion point in layout.tsx is the critical dependency; implement it first.
