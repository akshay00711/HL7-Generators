import { expect, test } from '@playwright/test';

test.describe('HL7 AI Workbench', () => {
  test('renders the generate workflow by default', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'HL7 AI Workbench' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Generate' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Generate HL7' })).toBeVisible();
    await expect(page.getByLabel('Patient ID')).toHaveValue('P100045');
  });

  test('generates HL7, saves it with a custom name, and loads it in the validator', async ({ page }) => {
    const saveName = `E2E Lab ${Date.now()}`;

    await page.goto('/#generate-panel');
    await page.getByRole('button', { name: 'Generate', exact: true }).click();

    await expect(page.getByLabel('Generated HL7 save name')).toBeVisible();
    await page.getByLabel('Generated HL7 save name').fill(saveName);
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.getByLabel('Generated HL7 save name')).toBeHidden();
    await page.getByRole('button', { name: 'View in Validator' }).click();

    await expect(page.getByRole('heading', { name: 'HL7 Message Inspector' })).toBeVisible();
    await expect(page.getByLabel('HL7 message')).toHaveValue(/MSH\|\^~\\&/);
    await expect(page.getByLabel('Generated HL7 Dropdown')).toContainText(saveName);

    await page.getByRole('button', { name: saveName }).click();
    await page.getByRole('button', { name: 'Load to Validator' }).click();
    await expect(page.getByLabel('HL7 message')).toHaveValue(/ORU\^R01/);
  });

  test('shows friendly generator validation errors', async ({ page }) => {
    await page.goto('/#generate-panel');

    for (const field of ['Patient ID', 'First Name', 'Last Name', 'Date of Birth', 'Provider ID', 'Provider First', 'Provider Last']) {
      await page.getByLabel(field, { exact: true }).fill('');
    }

    await page.getByRole('button', { name: 'Generate', exact: true }).click();

    const error = page.getByRole('alert').filter({ hasText: 'Please fix these fields before continuing' });
    await expect(error).toBeVisible();
    await expect(error).toContainText('Patient ID is required');
    await expect(error).toContainText('Date of Birth must be 8 characters in YYYYMMDD format');
    await expect(page.getByText('string_too_short')).toHaveCount(0);
  });

  test('renders the external sources workbench controls', async ({ page }) => {
    await page.goto('/#sources-panel');

    await expect(page.getByRole('heading', { name: 'External Reference Workbench' })).toBeVisible();
    await expect(page.getByLabel('Database Reference')).toBeVisible();
    await expect(page.getByText('Website Import')).toBeVisible();
    await expect(page.getByText('MySQL Workbench Database')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible();
  });
});
