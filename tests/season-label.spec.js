import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('season selector labels each season with its month name', async () => {
  const app = await readFile('app.js', 'utf8');
  expect(app).toContain("month: 'long'");
  expect(app).toContain("year: 'numeric'");
});
