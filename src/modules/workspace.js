/**
 * workspace.js — TipTap editor + Firebase/LocalForage note storage
 */

const NOTES_KEY = 'lavaz_notes';

export class WorkspaceModule {
  constructor(store) {
    this.store = store; // shared app-level store {geminiKey, firebaseDb, ...}
    this.editor = null;
    this.notes = [];
    this.activeNoteId = null;

    this._bindDOM();
    this._initEditor();
    this._loadNotes();
  }

  /* ── DOM bindings ───────────────────────────────────────────── */
  _bindDOM() {
    this.elTitle     = document.getElementById('note-title');
    this.elNotesList = document.getElementById('notes-list');
    this.elEmpty     = document.getElementById('notes-empty');
    this.elStatus    = document.getElementById('ws-status');

    document.getElementById('btn-new-note') .addEventListener('click', () => this.newNote());
    document.getElementById('btn-save-note').addEventListener('click', () => this.saveNote());

    // Editor toolbar
    document.getElementById('editor-toolbar').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cmd]');
      if (!btn || !this.editor) return;
      this._execCmd(btn.dataset.cmd);
    });

    // Auto-save on title change
    this.elTitle.addEventListener('input', () => this._markDirty());
  }

  /* ── TipTap init ────────────────────────────────────────────── */
  _initEditor() {
    const { Editor }       = window.tiptap || {};
    const { StarterKit }   = window.tiptapStarterKit || {};
    const Underline        = window.tiptapUnderline?.Underline;
    const Placeholder      = window.tiptapPlaceholder?.Placeholder;
    const Image            = window.tiptapImage?.Image;

    if (!Editor || !StarterKit) {
      console.error('TipTap bundles not loaded yet — retrying in 500 ms');
      setTimeout(() => this._initEditor(), 500);
      return;
    }

    const extensions = [StarterKit];
    if (Underline)  extensions.push(Underline);
    if (Placeholder) extensions.push(Placeholder.configure({ placeholder: 'Start writing your note…' }));
    if (Image)      extensions.push(Image.configure({ inline: false, allowBase64: true }));

    this.editor = new Editor({
      element: document.getElementById('editor'),
      extensions,
      content: '',
      onUpdate: () => this._markDirty(),
      onSelectionUpdate: () => this._refreshToolbar(),
      onTransaction: () => this._refreshToolbar(),
    });
  }

  _execCmd(cmd) {
    const chain = this.editor.chain().focus();
    switch (cmd) {
      case 'bold':       chain.toggleBold().run(); break;
      case 'italic':     chain.toggleItalic().run(); break;
      case 'underline':  chain.toggleUnderline?.().run(); break;
      case 'strike':     chain.toggleStrike().run(); break;
      case 'h1':         chain.toggleHeading({ level: 1 }).run(); break;
      case 'h2':         chain.toggleHeading({ level: 2 }).run(); break;
      case 'bullet':     chain.toggleBulletList().run(); break;
      case 'ordered':    chain.toggleOrderedList().run(); break;
      case 'code':       chain.toggleCode().run(); break;
      case 'blockquote': chain.toggleBlockquote().run(); break;
      case 'undo':       chain.undo().run(); break;
      case 'redo':       chain.redo().run(); break;
    }
  }

  _refreshToolbar() {
    if (!this.editor) return;
    const buttons = document.querySelectorAll('#editor-toolbar [data-cmd]');
    const cmdMap = {
      bold: () => this.editor.isActive('bold'),
      italic: () => this.editor.isActive('italic'),
      underline: () => this.editor.isActive('underline'),
      strike: () => this.editor.isActive('strike'),
      h1: () => this.editor.isActive('heading', { level: 1 }),
      h2: () => this.editor.isActive('heading', { level: 2 }),
      bullet: () => this.editor.isActive('bulletList'),
      ordered: () => this.editor.isActive('orderedList'),
      code: () => this.editor.isActive('code'),
      blockquote: () => this.editor.isActive('blockquote'),
    };
    buttons.forEach(btn => {
      const fn = cmdMap[btn.dataset.cmd];
      btn.classList.toggle('is-active', fn ? fn() : false);
    });
  }

  /* ── Note CRUD ──────────────────────────────────────────────── */
  newNote() {
    if (this._isDirty) this.saveNote(true);
    this.activeNoteId = null;
    this._isDirty = false;
    this.elTitle.value = '';
    this.editor?.commands.setContent('');
    this.elTitle.focus();
    this._setStatus('New note ready.', 'ok');
  }

  async saveNote(silent = false) {
    if (!this.editor) return;
    const title   = this.elTitle.value.trim() || 'Untitled Note';
    const content = this.editor.getHTML();
    const now     = Date.now();

    if (!this.activeNoteId) {
      this.activeNoteId = 'note_' + now;
    }

    const note = { id: this.activeNoteId, title, content, updatedAt: now };
    const idx  = this.notes.findIndex(n => n.id === note.id);
    if (idx >= 0) {
      this.notes[idx] = note;
    } else {
      this.notes.unshift(note);
    }

    this._isDirty = false;
    await this._persistNotes();
    this._renderNotesList();

    if (!silent) this._setStatus('Note saved.', 'ok');

    // Mirror to Firestore if available
    if (this.store.firebaseDb) {
      try {
        await this.store.firebaseDb
          .collection('notes').doc(note.id).set(note);
      } catch (err) {
        console.warn('Firestore sync failed:', err.message);
      }
    }
  }

  deleteNote(id) {
    this.notes = this.notes.filter(n => n.id !== id);
    if (this.activeNoteId === id) {
      this.newNote();
    }
    this._persistNotes();
    this._renderNotesList();
    this._setStatus('Note deleted.', 'ok');
  }

  loadNote(id) {
    const note = this.notes.find(n => n.id === id);
    if (!note) return;
    this.activeNoteId = note.id;
    this._isDirty = false;
    this.elTitle.value = note.title;
    this.editor?.commands.setContent(note.content || '');
    this._renderNotesList();
    // Switch to workspace tab
    window.app?.switchTab('workspace');
  }

  /* ── Insert content into active note ───────────────────────── */
  insertText(text) {
    if (!this.editor) return;
    this.editor.chain().focus().insertContent('<p>' + this._escHtml(text) + '</p>').run();
    this._markDirty();
  }

  insertImage(dataUrl) {
    if (!this.editor) return;
    this.editor.chain().focus().setImage({ src: dataUrl }).run();
    this._markDirty();
  }

  /* ── Persistence (LocalForage) ──────────────────────────────── */
  async _loadNotes() {
    try {
      const saved = await localforage.getItem(NOTES_KEY);
      this.notes = Array.isArray(saved) ? saved : [];
    } catch {
      this.notes = [];
    }
    this._renderNotesList();
  }

  async _persistNotes() {
    try {
      await localforage.setItem(NOTES_KEY, this.notes);
    } catch (err) {
      console.warn('LocalForage persist failed:', err.message);
    }
  }

  /* ── List rendering ─────────────────────────────────────────── */
  _renderNotesList() {
    const list  = this.elNotesList;
    const empty = this.elEmpty;
    list.innerHTML = '';
    if (!this.notes.length) {
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';
    this.notes.forEach(note => {
      const item = document.createElement('div');
      item.className = 'note-list-item' + (note.id === this.activeNoteId ? ' selected' : '');
      item.innerHTML = `
        <div class="flex items-center justify-between">
          <div>
            <div class="note-title">${this._escHtml(note.title)}</div>
            <div class="note-meta">${new Date(note.updatedAt).toLocaleString()}</div>
          </div>
          <button class="delete-btn ml-2 text-xs text-red-400/60 hover:text-red-400 px-2 py-1" data-id="${note.id}">✕</button>
        </div>`;
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn') || e.target.closest('.delete-btn')) {
          this.deleteNote(e.target.closest('[data-id]').dataset.id);
          return;
        }
        this.loadNote(note.id);
      });
      list.appendChild(item);
    });
  }

  /* ── Helpers ────────────────────────────────────────────────── */
  _markDirty() { this._isDirty = true; }

  _setStatus(msg, type = '') {
    this.elStatus.textContent = msg;
    this.elStatus.className = 'status-bar' + (type ? ' ' + type : '');
    if (type === 'ok') setTimeout(() => { this.elStatus.textContent = ''; }, 3000);
  }

  _escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
