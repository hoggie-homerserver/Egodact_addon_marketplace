// Background helper for the Developer Tools marketplace panel.
// Content scripts are bound by the page's CSP (connect-src), so the registry
// fetch is proxied here where host permissions apply.
'use strict';

var ALLOWED_PREFIXES = [
    'https://hoggie-homerserver.github.io/Egodact_addon_marketplace/'
];

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (!message || message.type !== 'egodact-devtools:fetch') return false;
    var url = String(message.url || '');
    var allowed = ALLOWED_PREFIXES.some(function (prefix) { return url.indexOf(prefix) === 0; });
    if (!allowed) {
        sendResponse({ ok: false, error: 'URL not allowed' });
        return false;
    }
    fetch(url, { cache: 'no-store' }).then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.text();
    }).then(function (text) {
        sendResponse({ ok: true, text: text });
    }).catch(function (error) {
        sendResponse({ ok: false, error: (error && error.message) || String(error) });
    });
    return true; // async response
});
