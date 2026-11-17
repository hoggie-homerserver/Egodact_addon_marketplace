(function () {
  'use strict';

  var client = window.EgodactAddonClient;
  var L = window.EgodactAddonLib;
  var cfg = (window.EgodactDeveloperConfig || {}).firebase || {};
  if (!client || !L) return;

  var ADDON_ID = 'egodact-developer-tools';
  var MENU_ID = ADDON_ID + '-menu';
  var BUTTON_ID = ADDON_ID + '-button';
  var auth = null;
  var authReady = null;
  var currentUser = null;
  var events = [];
  var activeBackdrop = null;
  var eventsHooked = false;

  client.registerAddon({
    id: ADDON_ID,
    name: 'Egodact Developer Tools',
    version: '0.1.0',
    description: 'Tools for building, checking, and debugging Egodact add-ons.',
    author: 'Egodact Marketplace'
  });
  client.registerMenu({ addonId: ADDON_ID, id: MENU_ID, title: 'Developer Tools', icon: '🛠️' });
  client.registerButton({ addonId: ADDON_ID, id: BUTTON_ID, title: 'Developer Tools', icon: '🛠️', position: 'header' });
  client.onOpen(MENU_ID, openTools);
  client.onOpen(BUTTON_ID, openTools);

  function initAuth() {
    if (authReady) return authReady;
    authReady = Promise.resolve().then(function () {
      if (!window.firebase || !cfg.apiKey || !cfg.projectId) throw new Error('Marketplace login is not configured.');
      var name = 'egodact-developer-tools';
      var app = window.firebase.apps.find(function (item) { return item.name === name; });
      app = app || window.firebase.initializeApp(cfg, name);
      auth = window.firebase.auth(app);
      return new Promise(function (resolve) {
        var firstState = true;
        auth.onAuthStateChanged(function (user) {
          currentUser = user || null;
          if (firstState) {
            firstState = false;
            resolve(auth);
          }
          var root = activeBackdrop && activeBackdrop.querySelector('#egd-dev-root');
          if (root) renderAuth(root);
        }, function () {
          if (firstState) {
            firstState = false;
            resolve(auth);
          }
        });
      });
    });
    return authReady;
  }

  function shellHtml() {
    return '<div id="egd-dev-root" style="font-family:Arial,sans-serif;min-height:380px;">' +
      '<div id="egd-dev-auth" style="display:none;"></div>' +
      '<div id="egd-dev-workspace" style="display:none;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 12px;">' +
          '<span id="egd-dev-user" style="font-size:12px;opacity:.75;"></span>' +
          '<button id="egd-dev-signout" type="button" style="padding:6px 10px;">Sign out</button>' +
        '</div>' +
        '<nav id="egd-dev-tabs" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">' +
          '<button type="button" data-tab="events">Live events</button>' +
          '<button type="button" data-tab="validate">Validate add-on</button>' +
          '<button type="button" data-tab="starter">Starter kit</button>' +
        '</nav>' +
        '<section data-panel="events" style="display:none;">' +
          '<p style="font-size:12px;opacity:.75;margin:0 0 8px;">Events are captured from this page session after Developer Tools loads. Sensitive field names are redacted.</p>' +
          '<div style="display:flex;gap:8px;margin-bottom:8px;"><button id="egd-dev-clear" type="button">Clear log</button><span id="egd-dev-event-count" style="font-size:12px;align-self:center;"></span></div>' +
          '<div id="egd-dev-event-list" style="max-height:300px;overflow:auto;display:flex;flex-direction:column;gap:6px;"></div>' +
        '</section>' +
        '<section data-panel="validate" style="display:none;">' +
          '<p style="font-size:12px;opacity:.75;margin:0 0 8px;">Paste the manifest and the files that will be in your add-on folder.</p>' +
          '<label style="display:block;font-size:12px;margin:8px 0 4px;">manifest.json</label>' +
          '<textarea id="egd-dev-manifest" spellcheck="false" style="width:100%;height:180px;box-sizing:border-box;font:12px Consolas,monospace;"></textarea>' +
          '<label style="display:block;font-size:12px;margin:8px 0 4px;">Files (one path per line)</label>' +
          '<textarea id="egd-dev-files" spellcheck="false" style="width:100%;height:80px;box-sizing:border-box;font:12px Consolas,monospace;"></textarea>' +
          '<button id="egd-dev-run-validation" type="button" style="margin-top:8px;">Check add-on</button>' +
          '<div id="egd-dev-validation-result" aria-live="polite" style="margin-top:10px;display:flex;flex-direction:column;gap:5px;"></div>' +
        '</section>' +
        '<section data-panel="starter" style="display:none;">' +
          '<p style="font-size:12px;opacity:.75;margin:0 0 8px;">Generate a small, working SDK add-on starter. Copy each file into your project.</p>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">' +
            '<label style="font-size:12px;">Name <input id="egd-dev-addon-name" value="My Egodact Add-on" style="padding:6px;"></label>' +
            '<label style="font-size:12px;">ID <input id="egd-dev-addon-id" value="my-egodact-addon" style="padding:6px;"></label>' +
            '<button id="egd-dev-generate" type="button">Generate</button>' +
          '</div>' +
          '<label style="display:block;font-size:12px;margin:8px 0 4px;">manifest.json</label>' +
          '<textarea id="egd-dev-starter-manifest" spellcheck="false" style="width:100%;height:150px;box-sizing:border-box;font:12px Consolas,monospace;"></textarea>' +
          '<button id="egd-dev-copy-manifest" type="button" style="margin-top:5px;">Copy manifest</button>' +
          '<label style="display:block;font-size:12px;margin:10px 0 4px;">content.js</label>' +
          '<textarea id="egd-dev-starter-content" spellcheck="false" style="width:100%;height:230px;box-sizing:border-box;font:12px Consolas,monospace;"></textarea>' +
          '<button id="egd-dev-copy-content" type="button" style="margin-top:5px;">Copy content.js</button>' +
        '</section>' +
      '</div>' +
    '</div>';
  }

  function openTools() {
    if (activeBackdrop && document.body.contains(activeBackdrop)) return;
    activeBackdrop = client.openModal('Egodact Developer Tools', shellHtml());
    var root = activeBackdrop && activeBackdrop.querySelector('#egd-dev-root');
    if (!root) return;
    bindWorkspace(root);
    initAuth().then(function () { renderAuth(root); }).catch(function (error) {
      showAuthError(root, error && error.message ? error.message : 'Could not connect to marketplace login.');
    });
  }

  function bindWorkspace(root) {
    root.querySelectorAll('#egd-dev-tabs button').forEach(function (button) {
      button.addEventListener('click', function () { showPanel(root, button.getAttribute('data-tab')); });
    });
    root.querySelector('#egd-dev-signout').addEventListener('click', function () {
      if (auth) auth.signOut();
    });
    root.querySelector('#egd-dev-clear').addEventListener('click', function () {
      events = [];
      renderEvents(root);
    });
    root.querySelector('#egd-dev-run-validation').addEventListener('click', function () { validateAddon(root); });
    root.querySelector('#egd-dev-generate').addEventListener('click', function () { generateStarter(root); });
    root.querySelector('#egd-dev-copy-manifest').addEventListener('click', function () {
      copyText(root.querySelector('#egd-dev-starter-manifest').value, 'Manifest copied.');
    });
    root.querySelector('#egd-dev-copy-content').addEventListener('click', function () {
      copyText(root.querySelector('#egd-dev-starter-content').value, 'content.js copied.');
    });
    root.querySelector('#egd-dev-addon-id').addEventListener('input', function (event) {
      event.target.value = slug(event.target.value);
    });
    root.querySelector('#egd-dev-addon-name').addEventListener('input', function () { generateStarter(root); });
    root.querySelector('#egd-dev-addon-id').addEventListener('change', function () { generateStarter(root); });
  }

  function renderAuth(root) {
    var authPanel = root.querySelector('#egd-dev-auth');
    var workspace = root.querySelector('#egd-dev-workspace');
    if (!currentUser) {
      workspace.style.display = 'none';
      authPanel.style.display = 'block';
      authPanel.innerHTML =
        '<h3 style="margin:0 0 6px;">Sign in with your marketplace developer account</h3>' +
        '<p style="font-size:12px;opacity:.75;">The tools are available to signed-in Developer Portal accounts.</p>' +
        '<label style="display:block;font-size:12px;margin:8px 0 4px;">Email</label><input id="egd-dev-email" type="email" autocomplete="email" style="width:100%;box-sizing:border-box;padding:8px;">' +
        '<label style="display:block;font-size:12px;margin:8px 0 4px;">Password</label><input id="egd-dev-password" type="password" autocomplete="current-password" style="width:100%;box-sizing:border-box;padding:8px;">' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;"><button id="egd-dev-login" type="button">Sign in</button><button id="egd-dev-google" type="button">Continue with Google</button></div>' +
        '<div id="egd-dev-auth-error" role="alert" style="color:#e57373;font-size:12px;margin-top:8px;"></div>' +
        '<p style="font-size:12px;margin-top:10px;">Need an account? <a href="https://hoggie-homerserver.github.io/Egodact_addon_marketplace/portal.html" target="_blank" rel="noopener">Create one in the Developer Portal</a>.</p>';
      root.querySelector('#egd-dev-login').addEventListener('click', function () {
        var email = root.querySelector('#egd-dev-email').value.trim();
        var password = root.querySelector('#egd-dev-password').value;
        auth.signInWithEmailAndPassword(email, password).catch(function (error) { showAuthError(root, authError(error)); });
      });
      root.querySelector('#egd-dev-google').addEventListener('click', function () {
        auth.signInWithPopup(new window.firebase.auth.GoogleAuthProvider()).catch(function (error) { showAuthError(root, authError(error)); });
      });
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

  function authError(error) {
    var code = error && error.code;
    if (code === 'auth/invalid-email') return 'Enter a valid email address.';
    if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') return 'Email or password did not match.';
    if (code === 'auth/popup-blocked') return 'Allow the sign-in popup and try again.';
    return (error && error.message) || 'Sign-in failed.';
  }

  function showPanel(root, name) {
    root.querySelectorAll('[data-panel]').forEach(function (panel) {
      panel.style.display = panel.getAttribute('data-panel') === name ? 'block' : 'none';
    });
    root.querySelectorAll('#egd-dev-tabs button').forEach(function (button) {
      button.style.fontWeight = button.getAttribute('data-tab') === name ? 'bold' : 'normal';
    });
    if (name === 'events') renderEvents(root);
  }

  function hookEvents() {
    if (eventsHooked) return;
    eventsHooked = true;
    [
      'egodact:host:ready',
      'egodact:addon:register',
      'egodact:addon:open',
      'egodact:theme:changed',
      'egodact:addons:changed'
    ].forEach(function (eventName) {
      document.addEventListener(eventName, function (event) {
        var detail = event && event.detail;
        var safe = redact(detail);
        pushEvent(eventName, safe);
      }, true);
    });
    window.addEventListener('error', function (event) {
      pushEvent('runtime error', {
        message: redactText(event.message || 'Script error'),
        file: redactText(event.filename || ''),
        line: event.lineno || 0
      });
    });
    window.addEventListener('unhandledrejection', function (event) {
      pushEvent('unhandled rejection', { reason: redact(event.reason) });
    });
  }

  function pushEvent(name, detail) {
    events.unshift({ time: new Date().toLocaleTimeString(), name: name, detail: detail });
    if (events.length > 250) events.length = 250;
    var root = activeBackdrop && activeBackdrop.querySelector('#egd-dev-root');
    if (root && root.querySelector('[data-panel="events"]') && root.querySelector('[data-panel="events"]').style.display !== 'none') renderEvents(root);
  }

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

  function renderEvents(root) {
    var list = root.querySelector('#egd-dev-event-list');
    var count = root.querySelector('#egd-dev-event-count');
    count.textContent = events.length + ' event' + (events.length === 1 ? '' : 's');
    list.textContent = '';
    if (!events.length) {
      var empty = document.createElement('div');
      empty.textContent = 'Waiting for SDK events. Open a menu or reload an add-on to create activity.';
      empty.style.cssText = 'padding:14px;border:1px dashed #777;border-radius:6px;font-size:12px;opacity:.75;';
      list.appendChild(empty);
      return;
    }
    events.forEach(function (item) {
      var card = document.createElement('div');
      card.style.cssText = 'padding:8px;border:1px solid rgba(127,127,127,.35);border-radius:6px;font-size:12px;';
      var head = document.createElement('div');
      head.style.cssText = 'display:flex;justify-content:space-between;gap:8px;font-weight:bold;margin-bottom:4px;';
      var name = document.createElement('span');
      name.textContent = item.name;
      var time = document.createElement('span');
      time.textContent = item.time;
      time.style.opacity = '.65';
      head.appendChild(name);
      head.appendChild(time);
      card.appendChild(head);
      if (typeof item.detail !== 'undefined') {
        var body = document.createElement('pre');
        body.textContent = JSON.stringify(item.detail, null, 2);
        body.style.cssText = 'white-space:pre-wrap;word-break:break-word;margin:0;font:11px Consolas,monospace;';
        card.appendChild(body);
      }
      list.appendChild(card);
    });
  }

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

  function generateStarter(root) {
    var name = root.querySelector('#egd-dev-addon-name').value.trim() || 'My Egodact Add-on';
    var id = slug(root.querySelector('#egd-dev-addon-id').value) || 'my-egodact-addon';
    root.querySelector('#egd-dev-addon-id').value = id;
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
      '  client.registerMenu({ addonId: addonId, id: addonId + "-menu", title: ' + safeName + ' });',
      '  client.onOpen(addonId + "-menu", function () {',
      '    client.openModal(' + safeName + ', "<p>Your Egodact add-on is ready.</p>");',
      '  });',
      '})();',
      ''
    ].join('\n');
    root.querySelector('#egd-dev-starter-content').value = content;
  }

  function slug(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  }

  function copyText(text, successMessage) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        client.toast(successMessage, { type: 'success' });
      }).catch(function () { client.toast('Clipboard access was blocked.', { type: 'error' }); });
    } else {
      client.toast('Clipboard is unavailable in this browser.', { type: 'error' });
    }
  }
})();
