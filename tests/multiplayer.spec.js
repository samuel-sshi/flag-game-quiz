import { test, expect } from '@playwright/test';

async function openAuthenticated(page, username) {
  await page.route('**/app.js', async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const user = JSON.stringify({ id: `test-${username}`, user_metadata: { username } });
    const sessionPrelude = `(() => { const createClient = window.supabase.createClient.bind(window.supabase); window.supabase.createClient = (...args) => { const client = createClient(...args); client.auth.getSession = async () => ({ data: { session: { user: ${user} } } }); client.auth.signOut = async () => ({ error: null }); return client; }; })();\n`;
    await route.fulfill({ response, body: sessionPrelude + source });
  });
  await page.goto('/');
  await expect(page.locator('#home.active')).toBeVisible();
}

test('authenticated home offers room multiplayer only', async ({ page }) => {
  await openAuthenticated(page, 'alice');
  await expect(page.getByRole('heading', { name: /flag quiz/i })).toBeVisible();
  await expect(page.locator('#accountUsername')).toHaveText('alice');
  await expect(page.getByRole('button', { name: 'Create Room' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Join Room' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^play$/i })).toHaveCount(0);
  await expect(page.getByText(/weekly leaderboard/i)).toHaveCount(0);
});

test('host creates a coded lobby', async ({ page }) => {
  await openAuthenticated(page, 'host');
  await page.getByRole('button', { name: 'Create Room' }).click();
  await expect(page.getByText('ROOM CODE')).toBeVisible();
  await expect(page.locator('#roomCodeDisplay')).toHaveText(/^[A-Z0-9]{8}$/);
  await expect(page.getByRole('button', { name: 'Start Game' })).toBeDisabled();
  await expect(page.getByText('host (Host)')).toBeVisible();
});

test('two players join one room and start the same quiz', async ({ browser }) => {
  test.setTimeout(300_000);
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await openAuthenticated(host, 'alice');
  await host.getByRole('button', { name: 'Create Room' }).click();
  await expect(host.locator('#roomCodeDisplay')).toHaveText(/^[A-Z0-9]{8}$/);
  const code = await host.locator('#roomCodeDisplay').textContent();

  await openAuthenticated(guest, 'bob');
  await guest.evaluate(async ({ roomCode }) => {
    const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const publicKey = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const spoofId = crypto.randomUUID();
    const attackerClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    const attacker = attackerClient.channel(`flag-room:${roomCode}`, { config: { presence: { key: spoofId } } });
    await new Promise((resolve) => attacker.subscribe((status) => status === 'SUBSCRIBED' && resolve()));
    await attacker.track({ clientId: spoofId, publicKey, isHost: true, status: 'lobby' });
    window.__hostSpoof = { attackerClient, attacker };
  }, { roomCode: code });
  await guest.getByLabel('Room code').fill(code);
  await guest.getByRole('button', { name: 'Join Room' }).click();

  await expect(host.locator('#playersList').getByText('bob')).toBeVisible();
  await expect(guest.locator('#playersList').getByText('alice (Host)')).toBeVisible();
  await expect(host.getByRole('button', { name: 'Start Game' })).toBeEnabled();

  await host.getByRole('button', { name: 'Start Game' }).click();
  await expect(host.locator('#quiz.active')).toBeVisible();
  await expect(guest.locator('#quiz.active')).toBeVisible();
  await expect(host.locator('#flagImage')).toHaveAttribute('src', /flagcdn\.com/);
  await expect(guest.locator('#flagImage')).toHaveAttribute('src', await host.locator('#flagImage').getAttribute('src'));
  await expect(host.locator('.option')).toHaveCount(4);
  await expect(guest.locator('.option')).toHaveCount(4);

  await guest.evaluate(async ({ roomCode }) => {
    const attacker = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    const channel = attacker.channel(`flag-room:${roomCode}`, { config: { broadcast: { self: true } } });
    await new Promise((resolve) => channel.subscribe((status) => status === 'SUBSCRIBED' && resolve()));
    await channel.send({ type: 'broadcast', event: 'player_progress', payload: { clientId: 'forged', score: 20, answered: 20, elapsed: 1, finished: true } });
    await channel.send({ type: 'broadcast', event: 'lobby_reset', payload: {} });
    await attacker.removeChannel(channel);
  }, { roomCode: code });
  await guest.waitForTimeout(500);
  await expect(host.locator('#quiz.active')).toBeVisible();
  await expect(guest.locator('#quiz.active')).toBeVisible();
  await expect(host.locator('#liveRanking')).not.toContainText('20/20');

  await host.locator('.option').first().click();
  await expect(host.locator('#quizProgress')).toHaveText('2 / 20');
  const hostRow = host.locator('#liveRanking tbody tr').filter({ hasText: 'alice' });
  const guestRow = guest.locator('#liveRanking tbody tr').filter({ hasText: 'alice' });
  await expect(hostRow).toContainText('1/20');
  await expect(guestRow).toContainText('1/20');

  for (let answered = 2; answered <= 20; answered += 1) {
    const firstOption = host.locator('.option').first();
    await expect(firstOption).toBeEnabled();
    await firstOption.click();
    if (answered < 20) {
      await expect(host.locator('#quizProgress')).toHaveText(`${answered + 1} / 20`);
      await host.waitForTimeout(50);
    }
  }
  await expect(host.locator('#results.active')).toBeVisible();
  await expect(host.locator('#finalRanking tbody tr')).toHaveCount(2);
  await expect(host.locator('#finalRanking')).toContainText('alice');
  await expect(host.locator('#finalRanking')).toContainText('bob');

  await host.getByRole('button', { name: 'Return Everyone to Lobby' }).click();
  await expect(host.locator('#lobby.active')).toBeVisible();
  await expect(guest.locator('#lobby.active')).toBeVisible();
  await expect(host.getByRole('button', { name: 'Start Game' })).toBeEnabled();

  await hostContext.close();
  await guestContext.close();
});
