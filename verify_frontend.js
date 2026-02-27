
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Wait for the server to start (simple retry)
  for (let i = 0; i < 10; i++) {
    try {
      await page.goto('http://localhost:4310');
      break;
    } catch (e) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Verify the page loaded
  const title = await page.title();
  console.log('Page title:', title);

  // Check if .vault-controls has flex display (via computed style)
  const vaultControls = page.locator('.vault-controls');
  const display = await vaultControls.evaluate((el) => window.getComputedStyle(el).display);
  console.log('.vault-controls display:', display);

  // Check for ARIA labels
  const initPwd = page.locator('#initPassword');
  const initLabel = await initPwd.getAttribute('aria-label');
  console.log('#initPassword aria-label:', initLabel);

  const unlockPwd = page.locator('#unlockPassword');
  const unlockLabel = await unlockPwd.getAttribute('aria-label');
  console.log('#unlockPassword aria-label:', unlockLabel);

  // Take screenshot
  await page.screenshot({ path: 'frontend_verification.png', fullPage: true });

  await browser.close();
})();
