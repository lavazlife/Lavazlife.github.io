/**
 * style-forge.js — Gemini 2.5 Flash Vision analysis of uploaded images
 */

const GEMINI_VISION_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent';

const DEFAULT_VISION_PROMPT =
  'Analyze this image in detail. Describe: 1) overall visual style and aesthetic, ' +
  '2) colour palette and mood, 3) key design elements and composition, ' +
  '4) potential use-cases for creative projects. Be concise and insightful.';

export class StyleForgeModule {
  constructor(store) {
    this.store = store;
    this.imageDataUrl = null;
    this._bindDOM();
  }

  _bindDOM() {
    this.elImageInput  = document.getElementById('sf-image-input');
    this.elPreview     = document.getElementById('sf-preview');
    this.elPrompt      = document.getElementById('sf-prompt');
    this.elResult      = document.getElementById('sf-result');
    this.elInsertBtn   = document.getElementById('btn-sf-insert');
    this.elStatus      = document.getElementById('sf-status');
    this.elAnalyzeBtn  = document.getElementById('btn-sf-analyze');

    this.elImageInput.addEventListener('change', (e) => this._onImagePick(e));
    this.elAnalyzeBtn.addEventListener('click', () => this.analyze());
    this.elInsertBtn.addEventListener('click', () => this._insertIntoNote());
  }

  /* ── Image pick & preview ─────────────────────────────────── */
  _onImagePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      this.imageDataUrl = ev.target.result;
      this.elPreview.src = this.imageDataUrl;
      this.elPreview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  /* ── Gemini Vision call ───────────────────────────────────── */
  async analyze() {
    const apiKey = this.store.geminiKey;
    if (!apiKey) {
      this._setStatus('⚠ Set your Gemini API key in Settings first.', 'error');
      window.app?.openSettings();
      return;
    }
    if (!this.imageDataUrl) {
      this._setStatus('⚠ Please select an image first.', 'error');
      return;
    }

    const promptText = this.elPrompt.value.trim() || DEFAULT_VISION_PROMPT;
    this._setStatus('Analyzing…');
    this.elAnalyzeBtn.disabled = true;

    // Convert data-URL to base64 + mime
    const [meta, b64] = this.imageDataUrl.split(',');
    const mimeMatch   = meta.match(/data:([^;]+)/);
    const mimeType    = mimeMatch ? mimeMatch[1] : 'image/jpeg';

    const body = {
      contents: [{
        parts: [
          { text: promptText },
          { inline_data: { mime_type: mimeType, data: b64 } }
        ]
      }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    };

    try {
      const res = await fetch(`${GEMINI_VISION_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '(no response)';

      this.elResult.innerHTML = `<span class="text-white/85">${this._escHtml(text)}</span>`;
      this.elInsertBtn.classList.remove('hidden');
      this._lastResult = text;
      this._setStatus('Analysis complete.', 'ok');

      // Save to assets
      if (this.imageDataUrl) {
        this.store.assetsModule?.addAsset({
          type: 'vision',
          dataUrl: this.imageDataUrl,
          caption: text.slice(0, 80)
        });
      }
    } catch (err) {
      this._setStatus('Error: ' + err.message, 'error');
    } finally {
      this.elAnalyzeBtn.disabled = false;
    }
  }

  _insertIntoNote() {
    if (this._lastResult) {
      this.store.workspaceModule?.insertText(this._lastResult);
      this._setStatus('Inserted into note.', 'ok');
    }
  }

  _setStatus(msg, type = '') {
    this.elStatus.textContent = msg;
    this.elStatus.className = 'status-bar' + (type ? ' ' + type : '');
    if (type === 'ok') setTimeout(() => { this.elStatus.textContent = ''; }, 3000);
  }

  _escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/\n/g, '<br/>');
  }
}
