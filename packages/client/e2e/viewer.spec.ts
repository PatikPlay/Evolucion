import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });

async function open(page: Page, query: string): Promise<void> {
  await page.goto(`/?${query}&hideui=1`);
  await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 180_000 });
  await page.waitForTimeout(1500);
}

async function means(page: Page): Promise<number[]> {
  return page.evaluate(() =>
    (window as unknown as { __linaje: { visualMeans(): number[] } }).__linaje.visualMeans(),
  );
}

async function focus(page: Page, zoom = 4): Promise<void> {
  await page.evaluate(
    (z) =>
      (
        window as unknown as { __linaje: { focusPopulation(z: number): void } }
      ).__linaje.focusPopulation(z),
    zoom,
  );
  await page.waitForTimeout(800);
}

test('three seeds give clearly different-looking populations', async ({ page }) => {
  const seeds = ['alba', 'bruma', 'cierzo'];
  const profiles: number[][] = [];
  for (const seed of seeds) {
    await open(page, `seed=${seed}&years=2`);
    await page.screenshot({ path: `${OUT}/seed-${seed}-parcel.png` });
    await focus(page, 5);
    await page.screenshot({ path: `${OUT}/seed-${seed}-population.png` });
    profiles.push(await means(page));
  }
  // Different founders: every pair differs by at least 1.5 levels on average over the visual parameters.
  for (let a = 0; a < profiles.length; a++) {
    for (let b = a + 1; b < profiles.length; b++) {
      const pa = profiles[a] as number[];
      const pb = profiles[b] as number[];
      const diff = pa.reduce((s, v, k) => s + Math.abs(v - (pb[k] as number)), 0) / pa.length;
      expect(diff).toBeGreaterThan(1.5);
    }
  }
});

test('after 30 generations of cold, the population looks different', async ({ page }) => {
  await open(page, 'seed=helada&years=0&scenario=cold');
  await focus(page, 5);
  await page.screenshot({ path: `${OUT}/cold-before.png` });
  const before = await means(page);
  await open(page, 'seed=helada&years=32&scenario=cold');
  await focus(page, 5);
  await page.screenshot({ path: `${OUT}/cold-after.png` });
  const after = await means(page);
  const furIndex = 11;
  const sizeIndex = 0;
  console.log(
    `fur ${before[furIndex]?.toFixed(2)} → ${after[furIndex]?.toFixed(2)}, size ${before[sizeIndex]?.toFixed(2)} → ${after[sizeIndex]?.toFixed(2)}`,
  );
  // A visible coat or body change of at least two quantisation levels.
  const change = Math.max(
    Math.abs((after[furIndex] as number) - (before[furIndex] as number)),
    Math.abs((after[sizeIndex] as number) - (before[sizeIndex] as number)),
  );
  expect(change).toBeGreaterThanOrEqual(2);
});

test('client benchmark with 2000 creatures', async ({ page }) => {
  await page.goto('/?bench=2000');
  await page.waitForFunction(() => document.body.dataset.fps, null, { timeout: 60_000 });
  const fps = Number(await page.evaluate(() => document.body.dataset.fps));
  console.log(
    `2000 creatures: ${fps.toFixed(1)} fps (software rendering in CI; target 60 fps on a mid-range GPU)`,
  );
  await page.screenshot({ path: `${OUT}/bench-2000.png` });
  expect(fps).toBeGreaterThan(5);
});
