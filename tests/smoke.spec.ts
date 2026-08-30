import { expect, test, type Page } from '@playwright/test';

/**
 * Module labels as they appear in the navigation, in the default language.
 * The suite renders one module at a time, so opening each one is also the
 * check that its lazily-loaded chunk resolves.
 */
const MODULES = [
  'Cómo Funciona',
  'Algoritmo Base',
  'Ramas TFM',
  'Reparto Carga',
  'Tráfico MPI',
  'Matriz',
  'Escalabilidad',
  'Invarianza',
] as const;

/** Console noise that says nothing about the application being healthy. */
function isRealError(text: string): boolean {
  return !/fonts\.(googleapis|gstatic)\.com|ERR_CONNECTION|net::ERR_/.test(text);
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && isRealError(m.text())) errors.push(m.text());
  });
  return errors;
}

test('the site is up and serves prerendered content', async ({ page }) => {
  // './' rather than '/': under a base path the root is not the site.
  const response = await page.goto('./');
  expect(response?.status(), 'the site should respond').toBe(200);
  await expect(page).toHaveTitle(/ProtSpam/);

  // Prerendered markup, not an empty root: this is what a regression to
  // client-only rendering would break.
  const html = await response!.text();
  expect(html).toContain('ProtSpam HPC Suite');
  expect(html.length).toBeGreaterThan(10_000);
});

test('the island hydrates and every module opens', async ({ page }) => {
  const errors = collectErrors(page);
  // A wide viewport keeps all seven items in the navigation bar rather than
  // behind the overflow menu.
  await page.setViewportSize({ width: 1800, height: 1000 });
  await page.goto('./');

  // Hydration is observable: an un-hydrated island ignores this click.
  const nav = page.locator('header nav button:visible');
  await expect(nav.first()).toBeVisible();

  for (const label of MODULES) {
    await nav.filter({ hasText: label }).first().click();
    await expect(page.locator('main')).not.toBeEmpty();
    // The skeleton must give way to the real module.
    await expect(page.locator('main [role="status"]')).toHaveCount(0, { timeout: 15_000 });
  }

  expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
});

test('language and theme switch and survive a reload', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1000 });
  await page.goto('./');

  await page.locator('header button', { hasText: /^EN$/ }).first().click();
  await expect(page.locator('header nav button:visible').first()).toContainText('How It Works');

  await page.locator('header button[title]').first().click();
  await expect(page.locator('html')).toHaveClass(/light-theme/);

  await page.reload();
  // The boot script applies both before React runs, so they are already correct.
  await expect(page.locator('html')).toHaveClass(/light-theme/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('the walkthrough is the landing module and steps through a variant', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1000 });
  await page.goto('./');

  const counter = page
    .locator('main')
    .getByText(/Paso\s+\d+\s+de\s+\d+/)
    .first();
  await expect(counter).toContainText('Paso 0');

  await page.locator('main').getByRole('button', { name: 'Siguiente' }).first().click();
  await expect(counter).toContainText('Paso 1');

  // Switching variant restarts the walkthrough at step 0 with its own length.
  await page.locator('main').getByRole('tab', { name: /isend/ }).first().click();
  await expect(counter).toContainText('Paso 0');
});

test('the base simulator advances a step', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1000 });
  await page.goto('./');

  // The landing module is the walkthrough now, so the base simulator has to be
  // opened first.
  await page
    .locator('header nav button:visible')
    .filter({ hasText: 'Algoritmo Base' })
    .first()
    .click();

  const counter = page
    .locator('main')
    .getByText(/Paso\s+\d+\s+de\s+\d+/)
    .first();
  await expect(counter).toContainText('Paso 0');
  await page
    .getByRole('button', { name: /Paso Siguiente/ })
    .first()
    .click();
  await expect(counter).toContainText('Paso 1');
});
