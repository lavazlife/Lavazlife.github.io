/**
 * prompt-crafter.js — Gemini 2.5 Flash text prompt crafting tool
 */

const GEMINI_TEXT_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent';

const STYLE_CHIPS = [
  'Cinematic', 'Photorealistic', 'Anime', 'Watercolour', 'Oil Painting',
  'Neon Noir', 'Cyberpunk', 'Synthwave', 'Vaporwave', 'Dark Fantasy',
  'Minimalist', 'Abstract', 'Concept Art', 'Comic Book', 'Pixel Art',
  'Street Photography', 'Editorial', 'Futuristic', 'Surreal', 'Retro'
];

export class PromptCrafterModule {
  constructor(store) {
    this.store = store;
    this.selectedChips = new Set();
    this._lastOutput = '';
    this._bindDOM();
    this._renderChips();
  }

  _bindDOM() {
    this.elSubject    = document.getElementById('pc-subject');
    this.elOutput     = document.getElementById('pc-output');
    this.elCopyBtn    = document.getElementById('btn-pc-copy');
    this.elInsertBtn  = document.getElementById('btn-pc-insert');
    this.elTo3dBtn    = document.getElementById('btn-pc-to-3d');
    this.elStatus     = document.getElementById('pc-status');

    document.getElementById('btn-pc-craft')  .addEventListener('click', () => this._run('craft'));
    document.getElementById('btn-pc-expand') .addEventListener('click', () => this._run('expand'));
    document.getElementById('btn-pc-img')    .addEventListener('click', () => this._run('image'));
    document.getElementById('btn-pc-auto')   .addEventListener('click', () => this._autoIdea());

    this.elCopyBtn  .addEventListener('click', () => this._copy());
    this.elInsertBtn.addEventListener('click', () => this._insert());
    this.elTo3dBtn  .addEventListener('click', () => this._sendTo3D());
  }

  _renderChips() {
    const container = document.getElementById('pc-chips');
    STYLE_CHIPS.forEach(chip => {
      const el = document.createElement('span');
      el.className = 'prompt-chip';
      el.textContent = chip;
      el.addEventListener('click', () => {
        if (this.selectedChips.has(chip)) {
          this.selectedChips.delete(chip);
          el.style.boxShadow = '';
          el.style.background = '';
        } else {
          this.selectedChips.add(chip);
          el.style.background = 'rgba(191,0,255,0.3)';
          el.style.boxShadow = '0 0 8px rgba(191,0,255,0.5)';
        }
      });
      container.appendChild(el);
    });
  }

  /* ── Gemini prompts ─────────────────────────────────────────── */
  async _run(mode) {
    const apiKey = this.store.geminiKey;
    if (!apiKey) {
      this._setStatus('⚠ Set your Gemini API key in Settings.', 'error');
      window.app?.openSettings();
      return;
    }
    const subject = this.elSubject.value.trim();
    if (!subject) { this._setStatus('⚠ Enter a subject first.', 'error'); return; }

    const styleList = [...this.selectedChips].join(', ');
    let systemPrompt;

    switch (mode) {
      case 'craft':
        systemPrompt = `You are a professional AI prompt engineer. Craft 5 distinct, vivid image-generation prompts based on the subject below.
${styleList ? 'Incorporate these style tags: ' + styleList + '.' : ''}
Format as a numbered list. Each prompt should be 1–3 sentences, rich with descriptive detail.
Subject: ${subject}`;
        break;
      case 'expand':
        systemPrompt = `You are a creative writing assistant. Expand the following idea into 3 detailed creative directions, each with a unique angle.
${styleList ? 'Aesthetic styles to consider: ' + styleList + '.' : ''}
Idea: ${subject}`;
        break;
      case 'image':
        systemPrompt = `Generate 4 highly detailed, production-ready image prompts for an AI image generator.
${styleList ? 'Must use these styles: ' + styleList + '.' : 'Use a variety of complementary styles.'}
Concept: ${subject}
Format: numbered list, each prompt on its own line starting with the prompt text (no extra labels).`;
        break;
    }

    this._setStatus('Crafting…');
    this._setButtonsDisabled(true);

    try {
      const result = await this._geminiCall(systemPrompt, apiKey);
      this._lastOutput = result;
      this.elOutput.innerHTML = `<span class="text-white/85">${this._escHtml(result)}</span>`;
      [this.elCopyBtn, this.elInsertBtn, this.elTo3dBtn].forEach(b => b.classList.remove('hidden'));
      this._setStatus('Done.', 'ok');
    } catch (err) {
      this._setStatus('Error: ' + err.message, 'error');
    } finally {
      this._setButtonsDisabled(false);
    }
  }

  async _autoIdea() {
    const apiKey = this.store.geminiKey;
    if (!apiKey) { this._setStatus('⚠ Set Gemini API key first.', 'error'); window.app?.openSettings(); return; }

    this._setStatus('Generating idea…');
    this._setButtonsDisabled(true);
    try {
      const prompt = 'Generate one unique, unexpected, and visually compelling creative concept in 2–3 sentences. ' +
        'Make it surprising and specific — avoid generic themes.';
      const idea = await this._geminiCall(prompt, apiKey);
      this.elSubject.value = idea.trim();
      this._setStatus('Idea generated!', 'ok');
    } catch (err) {
      this._setStatus('Error: ' + err.message, 'error');
    } finally {
      this._setButtonsDisabled(false);
    }
  }

  async _geminiCall(prompt, apiKey) {
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 2048 }
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

  /* ── Actions ────────────────────────────────────────────────── */
  async _copy() {
    try {
      await navigator.clipboard.writeText(this._lastOutput);
      this._setStatus('Copied!', 'ok');
    } catch {
      this._setStatus('Copy failed — try manually selecting the text.', 'error');
    }
  }

  _insert() {
    this.store.workspaceModule?.insertText(this._lastOutput);
    this._setStatus('Inserted into note.', 'ok');
  }

  _sendTo3D() {
    // Take the first line/sentence as the 3D studio prompt
    const firstLine = this._lastOutput.split('\n')[0].replace(/^\d+\.\s*/, '').trim();
    if (firstLine) {
      const el = document.getElementById('td-brainstorm-input');
      if (el) el.value = firstLine;
      window.app?.switchTab('studio');
      this._setStatus('Sent to 3D Studio.', 'ok');
    }
  }

  /** Pre-fill the subject from an external source (e.g. style-forge result) */
  setSubject(text) {
    this.elSubject.value = text;
  }

  _setButtonsDisabled(v) {
    ['btn-pc-craft','btn-pc-expand','btn-pc-img','btn-pc-auto'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = v;
    });
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
