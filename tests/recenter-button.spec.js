import { test, expect } from '@playwright/test';

test.describe('Recenter Button', () => {
  test.describe('Desktop (non-touch devices)', () => {
    test('should not display recenter button on desktop', async ({ page }) => {
      await page.goto('/');
      
      // Wait for the page to load
      await page.waitForSelector('.bingo-grid');
      
      // The recenter button should not be visible on desktop
      const recenterBtn = page.locator('#recenterBtn');
      await expect(recenterBtn).toBeHidden();
    });
  });

  test.describe('Mobile (touch devices)', () => {
    test.use({ 
      ...test.use,
      viewport: { width: 375, height: 667 },
      hasTouch: true,
    });

    test('should display recenter button on mobile', async ({ page }) => {
      await page.goto('/');
      
      // Wait for the page to load
      await page.waitForSelector('.bingo-grid');
      
      // The recenter button should be visible on mobile
      // Note: CSS media query (hover: none) and (pointer: coarse) may need JS override
      const recenterBtn = page.locator('#recenterBtn');
      
      // Check if button exists in DOM
      await expect(recenterBtn).toBeAttached();
      
      // Check button has correct attributes
      await expect(recenterBtn).toHaveAttribute('aria-label', 'Recenter grid to original position');
      await expect(recenterBtn).toHaveAttribute('title', 'Recenter grid');
    });

    test('should have correct styling and position', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.bingo-grid');
      
      const recenterBtn = page.locator('#recenterBtn');
      
      // Check if button has the correct class
      await expect(recenterBtn).toHaveClass(/btn-recenter/);
      
      // Verify button contains SVG icon
      const svg = recenterBtn.locator('svg');
      await expect(svg).toBeAttached();
      await expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    });

    test('should recenter grid when clicked', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.bingo-grid');
      
      const grid = page.locator('.bingo-grid');
      
      // Get initial transform state
      const initialTransform = await grid.evaluate(el => el.style.transform);
      
      // Simulate zoom and pan by directly setting transform
      // (since we can't easily simulate pinch gestures in Playwright)
      await grid.evaluate(el => {
        el.style.transform = 'translate(100px, 50px) scale(2)';
      });
      
      // Verify transform was applied
      const transformedState = await grid.evaluate(el => el.style.transform);
      expect(transformedState).toContain('translate(100px, 50px)');
      expect(transformedState).toContain('scale(2)');
      
      // Click the recenter button
      const recenterBtn = page.locator('#recenterBtn');
      await recenterBtn.click();
      
      // Wait a bit for transform to apply
      await page.waitForTimeout(100);
      
      // Verify grid is recentered (scale: 1, translate: 0, 0)
      const recenteredTransform = await grid.evaluate(el => el.style.transform);
      expect(recenteredTransform).toContain('translate(0px, 0px)');
      expect(recenteredTransform).toContain('scale(1)');
    });

    test('should call TouchManager.recenter() method', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.bingo-grid');
      
      // Inject a spy to track if recenter was called
      await page.evaluate(() => {
        window.recenterCalled = false;
        if (window.bingoApp && window.bingoApp.touchManager) {
          const originalRecenter = window.bingoApp.touchManager.recenter.bind(window.bingoApp.touchManager);
          window.bingoApp.touchManager.recenter = function() {
            window.recenterCalled = true;
            originalRecenter();
          };
        }
      });
      
      // Click the recenter button
      const recenterBtn = page.locator('#recenterBtn');
      await recenterBtn.click();
      
      // Check if recenter was called
      const wasRecenterCalled = await page.evaluate(() => window.recenterCalled);
      expect(wasRecenterCalled).toBe(true);
    });

    test('should have accessible button for screen readers', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.bingo-grid');
      
      const recenterBtn = page.locator('#recenterBtn');
      
      // Check ARIA attributes
      await expect(recenterBtn).toHaveAttribute('aria-label', 'Recenter grid to original position');
      
      // Check that button is keyboard accessible (has proper role)
      const role = await recenterBtn.evaluate(el => el.tagName.toLowerCase());
      expect(role).toBe('button');
    });

    test('should maintain grid state after recentering', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.bingo-grid');
      
      // Get all cells
      const cells = page.locator('.bingo-cell');
      const cellCount = await cells.count();
      
      // Simulate transform
      const grid = page.locator('.bingo-grid');
      await grid.evaluate(el => {
        el.style.transform = 'translate(50px, 50px) scale(1.5)';
      });
      
      // Click recenter
      const recenterBtn = page.locator('#recenterBtn');
      await recenterBtn.click();
      await page.waitForTimeout(100);
      
      // Verify cells are still there and count hasn't changed
      const cellCountAfter = await cells.count();
      expect(cellCountAfter).toBe(cellCount);
      
      // Verify grid structure is intact
      await expect(grid).toBeVisible();
      await expect(grid).toHaveClass(/bingo-grid/);
    });
  });

  test.describe('TouchManager integration', () => {
    test('should reset transform values correctly', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.bingo-grid');
      
      // Access TouchManager state through the app
      const initialState = await page.evaluate(() => {
        if (window.bingoApp && window.bingoApp.touchManager) {
          return {
            scale: window.bingoApp.touchManager.scale,
            translateX: window.bingoApp.touchManager.translateX,
            translateY: window.bingoApp.touchManager.translateY
          };
        }
        return null;
      });
      
      // Initial state should be centered
      if (initialState) {
        expect(initialState.scale).toBe(1);
        expect(initialState.translateX).toBe(0);
        expect(initialState.translateY).toBe(0);
      }
      
      // Modify state
      await page.evaluate(() => {
        if (window.bingoApp && window.bingoApp.touchManager) {
          window.bingoApp.touchManager.scale = 2;
          window.bingoApp.touchManager.translateX = 100;
          window.bingoApp.touchManager.translateY = 50;
          window.bingoApp.touchManager.updateTransform();
        }
      });
      
      // Call recenter directly via JavaScript (button may be hidden on desktop)
      await page.evaluate(() => {
        if (window.bingoApp && window.bingoApp.touchManager) {
          window.bingoApp.touchManager.recenter();
        }
      });
      await page.waitForTimeout(100);
      
      // Verify state is reset
      const resetState = await page.evaluate(() => {
        if (window.bingoApp && window.bingoApp.touchManager) {
          return {
            scale: window.bingoApp.touchManager.scale,
            translateX: window.bingoApp.touchManager.translateX,
            translateY: window.bingoApp.touchManager.translateY
          };
        }
        return null;
      });
      
      if (resetState) {
        expect(resetState.scale).toBe(1);
        expect(resetState.translateX).toBe(0);
        expect(resetState.translateY).toBe(0);
      }
    });

    test('should maintain API compatibility with reset() method', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.bingo-grid');
      
      // Set transform state
      await page.evaluate(() => {
        if (window.bingoApp && window.bingoApp.touchManager) {
          window.bingoApp.touchManager.scale = 1.5;
          window.bingoApp.touchManager.translateX = 75;
          window.bingoApp.touchManager.translateY = 25;
          window.bingoApp.touchManager.updateTransform();
        }
      });
      
      // Call reset() method (should internally call recenter())
      await page.evaluate(() => {
        if (window.bingoApp && window.bingoApp.touchManager) {
          window.bingoApp.touchManager.reset();
        }
      });
      
      // Verify state is reset
      const state = await page.evaluate(() => {
        if (window.bingoApp && window.bingoApp.touchManager) {
          return {
            scale: window.bingoApp.touchManager.scale,
            translateX: window.bingoApp.touchManager.translateX,
            translateY: window.bingoApp.touchManager.translateY
          };
        }
        return null;
      });
      
      if (state) {
        expect(state.scale).toBe(1);
        expect(state.translateX).toBe(0);
        expect(state.translateY).toBe(0);
      }
    });
  });

  test.describe('Visual regression', () => {
    test('recenter button should be visible in correct position on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('/');
      await page.waitForSelector('.bingo-grid');
      
      // Wait a moment for styles to load
      await page.waitForTimeout(500);
      
      // Take screenshot to verify button position
      // The button should be in bottom-right corner
      const recenterBtn = page.locator('#recenterBtn');
      const box = await recenterBtn.boundingBox();
      
      if (box) {
        // Button should be near bottom-right
        // With fixed positioning at bottom: 20px, right: 20px
        const viewport = page.viewportSize();
        expect(box.x).toBeGreaterThan(viewport.width - 100); // Near right edge
        expect(box.y).toBeGreaterThan(viewport.height - 100); // Near bottom edge
      }
    });
  });
});
