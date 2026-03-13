import { test, expect } from '@playwright/test';

test.describe('UI Navigation & Step Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('app loads with header and title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Archithon');
    await expect(page.locator('text=AI 이사 도우미')).toBeVisible();
  });

  test('step 1 is visible by default', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '공간 스캔', exact: true })).toBeVisible();
  });

  test('demo mode toggle exists and is clickable', async ({ page }) => {
    const demoButton = page.locator('button', { hasText: '데모 모드' });
    await expect(demoButton).toBeVisible();
    await demoButton.click();
    await expect(page.locator('text=데모 모드 ON')).toBeVisible();
  });

  test('enabling demo mode shows sample floorplan button', async ({ page }) => {
    // Enable demo mode
    await page.locator('button', { hasText: '데모 모드' }).click();
    // Should show demo-specific button
    await expect(page.locator('text=샘플 평면도 불러오기')).toBeVisible();
  });
});
