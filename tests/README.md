# Tests

This directory contains end-to-end tests for the bingo-string application using Playwright.

## Running Tests

### Prerequisites
Make sure you have installed all dependencies:
```bash
npm install
```

### Run all tests
```bash
npm test
```

### Run tests in UI mode (interactive)
```bash
npm run test:ui
```

### Run tests in headed mode (see browser)
```bash
npm run test:headed
```

### Run specific test file
```bash
npx playwright test tests/recenter-button.spec.js
```

### Run tests for specific browser
```bash
npx playwright test --project=chromium
npx playwright test --project=mobile
```

## Test Structure

### `recenter-button.spec.js`
Tests for the mobile recenter button feature:
- Desktop visibility (button should be hidden)
- Mobile visibility (button should be visible)
- Button styling and positioning
- Recenter functionality (resets transform)
- TouchManager integration
- Accessibility attributes
- API compatibility

## Writing New Tests

When adding new tests, follow these guidelines:
1. Use descriptive test names
2. Group related tests with `test.describe()`
3. Use proper selectors (prefer data-testid or semantic selectors)
4. Clean up after tests if needed
5. Test both positive and negative scenarios

## CI/CD

Tests are configured to run with:
- 2 retries in CI environment
- Single worker in CI for stability
- HTML reporter for test results
- Trace on first retry for debugging

## Debugging

To debug a failing test:
```bash
npx playwright test --debug
```

To view the last test report:
```bash
npx playwright show-report
```
