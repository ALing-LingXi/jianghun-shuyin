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
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByText('Test Book')
  - Target page, context or browser has been closed

```

```yaml
- main:
  - paragraph: Library
  - heading "Books" [level=1]
  - link "Upload text":
    - /url: /upload
  - text: Loading library...
```

```
Error: browserContext.close: Target page, context or browser has been closed
```