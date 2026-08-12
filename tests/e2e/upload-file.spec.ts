import { expect, test } from "@playwright/test";

test.describe("TXT upload", () => {
  test("uploads a TXT file and opens its queued job without running TTS", async ({ page }) => {
    const jobId = "11111111-1111-4111-8111-111111111111";
    await page.route("**/api/uploads/file", async (route) => {
      expect(route.request().method()).toBe("POST");
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          bookId: "22222222-2222-4222-8222-222222222222",
          jobId,
        }),
      });
    });
    await page.route(`**/api/jobs/${jobId}`, async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          id: jobId,
          bookId: "22222222-2222-4222-8222-222222222222",
          voice: "zh-CN-YunxiNeural",
          rate: "+0%",
          pitch: "+0Hz",
          status: "queued",
          stage: "decoding",
          progress: 0,
          errorMessage: null,
          createdAt: "2026-08-12T00:00:00.000Z",
          updatedAt: "2026-08-12T00:00:00.000Z",
        }),
      });
    });

    await page.goto("/upload");

    await page.getByRole("button", { name: "选择 TXT" }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: "测试小说.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        ["第一章 开始", "", "这是第一章正文。", "", "第二章 继续", "", "这是第二章正文。"].join(
          "\n",
        ),
      ),
    });

    await expect(page.getByLabel("书名")).toHaveValue("测试小说");
    await page.getByRole("button", { name: "上传并开始生成" }).click();

    await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]{36}$/i);
    await expect(page.getByText("queued")).toBeVisible();
  });
});
