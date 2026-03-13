import { test, expect } from '@playwright/test';

test.describe('Demo Mode Full Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Enable demo mode
    await page.locator('button', { hasText: '데모 모드' }).click();
    await expect(page.locator('text=데모 모드 ON')).toBeVisible();
  });

  test('step 1: load demo floorplan', async ({ page }) => {
    await page.locator('button', { hasText: '샘플 평면도 불러오기' }).click();
    await expect(page.locator('button', { hasText: '다음 단계' })).toBeVisible({ timeout: 10000 });
  });

  test('step 1 → step 2: load demo furniture', async ({ page }) => {
    // Complete step 1
    await page.locator('button', { hasText: '샘플 평면도 불러오기' }).click();
    await expect(page.locator('button', { hasText: '다음 단계' })).toBeVisible({ timeout: 10000 });
    await page.locator('button', { hasText: '다음 단계' }).click();

    // Now on step 2 - use heading to avoid strict mode violation
    await expect(page.getByRole('heading', { name: '가구 스캔' })).toBeVisible();

    // Click demo furniture button
    await page.locator('button', { hasText: '샘플 가구 불러오기' }).click();

    // Wait for furniture list - "개 선택됨" text appears
    await expect(page.locator('text=개 선택됨')).toBeVisible({ timeout: 10000 });
  });

  test('step 1 → 2 → 3: auto placement', async ({ page }) => {
    // Step 1
    await page.locator('button', { hasText: '샘플 평면도 불러오기' }).click();
    await expect(page.locator('button', { hasText: '다음 단계' })).toBeVisible({ timeout: 10000 });
    await page.locator('button', { hasText: '다음 단계' }).click();

    // Step 2
    await page.locator('button', { hasText: '샘플 가구 불러오기' }).click();
    await expect(page.locator('text=개 선택됨')).toBeVisible({ timeout: 10000 });
    await page.locator('button', { hasText: '다음 단계' }).click();

    // Step 3 - AI placement
    await expect(page.getByRole('heading', { name: 'AI 배치' })).toBeVisible();

    // Click auto-place button
    await page.locator('button', { hasText: '자동 배치 시작' }).click();

    // Wait for placement to complete - "배치 완료" appears
    await expect(page.locator('text=배치 완료')).toBeVisible({ timeout: 15000 });

    // "다음 단계" button should appear after placement
    await expect(page.locator('button', { hasText: '다음 단계' })).toBeVisible();
  });

  test('full demo flow: steps 1-3 with placement result', async ({ page }) => {
    // Step 1
    await page.locator('button', { hasText: '샘플 평면도 불러오기' }).click();
    await expect(page.locator('button', { hasText: '다음 단계' })).toBeVisible({ timeout: 10000 });
    await page.locator('button', { hasText: '다음 단계' }).click();

    // Step 2
    await page.locator('button', { hasText: '샘플 가구 불러오기' }).click();
    await expect(page.locator('text=개 선택됨')).toBeVisible({ timeout: 10000 });
    await page.locator('button', { hasText: '다음 단계' }).click();

    // Step 3 - auto place
    await page.locator('button', { hasText: '자동 배치 시작' }).click();
    await expect(page.locator('text=배치 완료')).toBeVisible({ timeout: 15000 });

    // Verify placement count is shown
    await expect(page.locator('text=가구가 배치되었습니다')).toBeVisible();

    // Advance to step 4
    await page.locator('button', { hasText: '다음 단계' }).click();

    // Step 4 - 3D visualization should have a canvas (Three.js)
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 });
  });
});
