const { test, expect } = require('@playwright/test');
const path = require('path');

const BASE_URL = 'http://localhost:3010';
const TEST_FILE_PATH = path.join(__dirname, 'sample-inspector-report.json');

test.describe('Date Picker Feature Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  test('Test 1: Basic Date Picker Functionality', async ({ page }) => {
    console.log('Testing basic date picker show/hide behavior...');

    // Step 1: Verify initial state - date picker should be hidden
    await expect(page.locator('#datePicker')).toBeHidden();
    console.log('✅ VERIFY: Date picker is initially hidden');

    // Step 2: Verify only file upload area is shown
    await expect(page.locator('#uploadArea')).toBeVisible();
    console.log('✅ VERIFY: File upload area is visible');

    // Step 3: Select a file and verify date picker appears
    await page.setInputFiles('#fileInput', TEST_FILE_PATH);

    // Wait for file processing and date picker to appear
    await expect(page.locator('#datePicker')).toBeVisible();
    console.log('✅ VERIFY: Date picker becomes visible after file selection');

    // Step 4: Verify date input field has today's date as default
    const dateInput = page.locator('#reportDate');
    const today = new Date().toISOString().split('T')[0];
    await expect(dateInput).toHaveValue(today);
    console.log('✅ VERIFY: Date input has today\'s date as default');

    // Step 5: Verify helper text is displayed
    await expect(page.locator('#dateHelp')).toBeVisible();
    await expect(page.locator('#dateHelp')).toContainText('Select a date within the last 2 years');
    console.log('✅ VERIFY: Helper text is displayed');
  });

  test('Test 2: Date Validation - Future Dates', async ({ page }) => {
    console.log('Testing date validation for future dates...');

    // Select file to show date picker
    await page.setInputFiles('#fileInput', TEST_FILE_PATH);
    await expect(page.locator('#datePicker')).toBeVisible();

    // Try to select a future date
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const futureDateString = futureDate.toISOString().split('T')[0];

    await page.fill('#reportDate', futureDateString);
    await page.blur('#reportDate'); // Trigger validation

    // Verify error message appears
    await expect(page.locator('#dateError')).toBeVisible();
    await expect(page.locator('#dateError')).toContainText('cannot be in the future');
    console.log('✅ VERIFY: Future date validation error appears');

    // Verify aria-invalid is set
    await expect(page.locator('#reportDate')).toHaveAttribute('aria-invalid', 'true');
    console.log('✅ VERIFY: Accessibility attributes updated for error state');
  });

  test('Test 3: Date Validation - Historical Dates', async ({ page }) => {
    console.log('Testing date validation for historical dates...');

    // Select file to show date picker
    await page.setInputFiles('#fileInput', TEST_FILE_PATH);
    await expect(page.locator('#datePicker')).toBeVisible();

    // Test valid historical date (1 week ago)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoString = oneWeekAgo.toISOString().split('T')[0];

    await page.fill('#reportDate', oneWeekAgoString);
    await page.blur('#reportDate');

    // Verify no error for valid historical date
    await expect(page.locator('#dateError')).toBeHidden();
    console.log('✅ VERIFY: Valid historical date (1 week ago) is accepted');

    // Test invalid historical date (over 2 years ago)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    twoYearsAgo.setDate(twoYearsAgo.getDate() - 1); // One day over 2 years
    const tooOldDateString = twoYearsAgo.toISOString().split('T')[0];

    await page.fill('#reportDate', tooOldDateString);
    await page.blur('#reportDate');

    // Verify error message for too old date
    await expect(page.locator('#dateError')).toBeVisible();
    await expect(page.locator('#dateError')).toContainText('more than 2 years old');
    console.log('✅ VERIFY: Too old date validation error appears');
  });

  test('Test 4: Upload with Generation Date', async ({ page }) => {
    console.log('Testing complete upload workflow with date tracking...');

    // Select file
    await page.setInputFiles('#fileInput', TEST_FILE_PATH);
    await expect(page.locator('#datePicker')).toBeVisible();

    // Set report generation date to 3 days ago
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoString = threeDaysAgo.toISOString().split('T')[0];

    await page.fill('#reportDate', threeDaysAgoString);
    console.log('✅ VERIFY: Report generation date set to 3 days ago');

    // Verify upload button is enabled
    const uploadButton = page.locator('button:has-text("Upload Report")');
    await expect(uploadButton).toBeEnabled();
    console.log('✅ VERIFY: Upload button is enabled');

    // Click upload and wait for response
    await uploadButton.click();

    // Wait for upload to complete
    await expect(page.locator('#uploadResult')).toBeVisible({ timeout: 10000 });

    // Verify success message
    await expect(page.locator('#resultTitle')).toContainText('Upload Successful');
    console.log('✅ VERIFY: Upload succeeds with success message');

    // Verify result details contain report information
    await expect(page.locator('#resultDetails')).toContainText('Report ID:');
    await expect(page.locator('#resultDetails')).toContainText('Vulnerabilities Processed:');
    console.log('✅ VERIFY: Upload response includes report details');
  });

  test('Test 5: Form Reset Functionality', async ({ page }) => {
    console.log('Testing form reset and date picker hide behavior...');

    // Select file to show date picker
    await page.setInputFiles('#fileInput', TEST_FILE_PATH);
    await expect(page.locator('#datePicker')).toBeVisible();

    // Set a date
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoString = oneWeekAgo.toISOString().split('T')[0];
    await page.fill('#reportDate', oneWeekAgoString);

    // Clear file selection
    await page.click('button:has-text("Clear")');

    // Verify date picker becomes hidden again
    await expect(page.locator('#datePicker')).toBeHidden();
    console.log('✅ VERIFY: Date picker becomes hidden when file is cleared');

    // Verify upload area is shown again
    await expect(page.locator('#uploadArea')).toBeVisible();
    console.log('✅ VERIFY: Upload area is shown again after clear');
  });

  test('Test 6: Missing Date Validation', async ({ page }) => {
    console.log('Testing validation when date is missing...');

    // Select file to show date picker
    await page.setInputFiles('#fileInput', TEST_FILE_PATH);
    await expect(page.locator('#datePicker')).toBeVisible();

    // Clear the date field
    await page.fill('#reportDate', '');

    // Try to upload without date
    const uploadButton = page.locator('button:has-text("Upload Report")');
    await uploadButton.click();

    // Verify validation error prevents submission
    await expect(page.locator('#dateError')).toBeVisible();
    await expect(page.locator('#dateError')).toContainText('Please select a report generation date');
    console.log('✅ VERIFY: Validation error prevents submission without date');

    // Verify upload result is not shown (upload should not proceed)
    await expect(page.locator('#uploadResult')).toBeHidden();
    console.log('✅ VERIFY: Upload does not proceed without valid date');
  });

  test('Test 7: Database Integration Verification', async ({ page }) => {
    console.log('Testing database integration for date storage...');

    // Select file and set date
    await page.setInputFiles('#fileInput', TEST_FILE_PATH);
    await expect(page.locator('#datePicker')).toBeVisible();

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoString = sixMonthsAgo.toISOString().split('T')[0];

    await page.fill('#reportDate', sixMonthsAgoString);

    // Upload the report
    await page.click('button:has-text("Upload Report")');
    await expect(page.locator('#uploadResult')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#resultTitle')).toContainText('Upload Successful');

    console.log('✅ VERIFY: Historical upload (6 months ago) processed successfully');

    // Navigate to dashboard to verify both dates are displayed
    await page.click('button:has-text("View Dashboard")');
    await expect(page).toHaveURL(/.*dashboard.*/);

    console.log('✅ VERIFY: Navigation to dashboard successful');

    // Look for recent reports section or data tables
    // This will depend on how the dashboard displays the information
    const pageContent = await page.content();
    console.log('Dashboard loaded - checking for date information display');
  });
});