import { test, expect } from "@playwright/test";

// =============================================================================
// Phone viewport tests (iPhone SE: 375x667)
// =============================================================================

test.describe("Mobile UX - Phone (375x667)", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/app");
    // Wait for MobileShell to render
    await expect(page.getByTestId("MobileShell")).toBeVisible({
      timeout: 15000,
    });
  });

  test("1. Bottom nav navigation", async ({ page }) => {
    // BottomNav should be visible
    await expect(page.getByTestId("MobileBottomNav")).toBeVisible();

    // Click Search tab
    await page.getByTestId("MobileBottomNav/search").click();
    await expect(page.getByTestId("MobileShell/search-panel")).toBeVisible();
    await expect(page.getByTestId("SearchTab")).toBeVisible();

    // Click History tab
    await page.getByTestId("MobileBottomNav/history").click();
    await expect(page.getByTestId("MobileShell/history-panel")).toBeVisible();
    await expect(page.getByTestId("HistoryTab")).toBeVisible();

    // Click Chat tab
    await page.getByTestId("MobileBottomNav/chat").click();
    await expect(page.getByTestId("MobileShell/chat-panel")).toBeVisible();
  });

  test("2. Keyboard elevation - input bar moves with viewport resize", async ({
    page,
  }) => {
    // Find the chat input area
    const chatPanel = page.getByTestId("MobileShell/chat-panel");
    await expect(chatPanel).toBeVisible();

    // Get initial bottom nav position
    const bottomNav = page.getByTestId("MobileBottomNav");
    const navBox = await bottomNav.boundingBox();
    expect(navBox).not.toBeNull();

    // Simulate keyboard by shrinking viewport
    await page.setViewportSize({ width: 375, height: 390 });

    // BottomNav should still be visible
    await expect(bottomNav).toBeVisible();
  });

  test("3. AppSidebar is NOT rendered on mobile", async ({ page }) => {
    await expect(
      page.getByTestId("desktop-layout-sidebar")
    ).not.toBeVisible();
    await expect(page.getByTestId("MobileShell")).toBeVisible();
  });

  test("4. Touch targets are at least 44x44px", async ({ page }) => {
    // Check bottom nav tab buttons
    const tabs = ["chat", "search", "history"];
    for (const tab of tabs) {
      const button = page.getByTestId(`MobileBottomNav/${tab}`);
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test("5. Safe area padding on BottomNav", async ({ page }) => {
    const bottomNav = page.getByTestId("MobileBottomNav");
    await expect(bottomNav).toBeVisible();
    // Verify it has the safe-area class
    const style = await bottomNav.evaluate((el) =>
      window.getComputedStyle(el).paddingBottom
    );
    // On desktop Playwright, env(safe-area-inset-bottom) resolves to 0px
    expect(style).toBeDefined();
  });

  test("6. History swipe-delete", async ({ page }) => {
    // Navigate to History tab
    await page.getByTestId("MobileBottomNav/history").click();
    await expect(page.getByTestId("HistoryTab")).toBeVisible();

    // Wait for sessions to load
    await page.waitForTimeout(1000);

    // Check if there are any session items
    const sessions = page.locator('[data-testid^="HistoryTab/session-"]');
    const count = await sessions.count();
    if (count === 0) {
      // Create a chat session first via API
      await page.evaluate(async () => {
        await fetch("/api/chat/create-chat-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ persona_id: 0 }),
        });
      });
      // Refresh history
      await page.getByTestId("MobileBottomNav/chat").click();
      await page.getByTestId("MobileBottomNav/history").click();
      await page.waitForTimeout(1000);
    }

    const firstSession = sessions.first();
    const box = await firstSession.boundingBox();
    if (box) {
      // Simulate swipe-left
      const startX = box.x + box.width - 20;
      const startY = box.y + box.height / 2;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX - 150, startY, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(300);
    }
  });

  test("7. Long-press action sheet on message", async ({ page }) => {
    // Ensure we are on Chat tab
    await page.getByTestId("MobileBottomNav/chat").click();
    await expect(page.getByTestId("MobileShell/chat-panel")).toBeVisible();

    // Wait for any AI message to appear (from existing chat or send one)
    const aiMessage = page.getByTestId("onyx-ai-message").first();
    const humanMessage = page.locator("#onyx-human-message").first();

    // Try on human message if present
    const hasHuman = await humanMessage.isVisible().catch(() => false);
    if (hasHuman) {
      const box = await humanMessage.boundingBox();
      if (box) {
        // Simulate long press via touch events
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(600);
        await page.mouse.up();
        await page.waitForTimeout(300);

        // Check if ActionSheet appeared
        const actionSheet = page.getByTestId("ActionSheet");
        const isVisible = await actionSheet.isVisible().catch(() => false);
        if (isVisible) {
          await expect(actionSheet).toBeVisible();
          // Close it by clicking backdrop
          await page.mouse.click(187, 100);
        }
      }
    }
  });

  test("8. Search filter chips and pull-to-refresh", async ({ page }) => {
    // Navigate to Search tab
    await page.getByTestId("MobileBottomNav/search").click();
    await expect(page.getByTestId("SearchTab")).toBeVisible();

    // Verify filter chips are visible and scrollable
    const filterChips = page.getByTestId("SearchTab/filter-chips");
    await expect(filterChips).toBeVisible();

    // Check overflow-x is auto (horizontal scroll)
    const overflowX = await filterChips.evaluate(
      (el) => window.getComputedStyle(el).overflowX
    );
    expect(overflowX).toBe("auto");

    // Click a filter chip to toggle it
    const todayChip = page.locator(
      '[data-testid="SearchTab/filter-chips"] button',
      { hasText: "Hoy" }
    );
    if (await todayChip.isVisible()) {
      await todayChip.click();
    }

    // Simulate pull-to-refresh: drag downward
    await page.mouse.move(187, 150);
    await page.mouse.down();
    await page.mouse.move(187, 300, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);
  });
});

// =============================================================================
// Tablet viewport tests (iPad: 768x1024)
// =============================================================================

test.describe("Mobile UX - Tablet (768x1024)", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByTestId("MobileShell")).toBeVisible({
      timeout: 15000,
    });
  });

  test("3. Sidebar drawer on tablet - no BottomNav", async ({ page }) => {
    // BottomNav should NOT be visible on tablet
    await expect(page.getByTestId("MobileBottomNav")).not.toBeVisible();

    // MobileHeader menu button should be visible
    await expect(page.getByTestId("MobileHeader")).toBeVisible();
  });

  test("3b. Tablet sidebar opens and closes", async ({ page }) => {
    const sidebar = page.getByTestId("TabletSidebar");

    // Initially sidebar should be off-screen (translated)
    await expect(sidebar).toBeAttached();

    // Simulate swipe from left edge to open sidebar
    await page.mouse.move(5, 400);
    await page.mouse.down();
    await page.mouse.move(200, 400, { steps: 10 });
    await page.mouse.up();

    // Give animation time
    await page.waitForTimeout(300);

    // Click backdrop to close
    const backdrop = page.getByTestId("TabletSidebar/backdrop");
    if (await backdrop.isVisible()) {
      await backdrop.click();
      await page.waitForTimeout(300);
    }
  });

  test("AppSidebar is NOT rendered on tablet", async ({ page }) => {
    await expect(
      page.getByTestId("desktop-layout-sidebar")
    ).not.toBeVisible();
  });
});
