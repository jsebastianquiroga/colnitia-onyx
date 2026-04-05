# Stage Report: SPEC_CREATION

Date: 2026-04-05
Task: mobile-ux-redesign
Status: COMPLETED

## Completed

- [x] Codebase exploration (existing `useScreenSize`, `AppSidebar`, layout files)
- [x] Design document authored at `docs/plans/2026-04-05-mobile-ux-redesign.md`
- [x] Full spec authored at `planning/tasks/mobile-ux-redesign/spec.md`

## Artifacts Created

- `docs/plans/2026-04-05-mobile-ux-redesign.md`
- `planning/tasks/mobile-ux-redesign/spec.md`

## Key Decisions Made

| Decision | Rationale | Impact |
| -------- | --------- | ------ |
| `MobileShell` layout switch via client-side `AppLayoutSwitcher` child | `app/app/layout.tsx` is a server component; hooks must live in a `"use client"` child | Requires wrapping the existing layout without touching auth/providers |
| `isTablet` = 641–912px (maps to existing `DESKTOP_SMALL_BREAKPOINT_PX`) | Reuses existing constant; no new magic numbers in the hook | `useScreenSize` gets a new exported field; existing `isMobile` unchanged |
| No new Next.js routes; tab state managed locally in `MobileShell` | URL scheme stays stable; deep links and refresh still work | Tabs derive active state from `usePathname()` and sync via `router.replace()` |
| Tablet uses sidebar overlay, phones use `BottomNav` | Different form factors need different navigation patterns | Two code paths inside `MobileShell` based on `isTablet` vs `isMobile` |
| Native touch events only — no gesture libraries | Keeps bundle small; avoids swipe conflicts with iOS back-swipe | Requires careful `preventDefault` gating in `useSwipeGesture` |
| Playwright E2E tests only (no unit tests) | Layout/viewport coordination cannot be adequately covered by unit tests | Test files go in `web/tests/e2e/mobile/`; 6 scenarios defined |
| Artifacts/Presentations render as full-screen modal overlays on mobile | Inline rendering is too cramped; consistent with iOS/Android native patterns | New `ArtifactModal` component needed; existing artifact renderer gets `isMobile` prop |

## Notable Findings from Codebase Exploration

- `useScreenSize` already exists but only exposes `isMobile` and `isDesktop` — `isTablet` must be added.
- `DESKTOP_SMALL_BREAKPOINT_PX = 912` already exists in `web/src/lib/constants.ts`; the spec reuses it as the tablet upper bound.
- `web/src/app/app/layout.tsx` is `async` (server component) — a client wrapper component is required to read screen size hooks.
- Existing `AppSidebar` has complex state (DnD, project modals, SWR hooks); it must stay unmounted on mobile (not hidden) to avoid running its hooks unnecessarily.
- All new components must use Opal design system (`Button`, `Text`, `Interactive.Container`) and must not use `dark:` Tailwind modifiers or raw `<button>`/`<input>` elements.
- `env(safe-area-inset-bottom)` is required for notch/home-indicator safe area on `BottomNav` and the input bar.

## Context for Next Stage (IMPLEMENTATION)

- Spec is complete and reviewed. Implementation can begin.
- Start with `useScreenSize` extension (small, isolated, testable) then `AppLayoutSwitcher` + `MobileShell` skeleton.
- All new mobile components go in `web/src/components/mobile/`; new layouts in `web/src/layouts/`.
- Hooks: `useLongPress`, `useKeyboardHeight`, `useSwipeGesture` — one file per hook in `web/src/hooks/`.
- Key risk to watch: `visualViewport` API availability — feature-detect and fall back to `window.innerHeight` diff.
- Key risk to watch: swipe-right gesture conflicts with iOS Safari's native back-swipe — only activate when `touchstart.x < 20px` and only call `preventDefault` after horizontal intent is confirmed.
- Acceptance criteria and 6 Playwright test scenarios are fully defined in the spec.
