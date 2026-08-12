import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";

const libraryBookId = "11111111-1111-4111-8111-111111111111";

test.describe("books and player flows", () => {
  test.setTimeout(30_000);

  test.beforeEach(() => {
    execFileSync(process.execPath, [
      path.join(
        process.cwd(),
        "tests",
        "e2e",
        "fixtures",
        "prepare-books-player-fixture.mjs",
      ),
    ]);
  });

  test("shows the library page and navigates to upload", async ({ page, request }) => {
    const libraryResponse = await request.get("/api/books");
    expect(libraryResponse.ok()).toBe(true);
    await expect(libraryResponse).toBeOK();
    expect(await libraryResponse.json()).toMatchObject({
      books: expect.arrayContaining([
        expect.objectContaining({
          id: libraryBookId,
          title: "Test Book",
          playablePartCount: 2,
        }),
      ]),
    });

    await page.goto("/books");

    await expect(page.getByRole("heading", { name: "Books" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Test Book")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("link", { name: "Upload text" })).toBeVisible();

    await page.getByRole("link", { name: "Upload text" }).click();
    await expect(page).toHaveURL(/\/upload$/);
  });

  test("shows a playable book and opens the player page", async ({ page, request }) => {
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = () => Promise.resolve();
      HTMLMediaElement.prototype.pause = () => {};
    });

    const playerResponse = await request.get(`/api/player/books/${libraryBookId}`);
    await expect(playerResponse).toBeOK();
    expect(await playerResponse.json()).toMatchObject({
      bookId: libraryBookId,
      parts: [
        expect.objectContaining({ title: "Chapter 1" }),
        expect.objectContaining({ title: "Chapter 2" }),
      ],
    });

    await page.goto(`/books/${libraryBookId}/player`);

    await expect(page.getByRole("heading", { name: "Audio Player" })).toBeVisible();
    await expect(page.getByTestId("audio-player")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("current-part-title")).toHaveText("Chapter 1");
    await expect(page.locator("audio")).toHaveCount(1);

    await page.getByTestId("player-toggle").click();
    await expect(page.getByTestId("player-toggle")).toContainText("Pause");
    await expect(page.getByTestId("current-part-title")).toHaveText("Chapter 1");

    await page.getByTestId("player-next").click();
    await expect(page.getByTestId("current-part-title")).toHaveText("Chapter 2");
    await expect(page.locator("audio")).toHaveCount(1);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();

    await expect(page.getByTestId("mini-player")).toBeVisible();
    await expect(page.getByTestId("mini-current-part-title")).toHaveText("Chapter 1");
    await expect(page.locator("audio")).toHaveCount(1);

    await page.getByTestId("mini-player-toggle").click();
    await expect(page.getByTestId("mini-player-toggle")).toHaveAttribute(
      "aria-label",
      "Pause",
    );
  });
});
