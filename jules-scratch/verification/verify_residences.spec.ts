import { test, expect } from '@playwright/test';

test('should display residences on the Find My Res page', async ({ page }) => {
  await page.goto('http://localhost:4173/find-my-res');

  // Wait for the residences to load
  await page.waitForSelector('.grid.md\\:grid-cols-2.lg\\:grid-cols-3');

  // Take a screenshot of the residences grid
  await page.screenshot({ path: 'jules-scratch/verification/residences.png' });
});
