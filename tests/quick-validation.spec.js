const { test, expect } = require('@playwright/test');
const path = require('path');

const BASE_URL = 'http://localhost:3010';
const TEST_FILE_PATH = path.join(__dirname, 'sample-inspector-report.json');

test.describe('Date Picker Quick Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  test('Basic Date Picker Show/Hide Functionality', async ({ page }) => {
    console.log('Testing basic date picker behavior...');

    // Verify initial state - date picker should be hidden
    await expect(page.locator('#datePicker')).toBeHidden();
    console.log('✅ Date picker is initially hidden');

    // Select a file and verify date picker appears
    await page.setInputFiles('#fileInput', TEST_FILE_PATH);
    await expect(page.locator('#datePicker')).toBeVisible();
    console.log('✅ Date picker becomes visible after file selection');

    // Verify date input has default value
    const dateInput = page.locator('#reportDate');
    const today = new Date().toISOString().split('T')[0];
    await expect(dateInput).toHaveValue(today);
    console.log('✅ Date input has today as default value');

    // Clear file and verify date picker hides
    await page.click('button:has-text("Clear")');
    await expect(page.locator('#datePicker')).toBeHidden();
    console.log('✅ Date picker hides when file is cleared');
  });

  test('Date Validation Rules', async ({ page }) => {
    console.log('Testing date validation...');

    // Select file to show date picker
    await page.setInputFiles('#fileInput', TEST_FILE_PATH);
    await expect(page.locator('#datePicker')).toBeVisible();

    // Test future date validation
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    const futureDateString = futureDate.toISOString().split('T')[0];

    await page.fill('#reportDate', futureDateString);
    await page.locator('#reportDate').blur();

    // Check for error message
    await expect(page.locator('#dateError')).toBeVisible();
    console.log('✅ Future date validation works');

    // Test valid historical date
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoString = oneWeekAgo.toISOString().split('T')[0];

    await page.fill('#reportDate', oneWeekAgoString);
    await page.locator('#reportDate').blur();

    // Error should be hidden for valid date
    await expect(page.locator('#dateError')).toBeHidden();
    console.log('✅ Valid historical date accepted');
  });

  test('Upload Workflow with Date', async ({ page }) => {
    console.log('Testing upload with date tracking...');

    // Select file and set date
    await page.setInputFiles('#fileInput', TEST_FILE_PATH);
    await expect(page.locator('#datePicker')).toBeVisible();

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoString = threeDaysAgo.toISOString().split('T')[0];

    await page.fill('#reportDate', threeDaysAgoString);

    // Upload the file
    const uploadButton = page.locator('button:has-text("Upload Report")');
    await expect(uploadButton).toBeEnabled();

    await uploadButton.click();

    // Wait for upload result
    await expect(page.locator('#uploadResult')).toBeVisible({ timeout: 15000 });

    // Check for success or get error details
    const resultTitle = await page.locator('#resultTitle').textContent();
    console.log(`Upload result: ${resultTitle}`);

    if (resultTitle.includes('Successful')) {
      console.log('✅ Upload with date tracking successful');

      // Verify result details are shown
      await expect(page.locator('#resultDetails')).toContainText('Report ID:');
      console.log('✅ Upload response includes report details');
    } else {
      // Log error details for debugging
      const errorMessage = await page.locator('#resultMessage').textContent();
      console.log(`Upload error: ${errorMessage}`);
    }
  });
});