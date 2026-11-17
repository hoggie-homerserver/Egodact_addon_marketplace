# Egodact Developer Tools

A standalone Egodact add-on for marketplace developers. It adds a gated developer workspace to Egodact with a live SDK event inspector, a manifest/file validator, and a starter kit generator.

## Install

1. Extract `developer-addon.zip`.
2. In Chrome or Edge, open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**.
3. Select the extracted `developer-addon` folder.
4. Open `https://app.egodact.com/`, then choose **Developer Tools** from Egodact's Addons menu or header button.
5. Sign in using the same email/password or Google account used for the marketplace Developer Portal.

Marketplace accounts are created at the Developer Portal. This add-on uses Firebase Authentication from the same marketplace Firebase project to gate the tools. The web Firebase config is public client configuration; authentication is performed by Firebase Auth.

## Tools

- **Events:** inspect SDK registrations, add-on opens, host readiness/theme changes, and runtime errors observed after the add-on loads. Details are redacted and rendered as text.
- **Validator:** check a pasted manifest and file list for common marketplace add-on issues.
- **Starter kit:** generate a minimal `manifest.json` and `content.js`, with copy buttons.

## Source files

`manifest.json`, `config.js`, `content.js`, `sdk.js`, `lib.js`, and the Firebase compat app/auth scripts.
