import { test, expect } from '@playwright/test';

async function loadElo(page) {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Boolean(window.FlagQuizElo))).toBe(true);
}

test('equal new players gain 12 Elo for a win with K=24 and ratings do not go below zero', async ({ page }) => {
  await loadElo(page);

  const ratings = await page.evaluate(() => window.FlagQuizElo.calculate([
    { id: 'winner', elo: 0, placement: 1 },
    { id: 'loser', elo: 0, placement: 2 }
  ]));

  expect(ratings).toEqual([
    { id: 'winner', oldElo: 0, newElo: 12, change: 12 },
    { id: 'loser', oldElo: 0, newElo: 0, change: 0 }
  ]);
});

test('a two-player draw produces no Elo change', async ({ page }) => {
  await loadElo(page);

  const ratings = await page.evaluate(() => window.FlagQuizElo.calculate([
    { id: 'alice', elo: 200, placement: 1 },
    { id: 'bob', elo: 200, placement: 1 }
  ]));

  expect(ratings.map(({ change }) => change)).toEqual([0, 0]);
});

test('multiplayer Elo averages every pairwise result and does not mutate input players', async ({ page }) => {
  await loadElo(page);

  const result = await page.evaluate(() => {
    const players = [
      { id: 'alice', elo: 120, placement: 1 },
      { id: 'bob', elo: 100, placement: 2 },
      { id: 'carol', elo: 80, placement: 3 }
    ];
    return { ratings: window.FlagQuizElo.calculate(players), players };
  });

  expect(result.ratings).toEqual([
    { id: 'alice', oldElo: 120, newElo: 131, change: 11 },
    { id: 'bob', oldElo: 100, newElo: 100, change: 0 },
    { id: 'carol', oldElo: 80, newElo: 69, change: -11 }
  ]);
  expect(result.players).toEqual([
    { id: 'alice', elo: 120, placement: 1 },
    { id: 'bob', elo: 100, placement: 2 },
    { id: 'carol', elo: 80, placement: 3 }
  ]);
});

test('calculator rejects invalid or duplicate participants', async ({ page }) => {
  await loadElo(page);

  const results = await page.evaluate(() => ({
    onePlayer: window.FlagQuizElo.calculate([{ id: 'only', elo: 0, placement: 1 }]),
    duplicateId: window.FlagQuizElo.calculate([
      { id: 'same', elo: 0, placement: 1 },
      { id: 'same', elo: 0, placement: 2 }
    ])
  }));

  expect(results).toEqual({ onePlayer: [], duplicateId: [] });
});
