import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs/promises';

const fixture = 'http://127.0.0.1:54329';
const clientId = '33333333-3333-4333-8333-333333333333';
const token = '55555555-5555-4555-8555-555555555555';

async function capture(page: Page, name: string, info: TestInfo) {
  await expect(page.locator('body')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  if (process.env.CAPTURE_UI !== '1') return;
  const directory = `docs/UI/${name}`;
  await fs.mkdir(directory, { recursive: true });
  await page.screenshot({ path: `${directory}/${info.project.name}.png`, fullPage: true, animations: 'disabled' });
  // DOM snapshot of the running implementation, not a design-tool export.
  // Drop executable scripts, Next serialized payloads and development overlays.
  const html = await page.evaluate(() => {
    const doc = document.documentElement.cloneNode(true) as HTMLElement;
    doc.querySelectorAll('script,nextjs-portal').forEach(node => node.remove());
    doc.querySelectorAll('input').forEach(node => node.removeAttribute('value'));
    return '<!DOCTYPE html>\n<!-- Runtime DOM snapshot; local test fixtures; not Google Stitch. Styles reference the local Next build. -->\n' + doc.outerHTML;
  });
  await fs.writeFile(`${directory}/${info.project.name}.html`, html);
}
async function login(page: Page, next = '/dashboard') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('E-mail', { exact: true }).fill('manager@example.test');
  await page.getByLabel('Palavra-passe', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replaceAll('/', '\\/')}$`));
}
test.beforeEach(async ({ page, request }) => {
  await request.post(`${fixture}/__test/reset`, { data: {} });
  await page.route('**/*', route => {
    const host = new URL(route.request().url()).hostname;
    return host === '127.0.0.1' || host === 'localhost' ? route.continue() : route.abort();
  });
});

test('Public navigation, email confirmation and login errors', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await capture(page, 'landing', info);
  const anchors = await page.locator('a[href^="#"], a[href^="/#"]').evaluateAll(nodes => nodes.map(n => n.getAttribute('href')!.split('#')[1]));
  for (const anchor of anchors) await expect(page.locator(`[id="${anchor}"]`)).toHaveCount(1);
  await expect(page.locator('a[href*="demo-abc"],a[href*="rpt-atelier"]')).toHaveCount(0);
  await page.goto('/register');
  await capture(page, 'register', info);
  await page.getByLabel('Nome Completo').fill('Test Manager');
  await page.getByLabel('E-mail', { exact: true }).fill('manager@example.test');
  await page.getByLabel('Palavra-passe (mínimo 6 caracteres)').fill('fixture-password');
  await page.getByRole('button', { name: 'Criar conta e iniciar onboarding' }).click();
  await expect(page.getByRole('status')).toContainText('Confirma o endereço');
  await expect(page).toHaveURL(/\/register$/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=/);
  await capture(page, 'login', info);
  await page.getByLabel('E-mail', { exact: true }).fill('manager@example.test');
  await page.getByLabel('Palavra-passe', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByText('Credenciais inválidas.', { exact: false })).toBeVisible();
  await login(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('Onboarding through report approval and public portal using local substitutes', async ({ page, request }, info) => {
  await login(page, '/onboarding');
  await capture(page, 'onboarding', info);
  await page.getByPlaceholder('Fala com o PulseBot').fill('Ligar conta de teste');
  await page.getByPlaceholder('Fala com o PulseBot').press('Enter');
  await page.getByRole('button', { name: /Fixture Project/ }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByLabel('Tarefas Bloqueadas', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('Nome do Cliente / Empresa').fill('Test Client');
  await page.getByLabel('E-mail do Cliente').fill('client@example.test');
  await page.getByRole('button', { name: 'Gerar Primeiro Relatório' }).click();
  await expect(page.getByText('Configuração concluída com sucesso!')).toBeVisible();
  await page.getByRole('link', { name: 'Rever rascunho gerado' }).click();
  await expect(page.getByRole('button', { name: 'Aprovar e enviar', exact: true })).toBeVisible();
  await capture(page, 'report-review', info);
  await page.getByRole('button', { name: 'Aprovar e enviar', exact: true }).click();
  await expect.poll(async () => (await (await request.get(`${fixture}/__test/state`)).json()).tables.reports[0]?.status).toBe('sent');
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await capture(page, 'dashboard', info);
  if (info.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Abrir menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Navegação do dashboard (móvel)' })).toBeVisible();
    await page.getByRole('button', { name: 'Fechar menu' }).click();
  }
  await page.goto(`/dashboard/clients/${clientId}`);
  await expect(page.getByRole('button', { name: 'Gerar relatório agora' })).toBeVisible();
  await capture(page, 'client-detail', info);
  await page.context().clearCookies();
  await page.goto(`/portal/${token}`);
  await expect(page.getByRole('heading', { name: 'Relatório Semanal de Progresso' })).toBeVisible();
  await expect(page.getByText('Entrega de teste concluída')).toBeVisible();
  await expect(page.getByText('Todos os dados e nomes apresentados')).toHaveCount(0);
  await capture(page, 'client-portal', info);
});

test('Column lookup failure blocks onboarding instead of silently advancing', async ({ page, request }) => {
  await request.post(`${fixture}/__test/reset`, { data: { connected: true, columnsFail: true } });
  await login(page, '/onboarding');
  await expect(page.getByRole('alert')).toContainText('Simulated column lookup failure');
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeDisabled();
});

test('Invalid, expired and revoked portal links do not show reports', async ({ page, request }) => {
  await request.post(`${fixture}/__test/reset`, { data: { seed: true } });
  for (const [link, text] of [
    ['66666666-6666-4666-8666-666666666666', 'Este link de acesso expirou'],
    ['77777777-7777-4777-8777-777777777777', 'Este link de acesso foi revogado'],
  ]) {
    await page.goto(`/portal/${link}`);
    await expect(page.getByRole('heading', { name: text })).toBeVisible();
    await expect(page.getByText('Entrega de teste concluída')).toHaveCount(0);
  }
  await page.goto('/portal/not-a-token');
  await expect(page.getByText('Entrega de teste concluída')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
