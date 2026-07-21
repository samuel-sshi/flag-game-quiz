import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('host finalizes Elo when the final scoreboard arrives from another player', async () => {
  const app = await readFile('app.js', 'utf8');
  expect(app).toMatch(/async function handleScoreboard\(payload\)[\s\S]*Object\.values\(state\.scoreboard\)\.every\(\(item\) => item\.finished\)[\s\S]*await finalizeRating\(\)/);
});
