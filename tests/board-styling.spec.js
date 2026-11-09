import { test, expect } from '@playwright/test';

async function expectReadable(labels) {
  const contrasts = await labels.evaluateAll(elements => {
    const channelsOf = rgb => rgb.match(/[\d.]+/g).map(Number);
    const luminance = channels => {
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
      const [r, g, b, alpha = 1] = channelsOf(transparent && cellStyle.backgroundImage === 'none'
        ? cellStyle.backgroundColor
        : backgroundColor);
      // White is the brightest possible photo behind a white label.
      const surface = [r, g, b].map(channel => channel * alpha + 255 * (1 - alpha));
      const values = [luminance(channelsOf(color)), luminance(surface)];
      return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
    });
  });
  expect(contrasts.length).toBeGreaterThan(0);
  for (const contrast of contrasts) expect(contrast).toBeGreaterThanOrEqual(4.5);
}

test('default board labels stay readable through photo, bingo and reset', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new Error('Camera unavailable in upload test'); };
  });
  await page.goto('/play');
  const cells = page.locator('.bingo-cell');
  const labels = cells.locator('.cell-number, .cell-text');
  await expect(cells).toHaveCount(25);
  await expect(cells.nth(12)).toHaveAttribute('aria-pressed', 'true');
  // Long prompts must not make some rows taller than others.
  expect(await cells.evaluateAll(items =>
    new Set(items.map(cell => Math.round(cell.getBoundingClientRect().height))).size)).toBe(1);
  await expectReadable(labels);

  await page.waitForFunction(() => window.bingoApp?.sessionId);
  for (const [index, color] of ['#fff', '#111'].entries()) {
    const data = await page.evaluate(color => {
      const photo = document.createElement('canvas');
      photo.width = photo.height = 10;
      const context = photo.getContext('2d');
      context.fillStyle = color;
      context.fillRect(0, 0, 10, 10);
      return photo.toDataURL().split(',')[1];
    }, color);
    await cells.nth(index).click();
    await page.locator('#cameraFileInput').setInputFiles({
      name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64'),
    });
    await expect(cells.nth(index)).toHaveClass(/has-image/);
  }
  await page.reload();
  const photoLabels = page.locator('.bingo-cell.has-image :is(.cell-number, .cell-text)');
  await expect(photoLabels).toHaveCount(4);
  for (const label of await photoLabels.all()) {
    await expect(label).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(label).toHaveCSS('background-color', /rgba\(0, 0, 0, 0\.\d+\)/);
  }
  await page.evaluate(() => {
    for (let index = 2; index < 5; index++) window.bingoApp.bingoGrid.setCellCompleted(index);
  });
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
  for (const path of ['/', '/play', '/new.html']) {
    await page.goto(path);
    const footer = page.getByRole('contentinfo', { name: 'String and contributor credits' });
    await expect(footer).toBeVisible();
    await expect(footer).toHaveCSS('background-color', 'rgb(51, 55, 59)');
    await expect(footer).toContainText('Inspired by Seng Kwang (Physics educator @ TJC), supported by string.sg');
    await expect(footer.getByRole('link', { name: 'Seng Kwang (Physics educator @ TJC)' })).toHaveAttribute('href', 'https://id.string.sg/u/sengkwang');
    await expect(footer).not.toContainText('String Team');
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
