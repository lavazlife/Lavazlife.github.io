/**
 * typography-studio.js — Imagen 4.0 3D text generation with A/B/C/D batch rendering
 * Default target text: RUSS
 */

const IMAGEN_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-exp-05-20:predict';

const GEMINI_TEXT_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent';

const BATCH_SLOTS = ['a', 'b', 'c', 'd'];

/** Build an Imagen prompt for one batch variant */
function buildImagenPrompt(targetText, baseStyle, variant) {
  const variantMods = {
    a: 'straight-on front view, symmetrical composition, dramatic centre lighting',
    b: 'slight left angle, depth perspective, rim lighting from the right',
    c: 'slight right angle, depth perspective, rim lighting from the left',
    d: 'dynamic three-quarter view, strong depth of field, atmospheric haze'
  };
  return `Photorealistic, ultra-high quality 3D render: the text "${targetText}" styled as ${baseStyle}. ` +
    `Composition: ${variantMods[variant]}. ` +
    `The letters are the clear focal point, no other words or watermarks. ` +
    `8K resolution, sharp details, professional CGI lighting.`;
}

export class TypographyStudioModule {
  constructor(store) {
    this.store = store;
    this.batchImages = { a: null, b: null, c: null, d: null };
    this._bindDOM();
  }

  _bindDOM() {
    this.elText            = document.getElementById('td-text');
    this.elStyle           = document.getElementById('td-style');
    this.elCustomWrap      = document.getElementById('td-custom-wrap');
    this.elCustomStyle     = document.getElementById('td-custom-style');
    this.elBrainstormInput = document.getElementById('td-brainstorm-input');
    this.elBrainstormResult= document.getElementById('td-brainstorm-result');
    this.elProgress        = document.getElementById('td-progress');
    this.elProgressText    = document.getElementById('td-progress-text');
    this.elStatus          = document.getElementById('td-status');

    this.elStyle.addEventListener('change', () => {
      const isCustom = this.elStyle.value === 'custom';
      this.elCustomWrap.classList.toggle('hidden', !isCustom);
    });

    document.getElementById('btn-td-brainstorm').addEventListener('click', () => this._brainstorm());
    document.getElementById('btn-td-auto-idea') .addEventListener('click', () => this._autoIdea());
    document.getElementById('btn-td-render')    .addEventListener('click', () => this._batchRender());
    document.getElementById('btn-td-single')    .addEventListener('click', () => this._singleRender());
  }

  /* ── Style helpers ──────────────────────────────────────────── */
  _getStyle() {
    return this.elStyle.value === 'custom'
      ? (this.elCustomStyle.value.trim() || 'neon glowing 3D chrome lettering on dark background')
      : this.elStyle.value;
  }

  _getTargetText() {
    return this.elText.value.trim() || 'RUSS';
  }

  /* ── AI Brainstorm ──────────────────────────────────────────── */
  async _brainstorm() {
    const apiKey = this.store.geminiKey;
    if (!apiKey) { this._setStatus('⚠ Set Gemini API key in Settings.', 'error'); window.app?.openSettings(); return; }

    const topic = this.elBrainstormInput.value.trim() || 'bold creative typography for the word ' + this._getTargetText();
    this._setStatus('Brainstorming…');

    const prompt = `Brainstorm 6 visually striking 3D typography style concepts for the topic: "${topic}".
For each style, provide a short name (3–5 words) and a one-line description of the visual treatment.
Format as a numbered list.`;

    try {
      const result = await this._geminiCall(prompt, apiKey);
      this.elBrainstormResult.textContent = result;
      this.elBrainstormResult.classList.remove('hidden');
      this._setStatus('Brainstorm complete.', 'ok');
    } catch (err) {
      this._setStatus('Error: ' + err.message, 'error');
    }
  }

  async _autoIdea() {
    const apiKey = this.store.geminiKey;
    if (!apiKey) { this._setStatus('⚠ Set Gemini API key first.', 'error'); window.app?.openSettings(); return; }

    this._setStatus('Generating style idea…');
    const prompt = 'Suggest one unique, visually spectacular 3D text style for the word "' +
      this._getTargetText() + '". Describe it in a single vivid sentence suitable for an image generator.';

    try {
      const idea = await this._geminiCall(prompt, apiKey);
      const trimmed = idea.trim().replace(/^["']|["']$/g, '');
      // Set as custom style
      this.elStyle.value = 'custom';
      this.elCustomWrap.classList.remove('hidden');
      this.elCustomStyle.value = trimmed;
      this._setStatus('Style idea applied.', 'ok');
    } catch (err) {
      this._setStatus('Error: ' + err.message, 'error');
    }
  }

  /* ── Imagen 4.0 single render ───────────────────────────────── */
  async _singleRender() {
    const apiKey = this.store.geminiKey;
    if (!apiKey) { this._setStatus('⚠ Set Gemini API key first.', 'error'); window.app?.openSettings(); return; }

    const text  = this._getTargetText();
    const style = this._getStyle();
    this._showProgress('Rendering single image…');

    try {
      const dataUrl = await this._imagenGenerate(
        buildImagenPrompt(text, style, 'a'),
        apiKey
      );
      this._setSlotImage('a', dataUrl);
      this._setStatus('Single render complete.', 'ok');
    } catch (err) {
      this._setStatus('Error: ' + err.message, 'error');
    } finally {
      this._hideProgress();
    }
  }

  /* ── Imagen 4.0 batch render (A B C D) ─────────────────────── */
  async _batchRender() {
    const apiKey = this.store.geminiKey;
    if (!apiKey) { this._setStatus('⚠ Set Gemini API key first.', 'error'); window.app?.openSettings(); return; }

    const text  = this._getTargetText();
    const style = this._getStyle();

    this._showProgress('Rendering A…');
    document.getElementById('btn-td-render').disabled = true;
    document.getElementById('btn-td-single').disabled = true;

    try {
      for (const slot of BATCH_SLOTS) {
        this._updateProgress(`Rendering ${slot.toUpperCase()}… (${BATCH_SLOTS.indexOf(slot) + 1}/${BATCH_SLOTS.length})`);
        const prompt = buildImagenPrompt(text, style, slot);
        try {
          const dataUrl = await this._imagenGenerate(prompt, apiKey);
          this._setSlotImage(slot, dataUrl);
        } catch (slotErr) {
          console.warn(`Slot ${slot} failed:`, slotErr.message);
          this._setSlotError(slot);
        }
      }
      this._setStatus('Batch render complete (A·B·C·D).', 'ok');
    } finally {
      this._hideProgress();
      document.getElementById('btn-td-render').disabled = false;
      document.getElementById('btn-td-single').disabled = false;
    }
  }

  /* ── Imagen API call ────────────────────────────────────────── */
  async _imagenGenerate(promptText, apiKey) {
    const body = {
      instances: [{ prompt: promptText }],
      parameters: {
        sampleCount: 1,
        aspectRatio: '1:1',
        safetyFilterLevel: 'block_some',
        personGeneration: 'allow_adult'
      }
    };

    const res = await fetch(`${IMAGEN_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e?.error?.message || `Imagen HTTP ${res.status}`);
    }

    const data = await res.json();
    const b64  = data?.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) throw new Error('No image data returned by Imagen API.');

    const mimeType = data?.predictions?.[0]?.mimeType || 'image/png';
    return `data:${mimeType};base64,${b64}`;
  }

  /* ── Gemini text call (brainstorm) ──────────────────────────── */
  async _geminiCall(prompt, apiKey) {
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 1024 }
    };
    const res = await fetch(`${GEMINI_TEXT_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e?.error?.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '(no response)';
  }

  /* ── Slot rendering ─────────────────────────────────────────── */
  _setSlotImage(slot, dataUrl) {
    const container = document.getElementById(`td-slot-${slot}`);
    if (!container) return;
    this.batchImages[slot] = dataUrl;

    container.innerHTML = `
      <span class="batch-label">${slot.toUpperCase()}</span>
      <img src="${dataUrl}" alt="Render ${slot.toUpperCase()}" loading="lazy" />
      <div class="batch-actions">
        <button class="batch-action-btn" data-slot="${slot}" data-action="insert">📝</button>
        <button class="batch-action-btn" data-slot="${slot}" data-action="download">⬇</button>
        <button class="batch-action-btn" data-slot="${slot}" data-action="expand">🔍</button>
      </div>`;

    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._handleSlotAction(btn.dataset.action, slot, dataUrl);
      });
    });

    container.addEventListener('click', () => window.app?.openImageModal(dataUrl, slot));

    // Save to assets
    this.store.assetsModule?.addAsset({
      type: 'typography',
      dataUrl,
      caption: `${this._getTargetText()} — ${slot.toUpperCase()}`
    });
  }

  _setSlotError(slot) {
    const container = document.getElementById(`td-slot-${slot}`);
    if (!container) return;
    container.innerHTML = `
      <span class="batch-label">${slot.toUpperCase()}</span>
      <div class="flex items-center justify-center h-full text-red-400/60 text-xs p-2 text-center">
        Generation failed. Tap Render to retry.
      </div>`;
  }

  _handleSlotAction(action, slot, dataUrl) {
    switch (action) {
      case 'insert':
        this.store.workspaceModule?.insertImage(dataUrl);
        this._setStatus(`Image ${slot.toUpperCase()} inserted into note.`, 'ok');
        window.app?.switchTab('workspace');
        break;
      case 'download':
        this._downloadImage(dataUrl, `lavaz-3d-${this._getTargetText()}-${slot}.png`);
        break;
      case 'expand':
        window.app?.openImageModal(dataUrl, slot);
        break;
    }
  }

  _downloadImage(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }

  /* ── Progress UI ────────────────────────────────────────────── */
  _showProgress(msg) {
    this.elProgress.classList.remove('hidden');
    this.elProgressText.textContent = msg;
  }
  _updateProgress(msg) { this.elProgressText.textContent = msg; }
  _hideProgress() { this.elProgress.classList.add('hidden'); }

  _setStatus(msg, type = '') {
    this.elStatus.textContent = msg;
    this.elStatus.className = 'status-bar' + (type ? ' ' + type : '');
    if (type === 'ok') setTimeout(() => { this.elStatus.textContent = ''; }, 4000);
  }
}
