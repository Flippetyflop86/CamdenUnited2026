import { test, expect } from '@playwright/test';

// ==========================================
// CONFIGURATION: Enter your test account details here
// ==========================================
const TEST_EMAIL = 'flippetyflopuk@gmail.com'; 
const TEST_PASSWORD = 'YourActualPasswordHere'; // Replace this with your actual password!
// ==========================================

test('Smoke Test - User Login and Sidebar Navigation', async ({ page }) => {
  console.log(`Starting login test with email: ${TEST_EMAIL}`);

  // 1. Visit login page
  await page.goto('/login');
  await expect(page).toHaveURL(/.*login/);

  // 2. Fill in credentials and submit
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  
  // Click the submit button
  const submitButton = page.locator('button[type="submit"]').first();
  await submitButton.click();

  // 3. Wait for redirect to dashboard
  console.log('Waiting for login redirect...');
  await page.waitForURL(/.*dashboard/, { timeout: 10000 });
  console.log('Successfully logged in and reached the dashboard!');

  // 4. Navigate through all sidebar tabs
  const tabs = [
    { label: 'Squad', href: '/squad' },
    { label: 'Training', href: '/training' },
    { label: 'Fixtures', href: '/matches' },
    { label: 'Matchday XI', href: '/matchday-xi' },
    { label: 'Match Analysis', href: '/analysis' },
    { label: 'Opposition Reports', href: '/opposition' },
    { label: 'League Table', href: '/league' },
    { label: 'Stats', href: '/stats' },
    { label: 'Sponsorships', href: '/sponsors' },
    { label: 'Recruitment', href: '/recruitment' },
    { label: 'Finance', href: '/finance' },
    { label: 'Player Budgets', href: '/budgets' },
    { label: 'Inventory', href: '/inventory' },
    { label: 'Staff', href: '/staff' },
    { label: 'Documents', href: '/documents' },
    { label: 'Admin', href: '/admin' }
  ];

  console.log('Beginning sidebar navigation checks...');

  for (const tab of tabs) {
    console.log(`Clicking on tab: ${tab.label}`);
    
    // Click the sidebar link
    const link = page.locator(`nav a[href="${tab.href}"]`).first();
    if (await link.count() > 0) {
      await link.click();
    } else {
      // Fallback: direct goto if sidebar is collapsed/hidden
      await page.goto(tab.href);
    }

    // Wait 1 second to let it render and make it visible to watch
    await page.waitForTimeout(1000);

    // Verify page content doesn't have 500 errors
    const pageText = await page.textContent('body');
    expect(pageText).not.toContain('Internal Server Error');
    expect(pageText).not.toContain('500');

    // Confirm upgrade/paywall modal is NOT open (since we unlocked everything)
    const modalTitle = page.locator('text=Feature Locked During Trial');
    await expect(modalTitle).toHaveCount(0);
  }

  console.log('🎉 Smoke test completed successfully! All pages loaded without errors.');
});
