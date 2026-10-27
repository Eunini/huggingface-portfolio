import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";

test("real browser inference uses local model assets and gives six scores", async ({
  page,
}, testInfo) => {
  const requests = [];
  const errors = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?demo=adapterlab");
  const workerReady = page.waitForEvent("worker");
  await page.getByRole("button", { name: "Load model & classify" }).click();
  await page.waitForFunction(
    () =>
      document.querySelector("#prediction h3") ||
      /could not|couldn.t/i.test(
        document.querySelector("#model-status").textContent,
      ),
    null,
    { timeout: 120000 },
  );
  expect(await page.locator("#model-status").textContent()).not.toMatch(
    /could not|couldn.t/i,
  );
  await expect(page.locator("#prediction")).toContainText("Prediction:");
  await expect(page.locator("meter")).toHaveCount(6);
  if (testInfo.project.name === "desktop") {
    const worker = await workerReady;
    const fixtures = JSON.parse(
      await readFile(new URL("./model-fixtures.json", import.meta.url), "utf8"),
    );
    const labels = [
      "account",
      "billing",
      "cancellation",
      "delivery",
      "login",
      "technical",
    ];
    let maxError = 0;
    let agreement = 0;
    for (const fixture of fixtures) {
      const result = await worker.evaluate(async (text) => {
        const original = self.postMessage;
        let response;
        self.postMessage = (data) => {
          response = data;
        };
        try {
          await self.onmessage({ data: { id: 999, text } });
          return response;
        } finally {
          self.postMessage = original;
        }
      }, fixture.text);
      expect(result.type).toBe("result");
      const expectedLabel =
        labels[fixture.scores.indexOf(Math.max(...fixture.scores))];
      if (result.scores[0].label === expectedLabel) agreement += 1;
      for (const row of result.scores)
        maxError = Math.max(
          maxError,
          Math.abs(row.score - fixture.scores[labels.indexOf(row.label)]),
        );
    }
    expect(agreement).toBe(fixtures.length);
    expect(maxError).toBeLessThan(0.0001);
    await writeFile(
      "../evidence/browser-parity.json",
      JSON.stringify(
        {
          measured_at: new Date().toISOString(),
          samples: fixtures.length,
          prediction_agreement: agreement / fixtures.length,
          max_absolute_softmax_error: maxError,
          scope: "Chromium WASM tokenizer + ONNX vs Python tokenizer + ONNX",
        },
        null,
        2,
      ),
    );
  }
  await expect(page.locator("#model-status")).toContainText(
    "model load excluded",
  );
  const values = await page
    .locator("meter")
    .evaluateAll((elements) => elements.map((element) => element.value));
  expect(values.every((value) => value >= 0 && value <= 1)).toBeTruthy();
  expect(values.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 4);
  const origin = new URL(page.url()).origin;
  expect(
    requests.filter(
      (url) => /^https?:/.test(url) && new URL(url).origin !== origin,
    ),
  ).toEqual([]);
  expect(errors).toEqual([]);
  await page
    .getByRole("button", { name: "Technical issue", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Classify request", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Classify request", exact: true }),
  ).toBeEnabled();
  await expect(page.locator("meter")).toHaveCount(6);
  await mkdir("../evidence/screenshots", { recursive: true });
  await page.screenshot({
    path: `../evidence/screenshots/adapterlab-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("hotel holds cannot confirm without an exact verified payment", async ({
  page,
}, testInfo) => {
  await page.goto("/?demo=hotel");
  await page.getByRole("button", { name: "1. Search rooms" }).click();
  await page.getByRole("button", { name: "2. Hold quoted room" }).click();
  await expect(page.locator("#workflow-state")).toHaveText("held");
  await page
    .getByRole("button", { name: "3. Prepare fictional payment link" })
    .click();
  await expect(page.locator("#latest-response")).toContainText(
    "must explicitly choose and consent",
  );
  await page.getByLabel("Guest agrees to this channel").check();
  await page
    .getByRole("button", { name: "3. Prepare fictional payment link" })
    .click();
  await expect(page.locator("#latest-response")).toContainText("No SMS");
  await page.getByText("Inject a failure", { exact: true }).click();
  await page.getByRole("button", { name: "Send mismatched amount" }).click();
  await expect(page.locator("#workflow-state")).toHaveText("held");
  await page.getByRole("button", { name: "Send unverified event" }).click();
  await expect(page.locator("#workflow-state")).toHaveText("held");
  await page
    .getByRole("button", { name: "4. Simulate exact verified payment" })
    .click();
  await expect(page.locator("#workflow-state")).toHaveText("confirmed");
  await page.locator("#scenario").selectOption("hotel-last-room");
  await page.getByRole("button", { name: "Replay scenario" }).click();
  await expect(page.locator("#latest-response")).toContainText(
    "No second hold",
  );
  await expect(
    page.getByLabel("Guest agrees to this channel"),
  ).not.toBeChecked();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export JSON" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("workflow-trace.json");
  await page.screenshot({
    path: `../evidence/screenshots/hotel-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("SDR opt-out and stale audio boundaries can be replayed", async ({
  page,
}, testInfo) => {
  await page.goto("/?demo=sdr");
  await page.getByRole("button", { name: "Allow the conversation" }).click();
  await page
    .getByRole("button", { name: "Check a fictional meeting time" })
    .click();
  await page
    .getByRole("button", { name: "Explicitly confirm the meeting" })
    .click();
  await expect(page.locator("#workflow-state")).toHaveText("booked");
  await page
    .getByRole("button", { name: "Opt out & end conversation" })
    .click();
  await page
    .getByRole("button", { name: "Consent to a fictional SMS" })
    .click();
  await expect(page.locator("#latest-response")).toContainText(
    "Further outreach is blocked",
  );
  await page.locator("#scenario").selectOption("sdr-bargein");
  await page.getByRole("button", { name: "Replay scenario" }).click();
  await expect(page.locator("#latest-response")).toContainText("Late audio");
  await expect(page.locator("#trace")).toContainText("playback_cancelled");
  await page.screenshot({
    path: `../evidence/screenshots/sdr-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

for (const kind of ["adapterlab", "hotel", "sdr"]) {
  test(`${kind}: keyboard access, themes, accessibility and responsive layout`, async ({
    page,
  }) => {
    await page.goto(`/?demo=${kind}`);
    const errors = await new AxeBuilder({ page }).analyze();
    expect(errors.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.getByRole("button", { name: "Switch theme" }).click();
    const darkErrors = await new AxeBuilder({ page }).analyze();
    expect(darkErrors.violations).toEqual([]);
    await page.reload();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to demo" }),
    ).toBeFocused();
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  });
}
