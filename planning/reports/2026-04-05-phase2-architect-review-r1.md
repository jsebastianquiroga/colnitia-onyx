# Stage Report: ARCHITECTURE_REVIEW (Revision 1)

Date: 2026-04-05
Task: mobile-ux-redesign
Status: REVISION_NEEDED

---

## Summary

Architecture review completed. **Score: 72/100.** The spec is strategically sound and respects the OPAL design system, but 10 issues identified require iteration before implementation proceeds. Three are critical blockers.

---

## Issues Identified

### Critical (3)

1. **MobileShell routing / URL sync logic unclear**
   - How does `usePathname()` initialization work on first load when user lands on `/app`?
   - Should tab activation always call `router.replace()`, or only when explicitly user-clicked?
   - **Action:** Clarify initialization flow and when to update URL.

2. **Tablet sidebar implementation choice not justified**
   - Spec says "sidebar overlay (translated -300px when closed)" but doesn't explain why overlay is better than a true split-pane or why 300px is the right width.
   - Interaction with existing `AppSidebar` DnD state unclear.
   - **Action:** Document design rationale and state management strategy.

3. **Testing fixtures and Playwright infrastructure**
   - No existing Playwright test fixtures for mobile viewports in `web/tests/e2e`.
   - Keyboard simulation via viewport resize is brittle and does not reflect real `visualViewport` API behavior.
   - **Action:** Define Playwright fixture pattern for mobile tests before writing test scenarios.

### High (4)

4. Input bar keyboard elevation logic (`useKeyboardHeight`) needs real device testing. `visualViewport` fallback to `innerHeight` diff is not reliable on all Android browsers.
5. Swipe gesture threshold (20px from left edge) conflicts with common UI patterns (back button, hamburger menu). May need per-zone configuration.
6. Safe-area inset constants (`env(safe-area-inset-bottom)`) may not work in Playwright; real device testing required.
7. Avatar size reduction (24px on mobile vs 32px desktop) and message bubble styling not detailed; impacts visual hierarchy and readability.

### Medium (3)

8. Lazy rendering of tab panels (`display: none` / `hidden`) preserves state but may leak memory if many conversations are loaded; memory footprint needs profiling plan.
9. Pull-to-refresh on Search tab not specified for tablet; should tablet use the same gesture or stick to desktop pagination?
10. Persona/model selector bottom sheet UX (keyboard interaction, dismiss on selection) not fully specified.

---

## Positive Findings

- **Strategy is sound**: Mobile-first shell with fallback to desktop layout respects existing architecture.
- **Risk table well thought out**: Covers `visualViewport` availability, sidebar state, iOS swipe conflicts, scroll position, z-index, and hover-action double-trigger.
- **Design system compliance**: All new components pinned to Opal, no `dark:` modifiers, strict TypeScript.
- **Acceptance criteria are testable**: 17 clear criteria with specific viewports and assertions.
- **Constants reuse**: `DESKTOP_SMALL_BREAKPOINT_PX = 912` reused as tablet upper bound; avoids magic numbers.

---

## Decisions Validated

- **No new routes**: Tab state stays local in `MobileShell`; URL sync via `router.replace()`.
- **Native touch events only**: Avoids gesture library bloat and iOS back-swipe conflicts.
- **Artifact modal overlay on mobile**: Correct; aligns with native app patterns.
- **Tablet sidebar as overlay**: Matches iPad conventions; existing sidebar can be re-used if state is properly isolated.

---

## Revision Requirements

Spec must be revised and re-submitted with:

1. **MobileShell routing flow diagram** (or pseudocode): show initialization, tab click, URL update sequence.
2. **Tablet sidebar design rationale**: explain overlay choice, dimensions, state isolation from `AppSidebar`, and swipe-gesture interaction zone.
3. **Playwright mobile fixtures**: define `mobilePhone` and `tablet` viewport fixtures in `web/tests/e2e/fixtures.ts` (or equivalent).
4. **Keyboard elevation clarification**: specify target browsers (iOS Safari, Chrome Android), `visualViewport` feature-detect code, and fallback behavior.
5. **Gesture interaction zones**: clarify 20px left-edge swipe start; check for conflicts with back button, menu button, or notification area.
6. **Memory profiling plan**: define how to measure and bound lazy-panel memory footprint.
7. **Message bubble styling details**: avatar sizes, border-radius changes, spacing adjustments per viewport.
8. **Tablet Search behavior**: pull-to-refresh vs pagination; grid layout specifics (2-column on tablet, single-column on phone).
9. **Bottom sheet interaction model**: keyboard navigation, dismiss triggers, focus management.
10. **Real device testing scope**: identify which features (keyboard elevation, safe-area insets, gestures) require real device validation before launch.

---

## Blockers Preventing Implementation

- Cannot start coding until critical issues #1, #2, #3 are resolved and spec is revised.
- Once revision submitted, architecture re-review will take 1–2 days.
- Estimated timeline to implementation start: 2026-04-06 or 2026-04-07.

---

## Artifacts

- Original spec: `planning/tasks/mobile-ux-redesign/spec.md`
- Design doc: `docs/plans/2026-04-05-mobile-ux-redesign.md`
- Revision tracking: Spec resubmitted here with changes marked.

---

## Handoff to Spec Author

Revision iteration 2 is ready. Address the 10 issues (focus first on critical #1, #2, #3). Re-submit revised spec, and architecture review will resume. Once passed (target score >85), implementation handoff begins.
