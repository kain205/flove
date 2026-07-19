import { expect, test } from '@playwright/test';

test('unauthenticated visitor can open the login screen from the landing page', async ({ page }) => {
  await page.goto('/');

  const startButton = page.getByText('Bắt đầu miễn phí', { exact: true });
  await expect(startButton).toBeVisible();
  await startButton.click();

  await expect(page).toHaveURL(/\/login\/?$/);
  await expect(page.getByText('Chào mừng trở lại', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('ban@email.com')).toBeVisible();
  await expect(page.getByPlaceholder('••••••••')).toBeVisible();
});
