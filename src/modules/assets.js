/**
 * assets.js — manages saved images (typography + vision outputs)
 * Allows filtering, insertion into active note, or device download
 */

const ASSETS_KEY = 'lavaz_assets';
const MAX_ASSETS = 200;

export class AssetsModule {
  constructor(store) {
    this.store  = store;
    this.assets = [];
    this.filter = 'all';
    this._bindDOM();
    this._loadAssets();
  }

  _bindDOM() {
    this.elGrid    = document.getElementById('assets-grid');
    this.elEmpty   = document.getElementById('assets-empty');
    this.elStatus  = document.getElementById('assets-status');

    document.getElementById('btn-assets-clear').addEventListener('click', () => this._clearAll());

    document.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active-filter'));
        btn.classList.add('active-filter');
        this.filter = btn.dataset.filter;
        this._renderGrid();
      });
    });
  }

  /* ── Public API ─────────────────────────────────────────────── */
  addAsset({ type, dataUrl, caption = '' }) {
    const asset = {
      id:        'asset_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      type,      // 'typography' | 'vision'
      dataUrl,
      caption,
      savedAt:   Date.now()
    };
    this.assets.unshift(asset);
    if (this.assets.length > MAX_ASSETS) this.assets.splice(MAX_ASSETS);
    this._persistAssets();
    this._renderGrid();
    return asset.id;
  }

  removeAsset(id) {
    this.assets = this.assets.filter(a => a.id !== id);
    this._persistAssets();
    this._renderGrid();
  }

  /* ── Persistence ────────────────────────────────────────────── */
  async _loadAssets() {
    try {
      const saved = await localforage.getItem(ASSETS_KEY);
      this.assets = Array.isArray(saved) ? saved : [];
    } catch {
      this.assets = [];
    }
    this._renderGrid();
  }

  async _persistAssets() {
    try {
      await localforage.setItem(ASSETS_KEY, this.assets);
    } catch (err) {
      console.warn('Assets persist failed:', err.message);
    }
  }

  /* ── Grid rendering ─────────────────────────────────────────── */
  _renderGrid() {
    const filtered = this.filter === 'all'
      ? this.assets
      : this.assets.filter(a => a.type === this.filter);

    this.elGrid.innerHTML = '';
    if (!filtered.length) {
      this.elEmpty.style.display = '';
      return;
    }
    this.elEmpty.style.display = 'none';

    filtered.forEach(asset => {
      const thumb = document.createElement('div');
      thumb.className = 'asset-thumb';
      thumb.innerHTML = `
        <img src="${asset.dataUrl}" alt="${this._escHtml(asset.caption)}" loading="lazy" />
        <div class="asset-overlay">
          <button class="batch-action-btn" title="Insert into note"  data-id="${asset.id}" data-action="insert">📝</button>
          <button class="batch-action-btn" title="Download"          data-id="${asset.id}" data-action="download">⬇</button>
          <button class="batch-action-btn" title="Delete"            data-id="${asset.id}" data-action="delete" style="color:#ff6b6b;">✕</button>
        </div>`;

      thumb.addEventListener('click', () => window.app?.openImageModal(asset.dataUrl, asset.caption));

      thumb.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._handleAction(btn.dataset.action, asset);
        });
      });

      this.elGrid.appendChild(thumb);
    });
  }

  _handleAction(action, asset) {
    switch (action) {
      case 'insert':
        this.store.workspaceModule?.insertImage(asset.dataUrl);
        this._setStatus('Image inserted into note.', 'ok');
        window.app?.switchTab('workspace');
        break;
      case 'download':
        this._download(asset);
        break;
      case 'delete':
        this.removeAsset(asset.id);
        this._setStatus('Asset removed.', 'ok');
        break;
    }
  }

  _download(asset) {
    const ext  = asset.dataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
    const name = (asset.caption || 'lavaz-asset').replace(/[^a-z0-9_-]/gi, '_').slice(0, 40) + '.' + ext;
    const a = document.createElement('a');
    a.href = asset.dataUrl;
    a.download = name;
    a.click();
  }

  _clearAll() {
    if (!confirm('Delete all saved assets?')) return;
    this.assets = [];
    this._persistAssets();
    this._renderGrid();
    this._setStatus('All assets cleared.', 'ok');
  }

  _setStatus(msg, type = '') {
    this.elStatus.textContent = msg;
    this.elStatus.className = 'status-bar' + (type ? ' ' + type : '');
    if (type === 'ok') setTimeout(() => { this.elStatus.textContent = ''; }, 3000);
  }

  _escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
