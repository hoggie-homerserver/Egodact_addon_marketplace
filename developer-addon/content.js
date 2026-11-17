(function () {
  'use strict';

  var client = window.EgodactAddonClient;
  var L = window.EgodactAddonLib;
  if (!client || !L) return;

  var ADDON_ID = 'egodact-developer-tools';
  var MENU_ID = ADDON_ID + '-menu';
  var ADDON_VERSION = '0.2.1';
  var AUTH_ORIGIN = 'https://hoggie-homerserver.github.io';
  var AUTH_URL = AUTH_ORIGIN + '/Egodact_addon_marketplace/developer-auth.html';
  var PORTAL_URL = AUTH_ORIGIN + '/Egodact_addon_marketplace/portal.html';
  var PROJECT_ID = 'egodact-addon-portal';
  var EVENTS_MAX = 300;
  var STORAGE_PREFIX = 'egodact_addon_';

  var currentUser = null;
  var authWindow = null;
  var activeBackdrop = null;
  var eventsHooked = false;
  var eventsPaused = false;
  var eventsErrorsOnly = false;
  var eventFilter = '';
  var events = [];
  var registry = {};
  var eventsRenderTimer = null;

  var MENU_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.5 2.5-3.5-3.5z"/></svg>';

  function notify(message, type) {
    try {
      if (client && typeof client.toast === 'function') { client.toast(message, { type: type || 'info' }); return; }
    } catch (error) {}
    if (type === 'error') console.warn('[Egodact Developer Tools] ' + message);
  }

  // Registration is defensive on purpose: an older SDK build without
  // registerHamburger used to throw here and silently kill the whole add-on.
  try {
    client.registerAddon({
      id: ADDON_ID,
      name: 'Egodact Developer Tools',
      version: ADDON_VERSION,
      description: 'Tools for building, checking, and debugging Egodact add-ons.',
      author: 'Egodact Marketplace'
    });
  } catch (error) {
    console.error('[Egodact Developer Tools] registerAddon failed:', error);
  }

  try {
    var menuMeta = { addonId: ADDON_ID, id: MENU_ID, title: 'Developer Tools', icon: MENU_ICON, order: '90' };
    if (typeof client.registerHamburger === 'function') client.registerHamburger(menuMeta);
    else client.registerMenu(menuMeta);
  } catch (error) {
    console.error('[Egodact Developer Tools] menu registration failed:', error);
  }

  try {
    client.onOpen(MENU_ID, openTools);
  } catch (error) {
    console.error('[Egodact Developer Tools] onOpen failed:', error);
  }

  try {
    window.addEventListener('message', handleAuthMessage);
  } catch (error) {
    console.error('[Egodact Developer Tools] message listener failed:', error);
  }

  // Capture from the start so the registry already knows what was registered
  // before the tools window is opened (visible only after sign-in).
  hookEvents();

  // ------------------------------------------------------------
  // shell / layout
  // ------------------------------------------------------------
  function shellHtml() {
    return '<div id="egd-dev-root">' +
      '<style>' +
        '#egd-dev-root{font-family:Arial,sans-serif;font-size:13px;color:var(--egd-tekst,#fff);min-height:420px}' +
        '#egd-dev-root h3{margin:0 0 6px;font-size:15px}' +
        '#egd-dev-root h4{margin:12px 0 6px;font-size:13px;opacity:.9}' +
        '#egd-dev-root button{padding:5px 10px;border-radius:5px;border:1px solid var(--egd-rand,#555);background:transparent;color:inherit;cursor:pointer;font-size:12px}' +
        '#egd-dev-root button:hover{border-color:var(--egd-accent,#90caf9)}' +
        '#egd-dev-root button.primary{background:var(--egd-accent,#90caf9);color:var(--egd-accent-tekst,#0d47a1);border:0;font-weight:bold}' +
        '#egd-dev-root input,#egd-dev-root select,#egd-dev-root textarea{background:var(--egd-veld,#2e2e2e);color:inherit;border:1px solid var(--egd-rand,#555);border-radius:5px;padding:6px;font:12px Consolas,monospace}' +
        '#egd-dev-root input[type="checkbox"]{padding:0}' +
        '#egd-dev-root a{color:var(--egd-accent,#90caf9)}' +
        '#egd-dev-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px;border-bottom:1px solid var(--egd-rand,#555);padding-bottom:8px}' +
        '#egd-dev-tabs button{border:0;border-radius:5px;padding:6px 10px;opacity:.7}' +
        '#egd-dev-tabs button.active{background:var(--egd-accent,#90caf9);color:var(--egd-accent-tekst,#0d47a1);opacity:1;font-weight:bold}' +
        '.egd-dev-muted{opacity:.65;font-size:11px}' +
        '.egd-dev-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:0 0 8px}' +
        '.egd-dev-list{max-height:340px;overflow:auto;display:flex;flex-direction:column;gap:6px;padding-right:4px}' +
        '.egd-dev-card{padding:8px;border:1px solid rgba(127,127,127,.35);border-radius:6px;font-size:12px}' +
        '.egd-dev-card.error{border-color:#e57373}' +
        '.egd-dev-card.warn{border-color:#ffb74d}' +
        '.egd-dev-head{display:flex;justify-content:space-between;gap:8px;font-weight:bold;margin-bottom:4px;align-items:center;flex-wrap:wrap}' +
        '.egd-dev-pre{white-space:pre-wrap;word-break:break-word;margin:4px 0 0;font:11px Consolas,monospace;max-height:220px;overflow:auto}' +
        '.egd-dev-chip{display:inline-flex;gap:5px;align-items:center;padding:2px 7px;border-radius:999px;background:rgba(144,202,249,.16);border:1px solid rgba(144,202,249,.45);margin:2px 3px 0 0;font-size:11px}' +
        '.egd-dev-chip b{font-weight:600}' +
        '.egd-dev-empty{padding:14px;border:1px dashed #777;border-radius:6px;font-size:12px;opacity:.75}' +
        '.egd-dev-ok{color:#81c784}.egd-dev-bad{color:#e57373}.egd-dev-warn{color:#ffb74d}' +
        '.egd-dev-count{font-size:11px;opacity:.7;font-weight:normal}' +
        '.egd-dev-detail{margin-top:6px}' +
        '.egd-dev-detail textarea{width:100%;min-height:90px;box-sizing:border-box}' +
        '.egd-dev-kv{display:grid;grid-template-columns:minmax(120px,32%) 1fr;gap:2px 10px;font:11px Consolas,monospace}' +
        '.egd-dev-kv div{padding:2px 0;border-bottom:1px solid rgba(127,127,127,.18);word-break:break-all}' +
      '</style>' +
      '<div id="egd-dev-auth" style="display:none;"></div>' +
      '<div id="egd-dev-workspace" style="display:none;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 10px;">' +
          '<span class="egd-dev-muted" id="egd-dev-user"></span>' +
          '<span style="display:flex;gap:6px;align-items:center;">' +
            '<span class="egd-dev-muted">v' + ADDON_VERSION + '</span>' +
            '<button id="egd-dev-signout" type="button">Sign out</button>' +
          '</span>' +
        '</div>' +
        '<nav id="egd-dev-tabs">' +
          '<button type="button" data-tab="events">Live events</button>' +
          '<button type="button" data-tab="registry">Registry</button>' +
          '<button type="button" data-tab="host">Host &amp; SDK</button>' +
          '<button type="button" data-tab="storage">Storage</button>' +
          '<button type="button" data-tab="validate">Validate add-on</button>' +
          '<button type="button" data-tab="starter">Starter kit</button>' +
        '</nav>' +
        '<section data-panel="events" style="display:none;">' +
          '<div class="egd-dev-row">' +
            '<input type="text" id="egd-dev-event-filter" placeholder="Filter (naam, addon, tekst)..." style="flex:1;min-width:180px;">' +
            '<label class="egd-dev-muted"><input type="checkbox" id="egd-dev-event-pause"> Pauze</label>' +
            '<label class="egd-dev-muted"><input type="checkbox" id="egd-dev-event-errors"> Alleen errors</label>' +
            '<button type="button" data-act="events-clear">Clear</button>' +
            '<button type="button" data-act="events-export">Export JSON</button>' +
            '<span class="egd-dev-muted" id="egd-dev-event-count"></span>' +
          '</div>' +
          '<div id="egd-dev-event-list" class="egd-dev-list"></div>' +
          '<h4>Event tester</h4>' +
          '<p class="egd-dev-muted" style="margin:0 0 6px;">Stuurt een synthetisch event de pagina in (handig om host-handlers te testen).</p>' +
          '<div class="egd-dev-row">' +
            '<input type="text" id="egd-dev-test-id" placeholder="bijv. mijn-addon-menu" style="flex:1;min-width:160px;">' +
            '<button type="button" data-act="test-open">addon:open</button>' +
            '<button type="button" data-act="test-toast">addon:toast</button>' +
            '<button type="button" data-act="test-addons">addons:changed</button>' +
          '</div>' +
        '</section>' +
        '<section data-panel="registry" style="display:none;">' +
          '<div class="egd-dev-row">' +
            '<input type="text" id="egd-dev-registry-filter" placeholder="Filter addon..." style="flex:1;min-width:180px;">' +
            '<button type="button" data-act="registry-copy">Copy JSON</button>' +
            '<button type="button" data-act="registry-reset">Reset</button>' +
            '<span class="egd-dev-muted" id="egd-dev-registry-count"></span>' +
          '</div>' +
          '<p class="egd-dev-muted" style="margin:0 0 8px;">Alles wat add-ons sinds het laden via <code>egodact:addon:register</code> hebben aangemeld.</p>' +
          '<div id="egd-dev-registry-list" class="egd-dev-list"></div>' +
        '</section>' +
        '<section data-panel="host" style="display:none;">' +
          '<div class="egd-dev-row">' +
            '<button type="button" data-act="host-refresh">Refresh</button>' +
            '<button type="button" data-act="host-copy">Copy report</button>' +
          '</div>' +
          '<div id="egd-dev-host"></div>' +
        '</section>' +
        '<section data-panel="storage" style="display:none;">' +
          '<div class="egd-dev-row">' +
            '<input type="text" id="egd-dev-storage-filter" placeholder="Filter sleutel..." style="flex:1;min-width:180px;">' +
            '<button type="button" data-act="storage-refresh">Refresh</button>' +
            '<span class="egd-dev-muted" id="egd-dev-storage-count"></span>' +
          '</div>' +
          '<p class="egd-dev-muted" style="margin:0 0 8px;">Sleutels met prefix <code>' + STORAGE_PREFIX + '</code> (de opslag die <code>client.storage()</code> gebruikt).</p>' +
          '<div id="egd-dev-storage-list" class="egd-dev-list"></div>' +
        '</section>' +
        '<section data-panel="validate" style="display:none;">' +
          '<p class="egd-dev-muted" style="margin:0 0 8px;">Paste the manifest and the files that will be in your add-on folder.</p>' +
          '<label class="egd-dev-muted" style="display:block;margin:8px 0 4px;">manifest.json</label>' +
          '<textarea id="egd-dev-manifest" spellcheck="false" style="width:100%;height:170px;box-sizing:border-box;"></textarea>' +
          '<label class="egd-dev-muted" style="display:block;margin:8px 0 4px;">Files (one path per line)</label>' +
          '<textarea id="egd-dev-files" spellcheck="false" style="width:100%;height:80px;box-sizing:border-box;"></textarea>' +
          '<button type="button" class="primary" data-act="validate-run" style="margin-top:8px;">Check add-on</button>' +
          '<div id="egd-dev-validation-result" aria-live="polite" style="margin-top:10px;display:flex;flex-direction:column;gap:5px;"></div>' +
        '</section>' +
        '<section data-panel="starter" style="display:none;">' +
          '<p class="egd-dev-muted" style="margin:0 0 8px;">Generate a small, working SDK add-on starter, or copy a snippet.</p>' +
          '<div class="egd-dev-row">' +
            '<label class="egd-dev-muted">Name <input type="text" id="egd-dev-addon-name" value="My Egodact Add-on"></label>' +
            '<label class="egd-dev-muted">ID <input type="text" id="egd-dev-addon-id" value="my-egodact-addon"></label>' +
            '<button type="button" data-act="starter-generate">Generate</button>' +
            '<button type="button" data-act="starter-copy-all">Copy files</button>' +
          '</div>' +
          '<label class="egd-dev-muted" style="display:block;margin:8px 0 4px;">manifest.json</label>' +
          '<textarea id="egd-dev-starter-manifest" spellcheck="false" style="width:100%;height:140px;box-sizing:border-box;"></textarea>' +
          '<button type="button" data-act="copy-manifest" style="margin-top:5px;">Copy manifest</button>' +
          '<label class="egd-dev-muted" style="display:block;margin:10px 0 4px;">content.js</label>' +
          '<textarea id="egd-dev-starter-content" spellcheck="false" style="width:100%;height:200px;box-sizing:border-box;"></textarea>' +
          '<button type="button" data-act="copy-content" style="margin-top:5px;">Copy content.js</button>' +
          '<h4>Snippets</h4>' +
          '<div class="egd-dev-row">' +
            '<select id="egd-dev-snippet">' +
              '<option value="hamburger">Hamburger menu-item</option>' +
              '<option value="button">Header button</option>' +
              '<option value="game">Game</option>' +
              '<option value="modal">Modal + toast</option>' +
              '<option value="storage">Storage (per addon)</option>' +
              '<option value="shortcut">Keyboard shortcut</option>' +
              '<option value="challenges">Challenges ophalen</option>' +
            '</select>' +
            '<button type="button" data-act="snippet-generate">Toon snippet</button>' +
            '<button type="button" data-act="snippet-copy">Copy snippet</button>' +
          '</div>' +
          '<textarea id="egd-dev-snippet-code" spellcheck="false" style="width:100%;height:170px;box-sizing:border-box;"></textarea>' +
        '</section>' +
      '</div>' +
    '</div>';
  }

  function openTools() {
    if (activeBackdrop && document.body.contains(activeBackdrop)) return;
    activeBackdrop = client.openModal('Egodact Developer Tools', shellHtml());
    var panel = activeBackdrop && activeBackdrop.firstElementChild;
    if (panel) {
      panel.style.width = 'min(940px, calc(100vw - 32px))';
      panel.style.maxWidth = '940px';
    }
    var root = activeBackdrop && activeBackdrop.querySelector('#egd-dev-root');
    if (!root) return;
    eventsPaused = false;
    bindWorkspace(root);
    renderAuth(root);
  }

  function bindWorkspace(root) {
    root.addEventListener('click', function (event) {
      var tab = event.target.closest && event.target.closest('[data-tab]');
      if (tab) { showPanel(root, tab.getAttribute('data-tab')); return; }
      var actionEl = event.target.closest && event.target.closest('[data-act]');
      if (!actionEl) return;
      handleAction(root, actionEl.getAttribute('data-act'), actionEl);
    });
    root.addEventListener('input', function (event) {
      var el = event.target;
      if (!el) return;
      if (el.id === 'egd-dev-event-filter') { eventFilter = el.value; scheduleEventsRender(root); }
      else if (el.id === 'egd-dev-registry-filter' || el.id === 'egd-dev-storage-filter') {
        if (el.id === 'egd-dev-registry-filter') renderRegistry(root);
        else renderStorage(root);
      }
      else if (el.id === 'egd-dev-addon-id') el.value = slug(el.value);
      else if (el.id === 'egd-dev-addon-name') generateStarter(root);
    });
    root.addEventListener('change', function (event) {
      var el = event.target;
      if (!el) return;
      if (el.id === 'egd-dev-event-pause') { eventsPaused = el.checked; if (!eventsPaused) renderEvents(root); }
      else if (el.id === 'egd-dev-event-errors') { eventsErrorsOnly = el.checked; renderEvents(root); }
      else if (el.id === 'egd-dev-addon-id') generateStarter(root);
      else if (el.id === 'egd-dev-snippet') generateSnippet(root);
    });
  }

  function handleAction(root, act, el) {
    switch (act) {
      case 'events-clear': events = []; renderEvents(root); break;
      case 'events-export': exportEvents(); break;
      case 'test-open': testDispatch(root, 'open'); break;
      case 'test-toast': testDispatch(root, 'toast'); break;
      case 'test-addons': testDispatch(root, 'addons'); break;
      case 'registry-copy': copyText(JSON.stringify(registry, null, 2), 'Registry copied.'); break;
      case 'registry-reset': registry = {}; renderRegistry(root); break;
      case 'host-refresh': renderHost(root); break;
      case 'host-copy': copyText(hostReport(), 'Report copied.'); break;
      case 'storage-refresh': renderStorage(root); break;
      case 'storage-toggle': toggleStorageDetail(el); break;
      case 'storage-copy': copyText(el.getAttribute('data-raw') || '', 'Value copied.'); break;
      case 'storage-del': removeStorageKey(el.getAttribute('data-key') || ''); renderStorage(root); break;
      case 'storage-save': saveStorageKey(el); renderStorage(root); break;
      case 'validate-run': validateAddon(root); break;
      case 'starter-generate': generateStarter(root); generateSnippet(root); break;
      case 'starter-copy-all':
        copyText('=== manifest.json ===\n' + root.querySelector('#egd-dev-starter-manifest').value +
          '\n\n=== content.js ===\n' + root.querySelector('#egd-dev-starter-content').value, 'Files copied.');
        break;
      case 'copy-manifest': copyText(root.querySelector('#egd-dev-starter-manifest').value, 'Manifest copied.'); break;
      case 'copy-content': copyText(root.querySelector('#egd-dev-starter-content').value, 'content.js copied.'); break;
      case 'snippet-generate': generateSnippet(root); break;
      case 'snippet-copy': copyText(root.querySelector('#egd-dev-snippet-code').value, 'Snippet copied.'); break;
      default: break;
    }
  }

  // ------------------------------------------------------------
  // auth
  // ------------------------------------------------------------
  function renderAuth(root) {
    var authPanel = root.querySelector('#egd-dev-auth');
    var workspace = root.querySelector('#egd-dev-workspace');
    if (!currentUser) {
      workspace.style.display = 'none';
      authPanel.style.display = 'block';
      authPanel.innerHTML =
        '<h3>Sign in with your marketplace developer account</h3>' +
        '<p class="egd-dev-muted">The tools are available to signed-in Developer Portal accounts.</p>' +
        '<button id="egd-dev-login" type="button" class="primary" style="margin-top:8px;">Sign in with marketplace</button>' +
        '<div id="egd-dev-auth-error" role="alert" class="egd-dev-bad" style="font-size:12px;margin-top:8px;"></div>' +
        '<p class="egd-dev-muted" style="margin-top:10px;">Need an account? <a href="' + PORTAL_URL + '" target="_blank" rel="noopener">Create one in the Developer Portal</a>.</p>';
      root.querySelector('#egd-dev-login').addEventListener('click', function () { beginLogin(root); });
      return;
    }
    authPanel.style.display = 'none';
    workspace.style.display = 'block';
    root.querySelector('#egd-dev-user').textContent = currentUser.email || 'Marketplace developer account';
    root.querySelector('#egd-dev-manifest').value = JSON.stringify({
      manifest_version: 3,
      name: 'My Egodact Add-on',
      version: '1.0.0',
      content_scripts: [{ matches: ['https://app.egodact.com/*'], js: ['sdk.js', 'lib.js', 'content.js'] }]
    }, null, 2);
    root.querySelector('#egd-dev-files').value = 'manifest.json\nsdk.js\nlib.js\ncontent.js';
    generateStarter(root);
    generateSnippet(root);
    hookEvents();
    showPanel(root, 'events');
  }

  function showAuthError(root, message) {
    var panel = root.querySelector('#egd-dev-auth');
    panel.style.display = 'block';
    var errorEl = root.querySelector('#egd-dev-auth-error');
    if (errorEl) errorEl.textContent = message;
    else panel.textContent = message;
  }

  function beginLogin(root) {
    try {
      authWindow = window.open(AUTH_URL, 'egodact-developer-auth', 'popup,width=520,height=700');
      if (!authWindow) showAuthError(root, 'Your browser blocked the sign-in popup. Allow pop-ups for app.egodact.com, then try again.');
    } catch (error) {
      showAuthError(root, 'Could not open marketplace sign-in. Allow pop-ups for app.egodact.com and try again.');
    }
  }

  function handleAuthMessage(event) {
    if (!authWindow || event.origin !== AUTH_ORIGIN || event.source !== authWindow) return;
    var data = event.data || {};
    if (data.type !== 'egodact-developer-auth' || typeof data.idToken !== 'string') return;
    try {
      var parts = data.idToken.split('.');
      if (parts.length !== 3) throw new Error('Invalid token.');
      var payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (payload.length % 4) payload += '=';
      var claims = JSON.parse(atob(payload));
      if (claims.aud !== PROJECT_ID || claims.iss !== 'https://securetoken.google.com/' + PROJECT_ID || Number(claims.exp) * 1000 <= Date.now()) {
        throw new Error('Marketplace sign-in expired. Please try again.');
      }
      currentUser = { email: claims.email || 'Marketplace developer account' };
      authWindow = null;
      var root = activeBackdrop && activeBackdrop.querySelector('#egd-dev-root');
      if (root) renderAuth(root);
    } catch (error) {
      authWindow = null;
      var activeRoot = activeBackdrop && activeBackdrop.querySelector('#egd-dev-root');
      if (activeRoot) showAuthError(activeRoot, error.message || 'Marketplace sign-in failed. Please try again.');
    }
  }

  // ------------------------------------------------------------
  // panels
  // ------------------------------------------------------------
  function showPanel(root, name) {
    root.querySelectorAll('[data-panel]').forEach(function (panel) {
      panel.style.display = panel.getAttribute('data-panel') === name ? 'block' : 'none';
    });
    root.querySelectorAll('#egd-dev-tabs button').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-tab') === name);
    });
    if (name === 'events') renderEvents(root);
    else if (name === 'registry') renderRegistry(root);
    else if (name === 'host') renderHost(root);
    else if (name === 'storage') renderStorage(root);
  }

  // ------------------------------------------------------------
  // live events
  // ------------------------------------------------------------
  function hookEvents() {
    if (eventsHooked) return;
    eventsHooked = true;
    [
      'egodact:host:ready',
      'egodact:addon:register',
      'egodact:addon:open',
      'egodact:addon:toast',
      'egodact:addon:shortcut',
      'egodact:addon:challenges:request',
      'egodact:addon:challenges:response',
      'egodact:addons:changed',
      'egodact:theme:changed'
    ].forEach(function (eventName) {
      document.addEventListener(eventName, function (event) {
        pushEvent(eventName, event && event.detail, 'event');
      }, true);
    });
    window.addEventListener('error', function (event) {
      pushEvent('runtime error', {
        message: redactText(event.message || 'Script error'),
        file: redactText(event.filename || ''),
        line: event.lineno || 0
      }, 'error');
    });
    window.addEventListener('unhandledrejection', function (event) {
      pushEvent('unhandled rejection', { reason: redact(event.reason) }, 'error');
    });
  }

  function nowTime() {
    var d = new Date();
    return d.toLocaleTimeString('nl-NL', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
  }

  function pushEvent(name, detail, level) {
    var safe = redact(detail);
    updateRegistry(name, detail);
    if (eventsPaused) return;
    var sig;
    try { sig = name + '|' + JSON.stringify(safe); } catch (error) { sig = name + '|' + String(safe); }
    var last = events[0];
    if (last && last.sig === sig && Date.now() - last.ts < 30000) {
      last.count++;
      last.time = nowTime();
      last.ts = Date.now();
    } else {
      events.unshift({ name: name, detail: safe, time: nowTime(), ts: Date.now(), count: 1, sig: sig, level: level || 'event' });
      if (events.length > EVENTS_MAX) events.pop();
    }
    var root = activeBackdrop && activeBackdrop.querySelector('#egd-dev-root');
    if (root) scheduleEventsRender(root);
  }

  function scheduleEventsRender(root) {
    if (eventsRenderTimer) return;
    eventsRenderTimer = setTimeout(function () {
      eventsRenderTimer = null;
      var panel = root.querySelector('[data-panel="events"]');
      if (panel && panel.style.display !== 'none') renderEvents(root);
    }, 150);
  }

  function filteredEvents() {
    var needle = eventFilter.toLowerCase().trim();
    return events.filter(function (item) {
      if (eventsErrorsOnly && item.level !== 'error') return false;
      if (!needle) return true;
      var hay = item.name + ' ' + JSON.stringify(item.detail);
      return hay.toLowerCase().indexOf(needle) !== -1;
    });
  }

  function renderEvents(root) {
    var list = root.querySelector('#egd-dev-event-list');
    var count = root.querySelector('#egd-dev-event-count');
    if (!list || !count) return;
    var shown = filteredEvents();
    count.textContent = shown.length + ' / ' + events.length + ' events';
    list.textContent = '';
    if (!shown.length) {
      var empty = document.createElement('div');
      empty.className = 'egd-dev-empty';
      empty.textContent = 'Nog geen events. Open een menu of gebruik een add-on.';
      list.appendChild(empty);
      return;
    }
    shown.forEach(function (item) {
      var card = document.createElement('div');
      card.className = 'egd-dev-card' + (item.level === 'error' ? ' error' : '');
      var head = document.createElement('div');
      head.className = 'egd-dev-head';
      var name = document.createElement('span');
      name.textContent = item.name + (item.count > 1 ? '  ×' + item.count : '');
      var time = document.createElement('span');
      time.textContent = item.time;
      time.className = 'egd-dev-muted';
      head.appendChild(name);
      head.appendChild(time);
      card.appendChild(head);
      if (typeof item.detail !== 'undefined') {
        var details = document.createElement('details');
        var summary = document.createElement('summary');
        summary.className = 'egd-dev-muted';
        summary.textContent = 'details';
        var body = document.createElement('pre');
        body.className = 'egd-dev-pre';
        body.textContent = JSON.stringify(item.detail, null, 2);
        details.appendChild(summary);
        details.appendChild(body);
        card.appendChild(details);
      }
      list.appendChild(card);
    });
  }

  function exportEvents() {
    var blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'egodact-dev-events-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  function testDispatch(root, kind) {
    var idEl = root.querySelector('#egd-dev-test-id');
    var id = (idEl && idEl.value.trim()) || MENU_ID;
    try {
      if (kind === 'open') {
        document.dispatchEvent(new CustomEvent('egodact:addon:open', { detail: { id: id } }));
      } else if (kind === 'toast') {
        document.dispatchEvent(new CustomEvent('egodact:addon:toast', { detail: { message: 'Test toast from Developer Tools', options: { type: 'info' } } }));
      } else {
        document.dispatchEvent(new CustomEvent('egodact:addons:changed', { detail: null }));
      }
      notify('Event verstuurd: ' + kind, 'success');
    } catch (error) {
      notify('Event versturen mislukt: ' + error.message, 'error');
    }
  }

  // ------------------------------------------------------------
  // registry
  // ------------------------------------------------------------
  function updateRegistry(name, detail) {
    if (name !== 'egodact:addon:register' || !detail || typeof detail !== 'object') return;
    var type = detail.type || 'unknown';
    var meta = detail.meta || {};
    if (type === 'addon') {
      var addonKey = meta.id || '(geen id)';
      registry[addonKey] = registry[addonKey] || { addon: null, items: [] };
      registry[addonKey].addon = meta;
      return;
    }
    var owner = meta.addonId || '(geen addonId)';
    var bucket = registry[owner] || (registry[owner] = { addon: null, items: [] });
    var itemId = String(meta.id || '');
    for (var i = 0; i < bucket.items.length; i++) {
      if (bucket.items[i].type === type && String(bucket.items[i].meta.id || '') === itemId) {
        bucket.items[i].count = (bucket.items[i].count || 1) + 1;
        bucket.items[i].meta = meta;
        return;
      }
    }
    bucket.items.push({ type: type, meta: meta, count: 1 });
  }

  function renderRegistry(root) {
    var list = root.querySelector('#egd-dev-registry-list');
    var count = root.querySelector('#egd-dev-registry-count');
    if (!list || !count) return;
    var filterEl = root.querySelector('#egd-dev-registry-filter');
    var needle = filterEl ? filterEl.value.toLowerCase().trim() : '';
    var keys = Object.keys(registry).sort(function (a, b) {
      return String((registry[a].addon || {}).name || a).localeCompare(String((registry[b].addon || {}).name || b));
    }).filter(function (key) {
      if (!needle) return true;
      return (key + ' ' + JSON.stringify(registry[key])).toLowerCase().indexOf(needle) !== -1;
    });
    count.textContent = keys.length + ' add-ons';
    list.textContent = '';
    if (!keys.length) {
      var empty = document.createElement('div');
      empty.className = 'egd-dev-empty';
      empty.textContent = 'Nog geen registraties. Herlaad de pagina of open een add-on.';
      list.appendChild(empty);
      return;
    }
    keys.forEach(function (key) {
      var entry = registry[key];
      var addon = entry.addon || {};
      var card = document.createElement('div');
      card.className = 'egd-dev-card' + (!entry.addon ? ' warn' : '');
      var head = document.createElement('div');
      head.className = 'egd-dev-head';
      var title = document.createElement('span');
      title.textContent = (addon.name || '(naam onbekend)') + ' ';
      var idSpan = document.createElement('span');
      idSpan.className = 'egd-dev-muted';
      idSpan.textContent = key;
      title.appendChild(idSpan);
      var metaSpan = document.createElement('span');
      metaSpan.className = 'egd-dev-muted';
      metaSpan.textContent = [addon.version ? 'v' + addon.version : '', addon.author || ''].filter(Boolean).join(' · ');
      head.appendChild(title);
      head.appendChild(metaSpan);
      card.appendChild(head);
      var chips = document.createElement('div');
      if (!entry.items.length) {
        var none = document.createElement('span');
        none.className = 'egd-dev-muted';
        none.textContent = 'Geen menu/button/hamburger/game geregistreerd.';
        chips.appendChild(none);
      }
      entry.items.forEach(function (item) {
        var chip = document.createElement('span');
        chip.className = 'egd-dev-chip';
        var type = document.createElement('b');
        type.textContent = item.type;
        chip.appendChild(type);
        chip.appendChild(document.createTextNode(String(item.meta.title || item.meta.id || '')));
        if (item.meta.id) {
          var idc = document.createElement('span');
          idc.className = 'egd-dev-muted';
          idc.textContent = item.meta.id;
          chip.appendChild(idc);
        }
        if (item.count > 1) {
          var c = document.createElement('span');
          c.className = 'egd-dev-count';
          c.textContent = '×' + item.count;
          chip.appendChild(c);
        }
        chips.appendChild(chip);
      });
      card.appendChild(chips);
      if (!entry.addon) {
        var warn = document.createElement('div');
        warn.className = 'egd-dev-warn egd-dev-muted';
        warn.textContent = 'Deze items verwijzen naar een addon die zich niet (meer) heeft aangemeld — controleer de addonId.';
        card.appendChild(warn);
      }
      list.appendChild(card);
    });
  }

  // ------------------------------------------------------------
  // host & sdk
  // ------------------------------------------------------------
  function hostReport() {
    var methods = ['registerAddon', 'registerMenu', 'registerHamburger', 'registerButton', 'registerGame', 'registerSidebarPanel', 'registerShortcut', 'onOpen', 'onShortcut', 'openModal', 'storage', 'toast', 'getChallenges', 'onThemeChange', 'setLearningMode'];
    var lines = ['Egodact Developer Tools ' + ADDON_VERSION, 'URL: ' + location.href, '', 'SDK methods:'];
    methods.forEach(function (name) {
      lines.push((typeof client[name] === 'function' ? '[x] ' : '[ ] ') + name);
    });
    lines.push('', 'Theme variables:');
    themeVars().forEach(function (item) { lines.push(item.name + ': ' + item.value); });
    return lines.join('\n');
  }

  function themeVars() {
    var out = [];
    try {
      var styles = getComputedStyle(document.documentElement);
      for (var i = 0; i < styles.length; i++) {
        var name = styles[i];
        if (name.indexOf('--egd-') === 0) {
          out.push({ name: name, value: String(styles.getPropertyValue(name)).trim() });
        }
      }
    } catch (error) {}
    out.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return out;
  }

  function renderHost(root) {
    var container = root.querySelector('#egd-dev-host');
    if (!container) return;
    var required = ['registerAddon', 'registerMenu', 'openModal', 'onOpen'];
    var methods = ['registerAddon', 'registerMenu', 'registerHamburger', 'registerButton', 'registerGame', 'registerSidebarPanel', 'registerShortcut', 'onOpen', 'onShortcut', 'openModal', 'storage', 'toast', 'getChallenges', 'onThemeChange', 'setLearningMode'];
    var missing = required.filter(function (name) { return typeof client[name] !== 'function'; });

    var html = '<h4>Status</h4><div class="egd-dev-kv">';
    html += '<div>Extensie</div><div>Developer Tools v' + ADDON_VERSION + '</div>';
    html += '<div>SDK client</div><div class="' + (client ? 'egd-dev-ok' : 'egd-dev-bad') + '">' + (client ? 'aanwezig' : 'ontbreekt') + '</div>';
    html += '<div>Host library</div><div class="' + (L ? 'egd-dev-ok' : 'egd-dev-bad') + '">' + (L ? 'aanwezig' : 'ontbreekt') + '</div>';
    html += '<div>Verplichte API</div><div class="' + (missing.length ? 'egd-dev-bad' : 'egd-dev-ok') + '">' + (missing.length ? 'mist: ' + missing.join(', ') : 'compleet') + '</div>';
    html += '<div>Pagina</div><div>' + esc(location.href) + '</div>';
    html += '</div>';

    html += '<h4>SDK-methodes</h4><div class="egd-dev-kv">';
    methods.forEach(function (name) {
      var available = typeof client[name] === 'function';
      html += '<div>' + esc(name) + '</div><div class="' + (available ? 'egd-dev-ok' : 'egd-dev-warn') + '">' + (available ? 'beschikbaar' : 'niet in deze SDK-versie') + '</div>';
    });
    html += '</div>';

    var vars = themeVars();
    html += '<h4>Thema-variabelen <span class="egd-dev-muted">(' + vars.length + ')</span></h4>';
    if (!vars.length) {
      html += '<div class="egd-dev-empty">Geen <code>--egd-*</code> variabelen gevonden.</div>';
    } else {
      html += '<div class="egd-dev-list" style="max-height:220px"><div class="egd-dev-kv">';
      vars.forEach(function (item) {
        html += '<div>' + esc(item.name) + '</div><div>' + esc(item.value) +
          (item.value && item.value.charAt(0) === '#' ? ' <span style="display:inline-block;width:11px;height:11px;border-radius:3px;border:1px solid #777;background:' + esc(item.value) + ';vertical-align:middle"></span>' : '') +
          '</div>';
      });
      html += '</div></div>';
    }
    container.innerHTML = html;
  }

  // ------------------------------------------------------------
  // storage
  // ------------------------------------------------------------
  function storageKeys() {
    var keys = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf(STORAGE_PREFIX) === 0) keys.push(key);
      }
    } catch (error) {}
    return keys.sort();
  }

  function addonIdFromKey(key) {
    var rest = key.slice(STORAGE_PREFIX.length);
    var ids = Object.keys(registry);
    for (var i = 0; i < ids.length; i++) {
      if (rest.indexOf(ids[i] + '_') === 0) return { addonId: ids[i], name: rest.slice(ids[i].length + 1) };
    }
    var idx = rest.indexOf('_');
    if (idx === -1) return { addonId: rest, name: '' };
    return { addonId: rest.slice(0, idx), name: rest.slice(idx + 1) };
  }

  function renderStorage(root) {
    var list = root.querySelector('#egd-dev-storage-list');
    var count = root.querySelector('#egd-dev-storage-count');
    if (!list || !count) return;
    var filterEl = root.querySelector('#egd-dev-storage-filter');
    var needle = filterEl ? filterEl.value.toLowerCase().trim() : '';
    var keys = storageKeys().filter(function (key) { return !needle || key.toLowerCase().indexOf(needle) !== -1; });
    count.textContent = keys.length + ' sleutels';
    list.textContent = '';
    if (!keys.length) {
      var empty = document.createElement('div');
      empty.className = 'egd-dev-empty';
      empty.textContent = 'Geen opgeslagen addon-data gevonden.';
      list.appendChild(empty);
      return;
    }
    keys.forEach(function (key) {
      var parsed = addonIdFromKey(key);
      var raw = '';
      try { raw = localStorage.getItem(key) || ''; } catch (error) {}
      var card = document.createElement('div');
      card.className = 'egd-dev-card';
      card.setAttribute('data-key', key);
      var head = document.createElement('div');
      head.className = 'egd-dev-head';
      var title = document.createElement('span');
      title.textContent = parsed.name || key;
      var meta = document.createElement('span');
      meta.className = 'egd-dev-muted';
      meta.textContent = parsed.addonId + ' · ' + raw.length + ' B';
      head.appendChild(title);
      head.appendChild(meta);
      card.appendChild(head);
      var actions = document.createElement('div');
      actions.className = 'egd-dev-row';
      actions.style.margin = '0';
      actions.innerHTML =
        '<button type="button" data-act="storage-toggle">Bekijken</button>' +
        '<button type="button" data-act="storage-copy">Kopieer</button>' +
        '<button type="button" data-act="storage-del">Verwijder</button>';
      actions.querySelector('[data-act="storage-copy"]').setAttribute('data-raw', raw);
      actions.querySelector('[data-act="storage-del"]').setAttribute('data-key', key);
      card.appendChild(actions);
      var detail = document.createElement('div');
      detail.className = 'egd-dev-detail';
      detail.hidden = true;
      var textarea = document.createElement('textarea');
      textarea.value = raw;
      var save = document.createElement('button');
      save.type = 'button';
      save.textContent = 'Opslaan';
      save.setAttribute('data-act', 'storage-save');
      save.setAttribute('data-key', key);
      detail.appendChild(textarea);
      detail.appendChild(save);
      card.appendChild(detail);
      list.appendChild(card);
    });
  }

  function toggleStorageDetail(button) {
    var card = button.closest('.egd-dev-card');
    var detail = card && card.querySelector('.egd-dev-detail');
    if (!detail) return;
    detail.hidden = !detail.hidden;
    button.textContent = detail.hidden ? 'Bekijken' : 'Verbergen';
  }

  function saveStorageKey(button) {
    var key = button.getAttribute('data-key');
    var card = button.closest('.egd-dev-card');
    var textarea = card && card.querySelector('.egd-dev-detail textarea');
    if (!key || !textarea) return;
    try {
      localStorage.setItem(key, textarea.value);
      notify('Opgeslagen: ' + key, 'success');
    } catch (error) {
      notify('Opslaan mislukt: ' + error.message, 'error');
    }
  }

  function removeStorageKey(key) {
    if (!key) return;
    try { localStorage.removeItem(key); notify('Verwijderd: ' + key, 'success'); }
    catch (error) { notify('Verwijderen mislukt: ' + error.message, 'error'); }
  }

  // ------------------------------------------------------------
  // validation
  // ------------------------------------------------------------
  function validateAddon(root) {
    var result = root.querySelector('#egd-dev-validation-result');
    result.textContent = '';
    var manifest;
    try {
      manifest = JSON.parse(root.querySelector('#egd-dev-manifest').value);
    } catch (error) {
      addCheck(result, 'error', 'manifest.json is not valid JSON.');
      return;
    }
    var files = root.querySelector('#egd-dev-files').value.split(/\r?\n/).map(function (file) { return file.trim().replace(/\\/g, '/'); }).filter(Boolean);
    var normalized = files.map(function (file) { return file.replace(/^\.\/+/, ''); });
    var scripts = [];
    var problems = [];
    if (manifest.manifest_version !== 3) problems.push(['error', 'Use manifest_version 3.']);
    if (!manifest.name) problems.push(['error', 'Add a name to the manifest.']);
    if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(String(manifest.version || ''))) problems.push(['error', 'Use a version such as 1.0.0.']);
    if (!Array.isArray(manifest.content_scripts) || !manifest.content_scripts.length) problems.push(['error', 'Add a content_scripts entry for Egodact.']);
    (manifest.content_scripts || []).forEach(function (block) {
      (block.js || []).forEach(function (file) { scripts.push(String(file).replace(/\\/g, '/').replace(/^\.\/+/, '')); });
      if (!(block.matches || []).some(function (match) { return String(match).indexOf('app.egodact.com') !== -1; })) {
        problems.push(['warn', 'A content script does not match app.egodact.com.']);
      }
    });
    var unique = {};
    normalized.forEach(function (file) {
      if (unique[file]) problems.push(['warn', 'Duplicate file path: ' + file]);
      unique[file] = true;
    });
    scripts.forEach(function (file) {
      if (normalized.indexOf(file) === -1) problems.push(['error', 'Manifest loads a missing file: ' + file]);
    });
    if (normalized.indexOf('content.js') === -1) problems.push(['warn', 'No content.js appears in the file list.']);
    var sdkIndex = scripts.indexOf('sdk.js');
    var libIndex = scripts.indexOf('lib.js');
    var contentIndex = scripts.indexOf('content.js');
    if (sdkIndex !== -1 && libIndex !== -1 && sdkIndex > libIndex) problems.push(['error', 'Load sdk.js before lib.js.']);
    if (libIndex !== -1 && contentIndex !== -1 && libIndex > contentIndex) problems.push(['error', 'Load lib.js before content.js.']);
    if ((manifest.permissions || []).some(function (permission) { return permission === '<all_urls>' || permission === 'debugger'; })) {
      problems.push(['warn', 'Review broad permissions before submitting.']);
    }
    if (!problems.length) problems.push(['ok', 'No common manifest or file-list problems found.']);
    problems.forEach(function (item) { addCheck(result, item[0], item[1]); });
  }

  function addCheck(container, level, message) {
    var row = document.createElement('div');
    row.textContent = (level === 'error' ? '✖ ' : level === 'warn' ? '⚠ ' : '✓ ') + message;
    row.style.cssText = 'font-size:12px;padding:7px 9px;border-radius:5px;border:1px solid ' +
      (level === 'error' ? '#e57373' : level === 'warn' ? '#ffb74d' : '#81c784') + ';';
    container.appendChild(row);
  }

  // ------------------------------------------------------------
  // starter kit
  // ------------------------------------------------------------
  function generateStarter(root) {
    var nameEl = root.querySelector('#egd-dev-addon-name');
    var idEl = root.querySelector('#egd-dev-addon-id');
    if (!nameEl || !idEl) return;
    var name = nameEl.value.trim() || 'My Egodact Add-on';
    var id = slug(idEl.value) || 'my-egodact-addon';
    idEl.value = id;
    var manifest = {
      manifest_version: 3,
      name: name,
      version: '1.0.0',
      description: 'An add-on for Egodact.',
      content_scripts: [{ matches: ['https://app.egodact.com/*'], js: ['sdk.js', 'lib.js', 'content.js'], run_at: 'document_idle' }]
    };
    root.querySelector('#egd-dev-starter-manifest').value = JSON.stringify(manifest, null, 2);
    var safeId = JSON.stringify(id);
    var safeName = JSON.stringify(name);
    var content = [
      '(function () {',
      '  "use strict";',
      '  var client = window.EgodactAddonClient;',
      '  if (!client) return;',
      '  var addonId = ' + safeId + ';',
      '  client.registerAddon({ id: addonId, name: ' + safeName + ', version: "1.0.0", description: "An add-on for Egodact." });',
      '  client.registerHamburger({ addonId: addonId, id: addonId + "-menu", title: ' + safeName + ' });',
      '  client.onOpen(addonId + "-menu", function () {',
      '    client.openModal(' + safeName + ', "<p>Your Egodact add-on is ready.</p>");',
      '  });',
      '})();',
      ''
    ].join('\n');
    root.querySelector('#egd-dev-starter-content').value = content;
  }

  function generateSnippet(root) {
    var select = root.querySelector('#egd-dev-snippet');
    var out = root.querySelector('#egd-dev-snippet-code');
    if (!select || !out) return;
    var id = slug(root.querySelector('#egd-dev-addon-id').value) || 'my-egodact-addon';
    var name = root.querySelector('#egd-dev-addon-name').value.trim() || 'My Egodact Add-on';
    out.value = snippetFor(select.value, id, name);
  }

  function snippetFor(kind, id, name) {
    var idJs = JSON.stringify(id);
    var nameJs = JSON.stringify(name);
    var head = '  var addonId = ' + idJs + ';\n';
    var snippets = {
      hamburger:
        head +
        '  client.registerHamburger({\n' +
        '    addonId: addonId,\n' +
        '    id: addonId + "-menu",\n' +
        '    title: ' + nameJs + ',\n' +
        '    icon: "<svg viewBox=\'0 0 24 24\' width=\'18\' height=\'18\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\'><circle cx=\'12\' cy=\'12\' r=\'9\'/></svg>",\n' +
        '    order: "50"\n' +
        '  });\n' +
        '  client.onOpen(addonId + "-menu", function () {\n' +
        '    client.openModal(' + nameJs + ', "<p>Hallo!</p>");\n' +
        '  });',
      button:
        head +
        '  client.registerButton({\n' +
        '    addonId: addonId,\n' +
        '    id: addonId + "-button",\n' +
        '    title: ' + nameJs + ',\n' +
        '    position: "header",\n' +
        '    icon: "<svg viewBox=\'0 0 24 24\' width=\'22\' height=\'22\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\'><circle cx=\'12\' cy=\'12\' r=\'9\'/></svg>"\n' +
        '  });\n' +
        '  client.onOpen(addonId + "-button", function () {\n' +
        '    client.toast(' + nameJs + ' + " geopend");\n' +
        '  });',
      game:
        head +
        '  client.registerGame({\n' +
        '    addonId: addonId,\n' +
        '    id: addonId + "-game",\n' +
        '    title: ' + nameJs + ',\n' +
        '    description: "Klein spelletje.",\n' +
        '    icon: "<svg viewBox=\'0 0 24 24\' width=\'22\' height=\'22\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\'><rect x=\'3\' y=\'7\' width=\'18\' height=\'10\' rx=\'4\'/></svg>"\n' +
        '  });',
      modal:
        head +
        '  function openPanel() {\n' +
        '    var body = document.createElement("div");\n' +
        '    body.textContent = "Hallo vanuit " + ' + nameJs + ' + ".";\n' +
        '    client.openModal(' + nameJs + ', body);\n' +
        '  }\n' +
        '  client.onOpen(addonId + "-menu", openPanel);\n' +
        '  client.toast("Klaar");',
      storage:
        head +
        '  var store = client.storage(addonId);\n' +
        '  var count = store.get("opens", 0) + 1;\n' +
        '  store.set("opens", count);\n' +
        '  client.toast("Deze add-on is " + count + "x geopend");',
      shortcut:
        head +
        '  client.registerShortcut({\n' +
        '    addonId: addonId,\n' +
        '    id: addonId + "-open",\n' +
        '    title: ' + nameJs + ' + " openen",\n' +
        '    keys: "f8",\n' +
        '    scope: "global"\n' +
        '  });\n' +
        '  client.onShortcut(addonId + "-open", function () {\n' +
        '    client.toast("Sneltoets werkt");\n' +
        '  });',
      challenges:
        head +
        '  if (typeof client.getChallenges === "function") {\n' +
        '    client.getChallenges(true).then(function (list) {\n' +
        '      client.toast(list.length + " challenges geladen");\n' +
        '    });\n' +
        '  } else {\n' +
        '    client.toast("Deze SDK heeft getChallenges niet", { type: "error" });\n' +
        '  }'
    };
    return snippets[kind] || snippets.hamburger;
  }

  // ------------------------------------------------------------
  // helpers
  // ------------------------------------------------------------
  function redact(value, depth) {
    depth = depth || 0;
    if (depth > 5) return '[depth limit]';
    if (value === null || typeof value === 'undefined') return value;
    if (typeof value === 'string') return redactText(value);
    if (typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.slice(0, 30).map(function (item) { return redact(item, depth + 1); });
    var out = {};
    Object.keys(value).slice(0, 40).forEach(function (key) {
      if (/password|token|secret|cookie|authorization|credential|email/i.test(key)) {
        out[key] = '[redacted]';
      } else {
        try { out[key] = redact(value[key], depth + 1); } catch (error) { out[key] = '[unavailable]'; }
      }
    });
    return out;
  }

  function redactText(value) {
    return String(value).replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
      .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]')
      .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[token]');
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function slug(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  }

  function copyText(text, successMessage) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        notify(successMessage, 'success');
      }).catch(function () { notify('Clipboard access was blocked.', 'error'); });
    } else {
      notify('Clipboard is unavailable in this browser.', 'error');
    }
  }
})();
