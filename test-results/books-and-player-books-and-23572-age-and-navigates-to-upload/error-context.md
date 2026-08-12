# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: books-and-player.spec.ts >> books and player flows >> shows the library page and navigates to upload
- Location: tests\e2e\books-and-player.spec.ts:22:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Test Book')
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByText('Test Book')

```

```yaml
- main:
  - paragraph: Library
  - heading "Books" [level=1]
  - link "Upload text":
    - /url: /upload
  - text: Loading library...
```

# Test source

```ts
  1  | import { execFileSync } from "node:child_process";
  2  | import path from "node:path";
  3  | import { expect, test } from "@playwright/test";
  4  | 
  5  | const libraryBookId = "11111111-1111-4111-8111-111111111111";
  6  | 
  7  | test.describe("books and player flows", () => {
  8  |   test.setTimeout(30_000);
  9  | 
  10 |   test.beforeEach(() => {
  11 |     execFileSync(process.execPath, [
  12 |       path.join(
  13 |         process.cwd(),
  14 |         "tests",
  15 |         "e2e",
  16 |         "fixtures",
  17 |         "prepare-books-player-fixture.mjs",
  18 |       ),
  19 |     ]);
  20 |   });
  21 | 
  22 |   test("shows the library page and navigates to upload", async ({ page, request }) => {
  23 |     const libraryResponse = await request.get("/api/books");
  24 |     expect(libraryResponse.ok()).toBe(true);
  25 |     await expect(libraryResponse).toBeOK();
  26 |     expect(await libraryResponse.json()).toMatchObject({
  27 |       books: expect.arrayContaining([
  28 |         expect.objectContaining({
  29 |           id: libraryBookId,
  30 |           title: "Test Book",
  31 |           playablePartCount: 2,
  32 |         }),
  33 |       ]),
  34 |     });
  35 | 
  36 |     await page.goto("/books");
  37 | 
  38 |     await expect(page.getByRole("heading", { name: "Books" })).toBeVisible({
  39 |       timeout: 15_000,
  40 |     });
> 41 |     await expect(page.getByText("Test Book")).toBeVisible({
     |                                               ^ Error: expect(locator).toBeVisible() failed
  42 |       timeout: 15_000,
  43 |     });
  44 |     await expect(page.getByRole("link", { name: "Upload text" })).toBeVisible();
  45 | 
  46 |     await page.getByRole("link", { name: "Upload text" }).click();
  47 |     await expect(page).toHaveURL(/\/upload$/);
  48 |   });
  49 | 
  50 |   test("shows a playable book and opens the player page", async ({ page, request }) => {
  51 |     await page.addInitScript(() => {
  52 |       HTMLMediaElement.prototype.play = () => Promise.resolve();
  53 |       HTMLMediaElement.prototype.pause = () => {};
  54 |     });
  55 | 
  56 |     const playerResponse = await request.get(`/api/player/books/${libraryBookId}`);
  57 |     await expect(playerResponse).toBeOK();
  58 |     expect(await playerResponse.json()).toMatchObject({
  59 |       bookId: libraryBookId,
  60 |       parts: [
  61 |         expect.objectContaining({ title: "Chapter 1" }),
  62 |         expect.objectContaining({ title: "Chapter 2" }),
  63 |       ],
  64 |     });
  65 | 
  66 |     await page.goto(`/books/${libraryBookId}/player`);
  67 | 
  68 |     await expect(page.getByRole("heading", { name: "Audio Player" })).toBeVisible();
  69 |     await expect(page.getByTestId("audio-player")).toBeVisible({
  70 |       timeout: 15_000,
  71 |     });
  72 |     await expect(page.getByTestId("current-part-title")).toHaveText("Chapter 1");
  73 |     await expect(page.locator("audio")).toHaveCount(1);
  74 | 
  75 |     await page.getByTestId("player-toggle").click();
  76 |     await expect(page.getByTestId("player-toggle")).toContainText("Pause");
  77 |     await expect(page.getByTestId("current-part-title")).toHaveText("Chapter 1");
  78 | 
  79 |     await page.getByTestId("player-next").click();
  80 |     await expect(page.getByTestId("current-part-title")).toHaveText("Chapter 2");
  81 |     await expect(page.locator("audio")).toHaveCount(1);
  82 | 
  83 |     await page.setViewportSize({ width: 390, height: 844 });
  84 |     await page.reload();
  85 | 
  86 |     await expect(page.getByTestId("mini-player")).toBeVisible();
  87 |     await expect(page.getByTestId("mini-current-part-title")).toHaveText("Chapter 1");
  88 |     await expect(page.locator("audio")).toHaveCount(1);
  89 | 
  90 |     await page.getByTestId("mini-player-toggle").click();
  91 |     await expect(page.getByTestId("mini-player-toggle")).toHaveAttribute(
  92 |       "aria-label",
  93 |       "Pause",
  94 |     );
  95 |   });
  96 | });
  97 | 
```