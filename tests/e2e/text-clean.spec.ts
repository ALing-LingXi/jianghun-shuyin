import { expect, test } from "@playwright/test";

test.describe("text clean tool", () => {
  test("uploads a dirty txt file and downloads the cleaned text", async ({
    page,
  }) => {
    await page.route("**/api/tools/text-clean", async (route) => {
      expect(route.request().method()).toBe("POST");
      await route.fulfill({
        status: 200,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "content-disposition":
            "attachment; filename=\"demo.cleaned.txt\"; filename*=UTF-8''demo.cleaned.txt",
          "x-download-file-name": "demo.cleaned.txt",
          "x-detected-encoding": "utf-8",
          "x-original-characters": "12",
          "x-cleaned-characters": "8",
          "x-removed-bom": "true",
          "x-normalized-newlines": "1",
          "x-collapsed-blank-lines": "1",
          "x-trimmed-blank-lines": "0",
        },
        body: "第一行\n第二行",
      });
    });

    await page.goto("/tools/text-clean");
    await page.locator('input[type="file"]').setInputFiles({
      name: "dirty.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("\uFEFF第一行\r\n\r\n***\r\n第二行\r\n"),
    });

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "清洗并下载" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("demo.cleaned.txt");
    await expect(page.getByText("已下载 demo.cleaned.txt")).toBeVisible();
  });
});
