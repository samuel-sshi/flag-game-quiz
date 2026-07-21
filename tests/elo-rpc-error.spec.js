import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('rating failure exposes the Supabase error message for diagnosis', async () => {
  const app = await readFile('app.js', 'utf8');
  expect(app).toContain("Elo could not be applied: ${error.message}");
});
