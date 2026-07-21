import { test, expect } from '@playwright/test';

test('soft season reset halves Elo toward zero', async ({ page }) => {
  await page.goto('/');
  await page.addScriptTag({ path: 'season.js' });

  const ratings = await page.evaluate(() => window.FlagQuizSeason.softReset([0, 1, 25, 101]));

  expect(ratings).toEqual([0, 0, 12, 50]);
});

test('season month boundaries use midnight in Asia/Jakarta', async ({ page }) => {
  await page.goto('/');
  await page.addScriptTag({ path: 'season.js' });

  const season = await page.evaluate(() => window.FlagQuizSeason.monthFor('2026-07-31T17:00:00.000Z'));

  expect(season).toEqual({ startsAt: '2026-08-01T00:00:00+07:00', endsAt: '2026-09-01T00:00:00+07:00' });
});
