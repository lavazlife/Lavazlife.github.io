/**
 * app.js — main application bootstrap
 * Initialises all modules, handles tab routing, settings, image modal
 */

import { WorkspaceModule }        from './modules/workspace.js';
import { StyleForgeModule }       from './modules/style-forge.js';
import { PromptCrafterModule }    from './modules/prompt-crafter.js';
import { TypographyStudioModule } from './modules/typography-studio.js';
import { AssetsModule }           from './modules/assets.js';

/* ── Shared store ─────────────────────────────────────────────── */
const store = {
  geminiKey:       '',
  firebaseDb:      null,
  workspaceModule: null,
  assetsModule:    null
};

/* ── Settings persistence ─────────────────────────────────────── */
const SETTINGS_KEY = 'lavaz_settings';

async function loadSettings() {
  try {
    const saved = await localforage.getItem(SETTINGS_KEY);
    if (saved) Object.assign(store, saved);
  } catch { /* ignore */ }
}

async function saveSettings() {
  try {
    await localforage.setItem(SETTINGS_KEY, {
      geminiKey:    store.geminiKey,
      firebaseJson: store.firebaseJson || ''
    });
  } catch { /* ignore */ }
}

/* ── Firebase initialisation ──────────────────────────────────── */
function initFirebase(jsonStr) {
  if (!jsonStr) return;
  try {
    const config = JSON.parse(jsonStr);
    if (!config.apiKey) throw new Error('Missing apiKey');

    // Avoid double-init
    if (firebase.apps.length) {
      firebase.app().delete().then(() => _initFB(config));
    } else {
      _initFB(config);
    }
  } catch (err) {
    console.warn('Firebase init failed:', err.message);
  }
}

function _initFB(config) {
  try {
    firebase.initializeApp(config);
    store.firebaseDb = firebase.firestore();
    console.info('Firebase ready.');
  } catch (err) {
    console.warn('Firebase init error:', err.message);
  }
}

/* ── Tab routing ──────────────────────────────────────────────── */
const TAB_IDS = ['workspace', 'styleforge', 'crafter', 'studio', 'assets'];

function switchTab(tabId) {
  TAB_IDS.forEach(id => {
    document.getElementById(`tab-${id}`)?.classList.toggle('active', id === tabId);
  });
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
}

/* ── Settings modal ───────────────────────────────────────────── */
function openSettings() {
  const modal = document.getElementById('settings-modal');
  document.getElementById('setting-gemini-key').value  = store.geminiKey || '';
  document.getElementById('setting-fb-json').value     = store.firebaseJson || '';
  modal.style.display = 'flex';
}

function closeSettings() {
  document.getElementById('settings-modal').style.display = 'none';
}

function bindSettings() {
  document.getElementById('btn-settings-close').addEventListener('click', closeSettings);
  document.getElementById('btn-settings-save').addEventListener('click', async () => {
    store.geminiKey   = document.getElementById('setting-gemini-key').value.trim();
    store.firebaseJson = document.getElementById('setting-fb-json').value.trim();
    await saveSettings();
    if (store.firebaseJson) initFirebase(store.firebaseJson);
    closeSettings();
  });
  // Open on long-press of app title (fallback: shake tap × 5 handled by nav hidden button)
  // Also reachable by tapping the header title if one exists
}

/* ── Image modal ──────────────────────────────────────────────── */
let _modalImageDataUrl = null;
let _modalImageCaption = null;

function openImageModal(dataUrl, caption) {
  _modalImageDataUrl = dataUrl;
  _modalImageCaption = caption;
  const modal = document.getElementById('image-modal');
  document.getElementById('image-modal-img').src = dataUrl;
  modal.style.display = 'flex';
}

function closeImageModal() {
  document.getElementById('image-modal').style.display = 'none';
  _modalImageDataUrl = null;
}

function bindImageModal() {
  document.getElementById('btn-modal-insert').addEventListener('click', () => {
    if (_modalImageDataUrl) {
      store.workspaceModule?.insertImage(_modalImageDataUrl);
      closeImageModal();
      switchTab('workspace');
    }
  });
  document.getElementById('btn-modal-download').addEventListener('click', () => {
    if (!_modalImageDataUrl) return;
    const ext  = _modalImageDataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
    const name = (String(_modalImageCaption || 'lavaz').replace(/[^a-z0-9_-]/gi, '_').slice(0, 40)) + '.' + ext;
    const a = document.createElement('a');
    a.href = _modalImageDataUrl;
    a.download = name;
    a.click();
  });
}

/* ── Capacitor detection ──────────────────────────────────────── */
async function tryLoadCapacitor() {
  try {
    // Capacitor injects window.Capacitor at runtime in native context
    if (window.Capacitor?.isNativePlatform()) {
      console.info('Running in native Capacitor context.');
    }
  } catch { /* web-only mode */ }
}

/* ── Secret settings trigger: tap title 5× ───────────────────── */
function bindTitleTap() {
  let tapCount = 0;
  let tapTimer = null;
  // Use the top-left title in the Workspace tab as the trigger
  document.getElementById('tab-workspace')?.addEventListener('click', (e) => {
    if (!e.target.closest('h1')) return;
    tapCount++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { tapCount = 0; }, 1500);
    if (tapCount >= 5) {
      tapCount = 0;
      openSettings();
    }
  });
}

/* ── Bootstrap ────────────────────────────────────────────────── */
async function init() {
  await tryLoadCapacitor();
  await loadSettings();

  // Initialise Firebase if config was previously saved
  if (store.firebaseJson) initFirebase(store.firebaseJson);

  // Boot modules in dependency order
  store.assetsModule    = new AssetsModule(store);
  store.workspaceModule = new WorkspaceModule(store);
  const styleForge      = new StyleForgeModule(store);       // eslint-disable-line no-unused-vars
  const promptCrafter   = new PromptCrafterModule(store);    // eslint-disable-line no-unused-vars
  const typographyStudio= new TypographyStudioModule(store); // eslint-disable-line no-unused-vars

  // Wire navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Wire settings & modals
  bindSettings();
  bindImageModal();
  bindTitleTap();

  // Expose public API on window for inline event handlers
  window.app = {
    switchTab,
    openSettings,
    closeSettings,
    openImageModal,
    closeImageModal
  };

  // If no API key set, show settings on first launch
  if (!store.geminiKey) {
    setTimeout(openSettings, 800);
  }

  console.info('LavazLife app ready.');
}

// Wait for DOM + CDN scripts to be available
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
