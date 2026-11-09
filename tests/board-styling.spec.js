import { test, expect } from '@playwright/test';

async function expectReadable(labels) {
  const contrasts = await labels.evaluateAll(elements => {
    const luminance = rgb => {
      const channels = rgb.match(/[\d.]+/g).map(Number);
      if (channels.length !== 3) return NaN;
      const [r, g, b] = channels.map(channel => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    return elements.map(el => {
      const { color, backgroundColor } = getComputedStyle(el);
      const cellStyle = getComputedStyle(el.closest('.bingo-cell'));
      const transparent = backgroundColor === 'rgba(0, 0, 0, 0)';
      const surface = transparent && cellStyle.backgroundImage === 'none'
        ? cellStyle.backgroundColor
        : backgroundColor;
      const values = [luminance(color), luminance(surface)];
      return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
    });
  });
  expect(contrasts.length).toBeGreaterThan(0);
  for (const contrast of contrasts) expect(contrast).toBeGreaterThanOrEqual(4.5);
}

test('default board labels stay readable through photo, bingo and reset', async ({ page }) => {
  await page.goto('/');
  const cells = page.locator('.bingo-cell');
  const labels = cells.locator('.cell-number, .cell-text');
  await expect(cells).toHaveCount(25);
  await expect(cells.nth(12)).toHaveAttribute('aria-pressed', 'true');
  await expectReadable(labels);

  await page.waitForFunction(() => window.bingoApp?.sessionId);
  await page.evaluate(() => {
    const app = window.bingoApp;
    const photo = document.createElement('canvas');
    photo.width = photo.height = 10;
    const context = photo.getContext('2d');
    context.fillRect(0, 0, 10, 10);
    app.storeCellImage(0, photo.toDataURL());
    for (let index = 0; index < 5; index++) app.bingoGrid.setCellCompleted(index);
  });
  await expect(cells.first()).toHaveClass(/has-image/);
  await expect(page.locator('.bingo-line')).toHaveCount(5);
  await expectReadable(labels);

  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(cells.first()).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.bingo-line, .has-image')).toHaveCount(0);
  await expectReadable(labels);
});

test('narrow shared board wraps long prompts and keeps keyboard focus visible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const longWord = 'Long'.repeat(30);
  await page.route('**/api/games/layout-fixture/play', route => route.fulfill({
    json: {
      name: 'Shared board', creator: { name: 'Bingo host' }, gridSize: 3,
      challengesJson: Array.from({ length: 9 }, () => ({ text: longWord })),
    },
  }));
  await page.goto('/play/layout-fixture?preview=1');
  const cells = page.locator('.bingo-cell');
  await expect(cells).toHaveCount(9);
  await expectReadable(cells.locator('.cell-number, .cell-text'));
  expect(await cells.evaluateAll(items => items.every(cell => {
    const label = cell.querySelector('.cell-text');
    const bounds = cell.getBoundingClientRect();
    return bounds.left >= 0 && bounds.right <= innerWidth &&
      label.scrollWidth <= label.clientWidth && label.scrollHeight <= label.clientHeight;
  }))).toBe(true);

  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(cells.first()).toBeFocused();
  await expect(cells.first()).toHaveCSS('outline-style', 'solid');
  await expect(cells.first()).toHaveCSS('outline-width', '2px');
});

test('the board and editor have one compact String footer with separate game controls', async ({ page }) => {
  for (const path of ['/', '/new.html']) {
    await page.goto(path);
    const footer = page.getByRole('contentinfo', { name: 'String and contributor credits' });
    await expect(footer).toBeVisible();
    await expect(footer).toHaveCSS('background-color', 'rgb(51, 55, 59)');
    await expect(footer.getByRole('link', { name: 'String Team' })).toHaveAttribute('href', 'https://for.edu.sg/str-bingo-tree');
    await expect(footer).toContainText('Inspired by Seng Kwang (Physics educator @ TJC)');
    await expect(footer.getByRole('link', { name: 'Join String' })).toHaveAttribute('href', 'https://id.string.sg/');
    await expect(footer.getByRole('button')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }

  // The editor's light page needs a full-width footer and a stable column across wizard steps.
  const editorFooter = await page.locator('.str-footer').boundingBox();
  expect(editorFooter.width).toBe(page.viewportSize().width);
  const shellWidths = await page.evaluate(() => {
    const width = () => document.querySelector('.host-shell').getBoundingClientRect().width;
    const steps = [...document.querySelectorAll('#wizard [data-step]')];
    document.getElementById('wizard').hidden = false;
    return steps.map(step => {
      steps.forEach(other => { other.hidden = other !== step; });
      return width();
    });
  });
  expect(new Set(shellWidths).size).toBe(1);
});
