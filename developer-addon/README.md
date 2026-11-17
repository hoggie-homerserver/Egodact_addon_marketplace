# Egodact Developer Tools

A standalone Egodact add-on for marketplace developers (v0.2.1). It adds a gated developer workspace to Egodact with a live SDK event inspector, a registration registry, an SDK/host capability check, a storage browser, a manifest and file-list validator, and a starter kit + snippet generator.

## Install

1. Extract developer-addon.zip.
2. In Chrome or Edge, open chrome://extensions, enable Developer mode, and choose Load unpacked.
3. Select the extracted developer-addon folder.
4. Open https://app.egodact.com/ and select Developer Tools from the hamburger menu.
5. Sign in using the same email/password or Google account used for the marketplace Developer Portal.

The sign-in page is hosted by the marketplace, where Firebase Auth is already configured. After sign-in it hands a short-lived Firebase ID token to the add-on through a source- and origin-checked popup message.

## Tools

- **Live events**: inspect `egodact:*` events (registrations, opens, toasts, shortcuts, challenges, theme/addon changes) plus runtime errors. Filter, pause, show errors only, identical events are grouped with a count, and the log can be exported as JSON. The event tester dispatches synthetic events to check host handlers.
- **Registry**: live overview of everything add-ons registered (addon, menu, hamburger, button, game, sidebar panel, shortcut). Items whose `addonId` never registered are flagged, which catches typo'd ids.
- **Host & SDK**: shows which SDK methods this build actually provides (the bundled SDK used to miss `registerHamburger`), the required-API check, and all `--egd-*` theme variables with colour previews. Report can be copied.
- **Storage**: browse, edit, copy and delete `egodact_addon_*` localStorage keys — the same data `client.storage(addonId)` uses.
- **Validate add-on**: check a pasted manifest and file list for common marketplace add-on issues.
- **Starter kit**: generate a minimal manifest.json and content.js, plus copyable snippets for hamburger items, header buttons, games, modals, storage, shortcuts and challenges.

## Source files

manifest.json, content.js, sdk.js, and lib.js.
