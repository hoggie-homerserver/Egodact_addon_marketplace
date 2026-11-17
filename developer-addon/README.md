# Egodact Developer Tools

A standalone Egodact add-on for marketplace developers. It adds a gated developer workspace to Egodact with a live SDK event inspector, a manifest and file-list validator, and a starter kit generator.

## Install

1. Extract developer-addon.zip.
2. In Chrome or Edge, open chrome://extensions, enable Developer mode, and choose Load unpacked.
3. Select the extracted developer-addon folder.
4. Open https://app.egodact.com/ and select Developer Tools from the hamburger menu.
5. Sign in using the same email/password or Google account used for the marketplace Developer Portal.

The sign-in page is hosted by the marketplace, where Firebase Auth is already configured. After sign-in it hands a short-lived Firebase ID token to the add-on through a source- and origin-checked popup message.

## Tools

- Live events: inspect SDK registrations, add-on opens, host readiness/theme changes, and runtime errors observed after the add-on loads. Sensitive field names are redacted and details are rendered as text.
- Validate add-on: check a pasted manifest and file list for common marketplace add-on issues.
- Starter kit: generate a minimal manifest.json and content.js, with copy buttons.

## Source files

manifest.json, content.js, sdk.js, and lib.js.
