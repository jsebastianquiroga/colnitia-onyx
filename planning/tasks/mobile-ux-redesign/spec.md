# Specification: Mobile UX Redesign

## 1. Overview

The current frontend has basic responsiveness — the sidebar collapses to a drawer on `isMobile` (≤640px) and Tailwind breakpoints exist — but the experience feels like "desktop shrunk down." This redesign introduces a `MobileShell` layout and purpose-built mobile components for phones (≤640px) and tablets (641–912px), scoped to the chat and search flows only. Admin stays desktop-only.

The design document is at `docs/plans/2026-04-05-mobile-ux-redesign.md`.

---

## 2. Requirements

### 2.1 Functional Requirements

- FR1: On `isMobile` or `isTablet`, `web/src/app/app/layout.tsx` renders `<MobileShell>` instead of `<AppSidebar>` + children.
- FR2: `MobileShell` on phones renders a `BottomNav` with three tabs — Chat, Search, History — that switch active view without a page reload and without changing the URL.
- FR3: `MobileShell` on tablets renders a collapsible sidebar overlay (~300px) instead of `BottomNav`; the sidebar opens with a swipe-right-from-left-edge gesture and closes by tapping the backdrop.
- FR4: `MobileHeader` renders at 48px height with: compact logo (left) + new-conversation button (right) on new-session; back button + persona/chat name when inside an active chat.
- FR5: Chat message area removes the `max-w-[740px]` constraint on mobile and uses 12px side padding.
- FR6: Message bubbles use smaller avatars (24px on mobile vs 32px desktop) and more pronounced rounded corners.
- FR7: Code blocks in messages support horizontal scroll and expose a copy button with a minimum 44×44px touch target.
- FR8: The chat input bar sticks above `BottomNav` and elevates with the software keyboard via the `visualViewport` API.
- FR9: The persona/model selector opens a bottom sheet (instead of a dropdown) on mobile.
- FR10: Message actions (copy, regenerate, edit) are triggered by long-press (≥500ms) and open an `ActionSheet`; hover-based actions are suppressed on mobile.
- FR11: Artifacts (e.g., Presentations) render as full-screen modal overlays with a prominent close button; inline rendering is suppressed on mobile.
- FR12: The Search tab shows a search bar (auto-focused on tab entry), compact result cards (title + 2-line snippet + source icon), horizontal scrollable filter chips (source type, date), pull-to-refresh, and a full-screen modal for the selected result document.
- FR13: The History tab shows conversations sorted by date (title + persona + relative date), a top search bar to filter by title, swipe-left to reveal a red delete button, and tap to load that conversation in the Chat tab.
- FR14: On tablets, History lives in the improved sidebar (existing chat list); Search uses the same layout as desktop but with a 2-column result grid.
- FR15: Touch gestures (swipe, long-press) are implemented with native `touchstart`/`touchmove`/`touchend` events — no external gesture libraries.
- FR16: Tab navigation preserves state of inactive tabs via lazy rendering (mount on first visit, keep mounted thereafter).
- FR17: All animations respect `prefers-reduced-motion`.
- FR18: Avatar and image sizes are reduced on mobile; lazy-load images in History and Search result lists.

### 2.2 Non-Functional Requirements

- NFR1: All new components are strictly typed in TypeScript; no `any` types.
- NFR2: Minimum touch target size is 44×44px for all interactive elements on mobile (WCAG 2.5.5).
- NFR3: Bottom nav and input bar use `env(safe-area-inset-bottom)` for notch/home-indicator padding.
- NFR4: Components follow the Opal design system: `Button` from `@opal/components`, `Text` from `@opal/components`, custom color tokens from `tailwind-themes/tailwind.config.js`, icons from `web/src/icons/` only, no `dark:` Tailwind modifiers.
- NFR5: No raw `<button>`, `<input>`, or `<div onClick>` replacing interactive Opal components; use `Interactive.Container` or `Button` as appropriate.
- NFR6: New hooks follow the hook-per-file convention in `web/src/hooks/`.
- NFR7: New mobile-only components go in `web/src/components/mobile/`; new layouts in `web/src/layouts/`.

---

## 3. Technical Design

### 3.1 Architecture Changes

#### 3.1.1 `useScreenSize` hook — `web/src/hooks/useScreenSize.ts`

Extend the returned `ScreenSize` interface to include `isTablet`:

- `isTablet`: `true` when `width > MOBILE_SIDEBAR_BREAKPOINT_PX (640)` and `width <= DESKTOP_SMALL_BREAKPOINT_PX (912)`.
- No changes to the existing `isMobile` definition (≤640px maps to `MOBILE_SIDEBAR_BREAKPOINT_PX`).
- Export `isTablet` alongside the existing fields.

**SSR / hydration behavior:**

The current hook initializes `sizes` with a lazy state initializer: `() => ({ width: typeof window !== "undefined" ? window.innerWidth : 0, height: ... })`. During SSR, `window` is undefined, so `width` initializes to `0`. `isMobile` and `isTablet` are both guarded by the `isMounted` flag returned from `useOnMount`. Therefore:

- On the server: `isMounted` is `false`, so `isTablet` returns `false` (same as `isMobile`).
- On first client render before `useOnMount` fires: `isMounted` is `false`, so `isTablet` returns `false`.
- After mount: the `resize` listener is registered; `isMounted` becomes `true`; `isTablet` reflects real `window.innerWidth`.

The `isMounted` guard is intentional — it prevents a hydration mismatch between server HTML (always renders desktop layout) and the first client paint. Components that consume `isTablet` must therefore account for a brief flash of the desktop layout on phones/tablets before mount. To minimize this flash, `AppLayoutSwitcher` (see 3.1.2) should apply a CSS class that hides `AppSidebar` on small viewports via a `@media` rule, so the layout shift is invisible even before JS runs.

Add `isTablet` to the return object with the same `isMounted &&` guard:

```typescript
isTablet: isMounted && sizes.width > MOBILE_SIDEBAR_BREAKPOINT_PX && sizes.width <= DESKTOP_SMALL_BREAKPOINT_PX,
```

#### 3.1.2 `app/app/layout.tsx` — Layout switching and `AppLayoutSwitcher`

The server component at `web/src/app/app/layout.tsx` currently renders:

```
<ProjectsProvider>
  <VoiceModeProvider>
    <div className="flex flex-row w-full h-full overflow-hidden">
      <AppSidebar />
      {children}
    </div>
  </VoiceModeProvider>
</ProjectsProvider>
```

Replace the inner `<div>` + `<AppSidebar />` + `{children}` with a new `"use client"` component: `AppLayoutSwitcher`, located at `web/src/layouts/AppLayoutSwitcher.tsx`.

**Responsibilities of `AppLayoutSwitcher`:**

- It is a pure layout selector — it does NOT wrap any providers. `ProjectsProvider` and `VoiceModeProvider` remain in `layout.tsx` (server component).
- It accepts `children: React.ReactNode` as its only prop (the page content passed through from `layout.tsx`).
- It reads `useScreenSize()` and conditionally renders:
  - `<MobileShell>{children}</MobileShell>` when `isMobile || isTablet`
  - `<div className="flex flex-row w-full h-full overflow-hidden"><AppSidebar />{children}</div>` on desktop.
- It is wrapped in `React.memo` to prevent re-renders when parent providers re-render. Because `children` is a ReactNode (referentially unstable), memo alone is insufficient — the component must also avoid re-mounting `AppSidebar` or `MobileShell` on unrelated parent re-renders. Use a stable `children` identity or ensure the switcher's render output is stable.
- `AppSidebar` is never mounted on mobile/tablet. Keeping it unmounted (not `display: none`) ensures its DnD-kit sensors, SWR hooks (`useChatSessions`, `useAgents`, `usePinnedAgents`, etc.), and project modal state do not initialize on mobile — avoiding unnecessary network requests and potential state corruption.
- To suppress the hydration flash (desktop layout briefly visible on mobile before mount), `AppLayoutSwitcher` should render a `<style>` tag or apply a CSS class that hides `AppSidebar` at `@media (max-width: 912px)` before JS runs.

The updated `layout.tsx` shape:

```tsx
// layout.tsx (server component — unchanged except inner div replaced)
return (
  <ProjectsProvider>
    <VoiceModeProvider>
      <AppLayoutSwitcher>{children}</AppLayoutSwitcher>
    </VoiceModeProvider>
  </ProjectsProvider>
);
```

#### 3.1.3 New files

| File | Purpose |
|------|---------|
| `web/src/layouts/MobileShell.tsx` | Root mobile layout: renders `MobileHeader`, tab content area, `BottomNav` (phone) or sidebar overlay (tablet). Manages active tab state. |
| `web/src/layouts/MobileHeader.tsx` | 48px header with context-aware content (logo/new-chat vs back/persona name). |
| `web/src/components/mobile/BottomNav.tsx` | Fixed 56px bottom nav with 3 tabs, safe-area padding, accent indicator. |
| `web/src/components/mobile/ActionSheet.tsx` | Bottom sheet for message long-press actions (copy, regenerate, edit). |
| `web/src/components/mobile/SwipeableItem.tsx` | Wrapper implementing swipe-left reveal for delete; used by History tab rows. |
| `web/src/components/mobile/BottomSheetSelect.tsx` | Bottom sheet replacement for dropdowns (persona/model selector). |
| `web/src/components/mobile/PullToRefresh.tsx` | Pull-to-refresh wrapper for Search tab using touch events. |
| `web/src/hooks/useLongPress.ts` | Returns `onTouchStart`/`onTouchEnd` props that fire a callback after 500ms hold. |
| `web/src/hooks/useKeyboardHeight.ts` | Tracks `visualViewport.height` changes to compute keyboard intrusion height. |
| `web/src/hooks/useSwipeGesture.ts` | Generic left/right swipe detector via native touch events, configurable threshold. |
| `web/src/layouts/AppLayoutSwitcher.tsx` | `"use client"` component; reads `useScreenSize`, renders `MobileShell` or desktop layout. Wrapped in `React.memo`. |
| `web/src/layouts/TabletSidebar.tsx` | Lightweight read-only sidebar overlay for tablets. No DnD, no modals. SWR read of chat sessions and agents only. |
| `web/src/components/mobile/TabErrorBoundary.tsx` | React error boundary wrapping each tab panel. Renders `IllustrationContent` on error with retry. |

#### 3.1.4 MobileShell internals

`MobileShell` holds:

- `activeTab: "chat" | "search" | "history"` state, initialized from the current pathname (`/app/chat/*` → `"chat"`, `/app/search` → `"search"`, default → `"chat"`).
- Three tab panels rendered conditionally: mounted lazily on first activation, then kept mounted (`display: none` / `hidden` for inactive tabs to preserve state).
- On phones: renders `<BottomNav>` fixed at bottom; the content area has `padding-bottom` equal to `56px + env(safe-area-inset-bottom)`.
- On tablets: renders a sidebar overlay; no `BottomNav`. Swipe-right-from-left-edge (detected by `useSwipeGesture`) opens the sidebar. A semi-transparent backdrop closes it on tap.

**URL routing decision tree:**

`router.replace()` is called ONLY in these two situations:

1. **User taps a `BottomNav` tab button** — the tab's canonical URL is pushed. Mapping:
   - `"chat"` → current chat URL preserved if already on `/app/chat/*`, otherwise `/app/chat`
   - `"search"` → `/app/search`
   - `"history"` → `/app/history` (no new route needed; `MobileShell` renders `HistoryTab` inline)
2. **User taps a History row to load a conversation** — `router.replace("/app/chat/[id]")` is called and `activeTab` is set to `"chat"`.

`router.replace()` is NOT called on:
- Internal `activeTab` state changes driven by `MobileShell` logic (e.g., programmatic tab switch from a child component callback).
- Pathname changes triggered by Next.js navigation from within the Chat panel (e.g., following a link in a message). `MobileShell` watches `usePathname()` with a `useEffect` to sync `activeTab` when the pathname changes externally.

**Deep link behavior:** When the page loads with a URL like `/app/chat/abc123`, `MobileShell` initializes `activeTab` to `"chat"` and the chat panel renders that session. Navigating directly to `/app/search` sets `activeTab` to `"search"`.

**Tab state preservation:**

- Scroll positions are saved per-tab in a `useRef` map within `MobileShell` (`scrollPositions.current["chat"]`, etc.). On tab deactivation, the panel's scroll container `scrollTop` is captured. On re-activation, it is restored after the tab becomes visible.
- SWR caches are globally keyed and survive tab switches automatically; no special handling needed.
- Chat session URL changes (e.g., starting a new chat that gets assigned an ID) propagate through Next.js router normally inside the Chat tab panel. The Chat tab does not reset when switching to another tab and back because the panel stays mounted.

**Error boundaries:**

Each of the three tab panels (`ChatTab`, `SearchTab`, `HistoryTab`) is wrapped in a React error boundary component (`web/src/components/mobile/TabErrorBoundary.tsx`). On error, the boundary renders an `IllustrationContent` (from `@opal/layouts`) with a "Something went wrong" message and a retry button that resets the boundary. This prevents a failed tab from crashing the entire `MobileShell`.

#### 3.1.5 Chat view adaptations

Modifications to existing components (all conditioned on `isMobile` from `useScreenSize`):

- `web/src/sections/chat/ChatUI.tsx`: Read `useScreenSize()` internally (do not accept `isMobile` as a prop — this avoids threading the value through multiple layers). Use the result to remove the `max-w-[740px]` constraint and apply `px-3` (12px) side padding.
- Message bubble components under `web/src/app/app/message/`: `isMobile` is read once in `ChatUI` and passed down as a prop to message components (do NOT call `useScreenSize()` inside each individual message component — this would cause one `resize` event listener per message, which is expensive in long conversations). Message components accept `isMobile: boolean` prop to shrink avatar size from 32px to 24px and increase border-radius.
- Code block component (wherever copy button lives): ensure button has `min-w-[44px] min-h-[44px]`; add `overflow-x-auto` to the code block container.
- `AppInputBar` (locate via `web/src/app/app/`): When `isMobile`, subscribe to `useKeyboardHeight` and apply `bottom` offset equal to keyboard height + BottomNav height. Use `position: fixed` for the input bar on mobile.
- Persona/model selector: When `isMobile`, replace the existing dropdown/popover trigger with a button that opens `<BottomSheetSelect>`.
- Artifacts / Presentations: When `isMobile`, intercept the render and open a full-screen modal overlay (new component `web/src/components/mobile/ArtifactModal.tsx`) instead of inline rendering.

#### 3.1.6 Message long-press actions

- Use `useLongPress` hook on each message bubble.
- On fire, open `<ActionSheet>` with options: Copy, Regenerate, Edit.
- Suppress desktop hover-reveal actions (via `Hoverable.Root/Item`) when `isMobile` — pass `disabled` or simply omit `Hoverable` wrappers when on mobile.

#### 3.1.7 Search tab

New component at `web/src/components/mobile/tabs/SearchTab.tsx`:

- Uses `useSWR` for search results (same API as existing desktop search).
- Auto-focuses the search `InputTypeIn` on mount / tab activation.
- Filter chips: horizontally scrollable row of toggle chips (source type, date range) using `Interactive.Stateful` from `@opal/core`.
- Result cards: `ContentAction` from `@opal/layouts` with title, 2-line snippet, source icon.
- Pull-to-refresh: `PullToRefresh` wrapper calls `mutate()` on the SWR key.
- Tapping a result opens `ArtifactModal` (or a dedicated `DocumentModal`) full-screen.
- Tablet: 2-column CSS grid for results (`grid-cols-2`).

#### 3.1.8 History tab

New component at `web/src/components/mobile/tabs/HistoryTab.tsx`:

- Reads chat sessions from the existing `useChatSessions` hook. Sessions are loaded with **infinite scroll**: an initial page of 20 sessions is fetched; a sentinel element at the bottom of the list triggers fetching the next page via `useSWRInfinite`. The `useChatSessions` hook may need to be extended to support pagination if it currently fetches all sessions at once.
- On SWR error, render `IllustrationContent` (from `@opal/layouts`) with a "Could not load history" message and a retry button that calls `mutate()`.
- Renders a list of `SwipeableItem` rows.
- Each row: chat title + persona name + relative date using `ContentAction`.
- Swipe-left reveals a red delete button; delete calls `deleteChatSession` and removes from list (optimistic update via SWR `mutate`).
- Tap row: sets `activeTab` to `"chat"` and navigates to `/app/chat/[id]` via `useRouter`.
- Top filter: `InputTypeIn` that filters sessions **client-side by title** against the already-loaded pages. The filter does NOT trigger a new API call — it is a local substring match against the fetched sessions. Clearing the filter restores the full list.

#### 3.1.9 Tablet sidebar

**Decision: Option A — new lightweight `TabletSidebar` component.**

`AppSidebar` is disqualified from direct reuse on tablets because it carries DnD-kit sensors (`DndContext`, `PointerSensor`, `KeyboardSensor`), multiple SWR hooks (`useChatSessions`, `useAgents`, `usePinnedAgents`, `useProjects`), complex modal state (`CreateProjectModal`, `MoveCustomAgentChatModal`), and drag-drop reordering. Mounting it inside a conditionally shown overlay introduces significant overhead and potential state corruption when toggling visibility.

Instead, create a new `web/src/layouts/TabletSidebar.tsx` component that is a lightweight read-only sidebar:

- Renders the chat session list using `useChatSessions` (SWR hook, read-only — no drag reordering).
- Renders the agent/persona selector using `useAgents` (read-only).
- Provides a "New Chat" button and a link to full settings.
- No DnD-kit, no project modals, no folder drag-drop.
- Positioned absolutely at `left: 0`, width 300px, full height, `z-index` above page content (use `z-40` or the design system modal layer minus one).
- Closed state: `transform: translateX(-300px)`; open state: `transform: translateX(0)`. Transition is `transition-transform duration-250ms ease-in-out` (suppressed via `prefers-reduced-motion`).
- Opening: driven by `useSwipeGesture` (swipe-right from `touchstart.x < 20px`) or a hamburger button in `MobileHeader`.
- Closing: tap on semi-transparent backdrop (`bg-background-neutral-05/60`) or swipe-left within the sidebar.
- No error boundary needed inside `TabletSidebar` itself (it is simple enough); the outer `AppLayoutSwitcher` error boundary covers it.

---

### 3.2 Routing

- No new Next.js routes are created. URLs remain `/app/chat/[id]`, `/app/search`, etc.
- `MobileShell` derives the active tab from `usePathname()` on initial render and updates the URL via `router.replace()` when tab changes (to keep URL in sync for deep links / refresh).
- The tab panels render the existing page components as children (passed via `children` prop or via slot props from `layout.tsx`).

### 3.2.1 Design system tokens for mobile components

All new mobile components use Opal design system primitives and color tokens from `tailwind-themes/tailwind.config.js`. Specific assignments:

| Component | Background | Border | Active/selected state | Text |
|-----------|-----------|--------|----------------------|------|
| `BottomNav` container | `bg-background-neutral-01` | `border-t border-border-02` | — | — |
| `BottomNav` inactive tab | — | — | — | `text-03` |
| `BottomNav` active tab | — | — | Accent dot: `bg-theme-primary-05` | `text-01` |
| `BottomNav` tab button | Uses `Interactive.Stateful` with `state="selected"` when active, `state="empty"` when inactive | — | — | — |
| `ActionSheet` backdrop | `bg-background-neutral-05/60` | — | — | — |
| `ActionSheet` sheet body | `bg-background-neutral-01` | `border-t border-border-02` rounded-t-2xl | — | — |
| `ActionSheet` action row | Uses `Interactive.Stateless` `variant="default"` `prominence="tertiary"` | — | — | `text-01` (default), `text-action-danger-01` (destructive) |
| `BottomSheetSelect` | Same as `ActionSheet` | Same as `ActionSheet` | Selected item: `Interactive.Stateful` `state="selected"` | — |
| `TabletSidebar` overlay | `bg-background-neutral-01` | `border-r border-border-02` | — | — |
| Delete button (SwipeableItem) | `bg-action-danger-02` | — | — | `text-inverted-01` |

All sheet components are rendered via `ReactDOM.createPortal` into `document.body` at `z-50` (one above the design system's standard modal layer at `z-40`).

### 3.2.2 Touch gesture fallbacks and hybrid device handling

**Pointer type detection:** The `useLongPress` and `useSwipeGesture` hooks listen to `touchstart`/`touchmove`/`touchend` events. On mouse-only devices (no touch support), these events do not fire and the hooks are dormant — no fallback needed.

**Hybrid devices (both touch and mouse events):** Some devices (e.g., Surface Pro, Chromebook touchscreen) fire both `touchstart` and `mousedown` for the same gesture. To prevent double-triggering:

- `useLongPress`: Call `event.preventDefault()` inside `touchstart` handler to suppress the subsequent `mousedown`. Accept a `preventMouseFallthrough?: boolean` option (default `true`).
- `useSwipeGesture`: Same approach — `preventDefault` on confirmed horizontal `touchmove` to prevent scroll and mouse-event duplication.
- Hover actions suppression: `MobileShell` evaluates `window.matchMedia('(pointer: coarse)')` once on mount and stores the result in a ref. This is passed as `isTouchDevice` to components that conditionally suppress `Hoverable.Root/Item` wrappers. On hybrid devices where `pointer: fine` is reported (mouse detected as primary), `Hoverable` actions remain active — this is acceptable behavior.

**`prefers-reduced-motion`:** All `MobileShell` tab transitions, `TabletSidebar` slide, and `ActionSheet` slide-up use `transition-transform`. A global CSS rule in the mobile layout suppresses transitions: `@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }` scoped to the `MobileShell` root element.

### 3.3 Constants

Add `TABLET_BREAKPOINT_PX = 912` to `web/src/lib/constants.ts` (already exported as `DESKTOP_SMALL_BREAKPOINT_PX`; alias or re-export under the semantically clear name for mobile code to read).

---

## 4. Testing Strategy

- Playwright tests only (E2E), as the changes involve significant layout/viewport coordination that unit tests cannot adequately cover.
- Test files go in `web/tests/e2e/mobile/`.

### Test setup and fixtures

**Authentication:** Reuse the existing `page.goto("/")` + login helper pattern from other E2E tests. Log in as `a@example.com` / `a`.

**Seeding chat data:** Tests that require conversations in History use the existing chat API to pre-create sessions via `fetch("/api/chat/create-chat-session", ...)` in a `beforeEach` block. At minimum, create 2 sessions (so swipe-delete leaves 1 remaining for verification). Clean up created sessions in `afterEach`.

**Viewport configuration:** Set viewport in `test.use()` at the top of each file. Do not set it per-test — it causes flakiness:
```typescript
test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE
test.use({ viewport: { width: 768, height: 1024 } }); // iPad
```

**Touch event simulation:** Playwright's `page.touchscreen.tap()` sends real `touchstart`/`touchend` events. For swipe gestures, use `page.touchscreen.move()` sequences:
```typescript
await page.touchscreen.tap(10, 300);       // touchstart near left edge
await page.mouse.move(200, 300);           // simulate touchmove (Playwright limitation)
```
For long-press simulation (≥500ms hold), use `page.mouse.down()` with `page.waitForTimeout(600)` then `page.mouse.up()`. This fires `pointerdown`/`pointerup` events that `useLongPress` listens to. Alternatively, directly dispatch a `pointerdown` event with `page.dispatchEvent`.

**Pull-to-refresh simulation:** Simulate a downward drag from `(187, 100)` to `(187, 250)` using `page.mouse.move` sequences, as Playwright does not have a native pull gesture API.

**Hybrid/mouse-only device assertions:** Include one test variant at 375×667 that dispatches only `mousedown`/`mouseup` events (no touch events) to verify hover actions remain suppressed when `pointer: coarse` is not set. Use `page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)` to assert the media query state.

**Viewport resize for keyboard simulation:** Use `page.setViewportSize({ width: 375, height: 390 })` (reducing height by ~277px) to simulate a software keyboard appearing. Assert the chat input bar's bottom offset increases accordingly.

### Test cases

1. **Bottom nav navigation (phone viewport 375×667)**
   - Load `/app`, confirm `BottomNav` is visible.
   - Click Search tab → confirm search bar is visible and focused.
   - Click History tab → confirm conversation list renders.
   - Click Chat tab → confirm chat view is active.

2. **Keyboard elevation (phone viewport 375×667)**
   - Open a chat, tap the input bar, simulate soft keyboard (resize viewport height).
   - Assert the input bar is not obscured by the simulated keyboard height change.

3. **Sidebar drawer on tablet (768×1024)**
   - Load `/app`, confirm `BottomNav` is NOT visible.
   - Simulate swipe-right from left edge → confirm sidebar is visible.
   - Tap backdrop → confirm sidebar closes.

4. **History swipe-delete (phone viewport 375×667)**
   - Load History tab with at least one conversation.
   - Simulate swipe-left on the first item → confirm red delete button appears.
   - Click delete → confirm item is removed from the list.

5. **Long-press action sheet (phone viewport 375×667)**
   - Open a chat with at least one AI message.
   - Simulate a long-press (pointerdown held for 600ms) on the message.
   - Confirm `ActionSheet` appears with Copy / Regenerate / Edit options.

6. **Search filter chips and pull-to-refresh (phone viewport 375×667)**
   - Open Search tab → confirm filter chips row is horizontally scrollable.
   - Simulate pull-to-refresh touch gesture → confirm refresh is triggered.

---

## 5. Acceptance Criteria

- [ ] `useScreenSize` exports `isTablet` and returns `true` for widths 641–912px.
- [ ] On 375×667px viewport, `AppSidebar` is not rendered; `MobileShell` with `BottomNav` is rendered instead.
- [ ] On 768×1024px viewport, `BottomNav` is not rendered; the tablet sidebar overlay is rendered.
- [ ] Tapping all three `BottomNav` tabs switches the active panel without a full page navigation (no network request for the shell).
- [ ] Chat message area has no `max-w` constraint on mobile; side padding is 12px.
- [ ] Chat input bar rises with the software keyboard on iOS Safari and Android Chrome (verified by Playwright viewport-resize simulation).
- [ ] Long-pressing a message for ≥500ms opens `ActionSheet`; tap outside dismisses it.
- [ ] Swipe-left on a History row reveals a red delete button; tapping it deletes the conversation.
- [ ] All interactive elements on mobile have computed touch target size ≥ 44×44px (verified by Playwright `boundingBox` assertions on key buttons).
- [ ] Artifacts and Presentations open as full-screen modal overlays on mobile; no inline rendering.
- [ ] `prefers-reduced-motion: reduce` disables slide transitions in `MobileShell`.
- [ ] Safe-area padding is applied to `BottomNav` (`env(safe-area-inset-bottom)`).
- [ ] No `dark:` Tailwind modifiers appear in any new component.
- [ ] All new TypeScript files pass strict type checking with zero `any` types.
- [ ] All 6 Playwright test scenarios pass on both iPhone SE (375×667) and iPad (768×1024) viewports.

---

## 6. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `visualViewport` API is not available in all browsers / Playwright test environments | High — keyboard elevation breaks | Feature-detect `window.visualViewport`; fall back to `window.innerHeight` diff. In Playwright, simulate via viewport resize. |
| `AppSidebar` has complex state (DnD, project modals, SWR hooks) that may re-initialize when switching between mobile/desktop layouts | Medium — stale state or flicker on orientation change | `AppLayoutSwitcher` never mounts `AppSidebar` on mobile/tablet. `TabletSidebar` is a separate lightweight component with no DnD or modal state. |
| Swipe gesture conflicts with browser's native back-swipe on iOS | Medium — accidental back navigation | Only activate swipe-right gesture when `touchstart.x < 20px`; do not call `preventDefault` on the event until a horizontal swipe is confirmed (delta X > delta Y). |
| Lazy-mounted tab panels may cause scroll position loss on tab switch | Low — confusing UX | Preserve scroll position per tab in a ref map within `MobileShell`; restore on tab re-activation. |
| Existing `Hoverable.Root/Item` hover actions are shown on touch devices that also send mouse events | Low — double-trigger or misfire | Check `pointer: coarse` via a CSS media query or `window.matchMedia('(pointer: coarse)')` to disable `Hoverable` groups on touch devices. |
| Bottom sheet / ActionSheet z-index collisions with existing modals | Low — overlapping UI | Use a portal (`ReactDOM.createPortal`) into `document.body` for all sheets; assign z-index above `z-50` (design system's modal layer). |
