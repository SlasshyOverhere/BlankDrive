export function renderWebUiHtml(nonce: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
 <title>BlankDrive · Secure Vault</title>
 <meta name="description" content="BlankDrive private encrypted archive">
<style nonce="${nonce}">
:root {
  --font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --radius-sm: 5px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --transition: 0.2s ease;
  --bg: #111211;
  --bg-alt: #171917;
  --surface: #1c1e1b;
  --surface-2: #242722;
  --input-bg: #121411;
  --bg-input: #121411;
  --text: #f1f0e8;
  --text-muted: #9c9f94;
  --text-faint: #686d65;
  --border: #30352e;
  --border-strong: #485046;
  --accent: #e5a15d;
  --accent-soft: rgba(229, 161, 93, 0.14);
  --ok: #a9c18c;
  --warn: #e5a15d;
  --danger: #d98172;
  --shadow: 0 18px 36px rgba(0, 0, 0, 0.2);
  color-scheme: dark;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
}

body {
  min-height: 100vh;
  font-family: var(--font-sans);
  color: var(--text);
  line-height: 1.45;
  overflow-x: hidden;
  overflow-y: auto;
  background:
    radial-gradient(700px 480px at 84% -14%, rgba(229, 161, 93, 0.08), transparent 68%),
    linear-gradient(135deg, #101210 0%, #181a17 52%, #121412 100%);
}

body::before {
  content: '';
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 50%;
  pointer-events: none;
  border-left: 1px solid rgba(255, 255, 255, 0.025);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.012));
  z-index: -1;
}

.app {
  width: 100%;
  max-width: 1480px;
  min-height: 100vh;
  margin: 0 auto;
  padding: 22px 28px 34px;
  display: flex;
  flex-direction: column;
  gap: 26px;
}

.header-bar,
.vault-controls,
.card {
  background: rgba(28, 30, 27, 0.86);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

.header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-top-color: #51594d;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.header-intro {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-left: auto;
  margin-right: 24px;
  color: var(--text-muted);
  font-size: 0.72rem;
}

.header-intro strong {
  color: var(--text);
  font-size: 0.78rem;
  font-weight: 550;
}

.brand-icon {
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
}

.brand-logo {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
}

.brand-text h1 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.brand-text .tagline {
  margin: 3px 0 0;
  font-size: 0.72rem;
  color: var(--text-muted);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 3px 0;
  font-size: 0.7rem;
  font-weight: 650;
  letter-spacing: 0.02em;
  color: var(--text-muted);
}

.badge::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-faint);
}

.badge.ok {
  color: var(--ok);
}

.badge.warn {
  color: var(--accent);
}

.badge.bad {
  color: var(--danger);
}

.badge.ok::before { background: var(--ok); }
.badge.warn::before { background: var(--accent); }
.badge.bad::before { background: var(--danger); }

.meta-text {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-muted);
}

.vault-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 13px 16px;
  background: rgba(18, 20, 18, 0.72);
}

.vault-primary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
}

.vault-controls form {
  display: flex;
  align-items: center;
  gap: 7px;
}

.vault-meta {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin-left: auto;
}

#vaultPath {
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.main-grid {
  display: grid;
  grid-template-columns: 288px minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.workspace {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.forms-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.card {
  padding: 19px;
  display: flex;
  flex-direction: column;
}

.sidebar {
  min-height: 560px;
  position: sticky;
  top: 22px;
}

.card-title {
  margin: 0 0 14px;
  font-size: 0.92rem;
  font-weight: 650;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.card-title .icon {
  display: none;
}

.filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 110px;
  gap: 8px;
  margin-bottom: 10px;
}

input,
textarea,
select {
  width: 100%;
  font: inherit;
  font-size: 0.86rem;
  color: var(--text);
  border: 1px solid var(--border);
  background: var(--input-bg);
  border-radius: var(--radius-sm);
  padding: 10px 11px;
  transition: border-color var(--transition), box-shadow var(--transition), background var(--transition);
}

select {
  appearance: none;
  cursor: pointer;
  padding-right: 30px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23939393' d='M6 8L1.8 3.8h8.4z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
}

textarea {
  min-height: 96px;
  resize: vertical;
}

input:disabled,
textarea:disabled,
select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: rgba(255, 255, 255, 0.02);
}

input::placeholder,
textarea::placeholder {
  color: var(--text-muted);
}

input:focus,
textarea:focus,
select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

button:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

button {
  font: inherit;
  font-size: 0.79rem;
  font-weight: 650;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  padding: 9px 13px;
  cursor: pointer;
  transition: background var(--transition), border-color var(--transition), color var(--transition), opacity var(--transition);
  white-space: nowrap;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  color: #19150f;
  background: var(--accent);
  border-color: #f0b976;
}

.btn-primary:hover:not(:disabled) {
  background: #f0b976;
}

.btn-ghost {
  color: var(--text);
  background: var(--surface-2);
  border-color: var(--border);
}

.btn-ghost:hover:not(:disabled) {
  border-color: #67705f;
  background: #2b302a;
}

.btn-danger {
  color: #f2c1b6;
  background: rgba(217, 129, 114, 0.09);
  border-color: rgba(217, 129, 114, 0.32);
}

.btn-danger:hover:not(:disabled) {
  background: rgba(217, 129, 114, 0.16);
}

.btn-sm {
  padding: 7px 11px;
  font-size: 0.78rem;
}

.entry-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: min(74vh, 860px);
  overflow-y: auto;
}

.entry-list::-webkit-scrollbar {
  width: 8px;
}

.entry-list::-webkit-scrollbar-thumb {
  background: #303030;
  border-radius: 999px;
}

.entry-item {
  width: 100%;
  text-align: left;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  padding: 11px 10px;
}

.entry-item:hover {
  border-color: #414941;
  background: rgba(255, 255, 255, 0.025);
}

.entry-item.active {
  border-color: rgba(229, 161, 93, 0.6);
  background: rgba(229, 161, 93, 0.08);
}

.entry-item.active:focus-visible {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.entry-item .entry-title {
  font-weight: 600;
  font-size: 0.83rem;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-item .entry-meta {
  font-size: 0.67rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 7px;
}

.pill {
  display: inline-flex;
  align-items: center;
  border-radius: 3px;
  border: 1px solid #4a5147;
  font-size: 0.59rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 2px 6px;
  text-transform: uppercase;
  color: #d9d9d9;
  background: rgba(255, 255, 255, 0.05);
}

.pill.password,
.pill.note,
.pill.file {
  color: #c7d0bd;
  border-color: #4a5147;
  background: rgba(176, 198, 151, 0.08);
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

#detailForm .form-actions {
  margin-top: 4px;
}

#saveDetail {
  order: 1;
}

#copyPassword {
  order: 2;
}

#watchVideo {
  order: 3;
}

#downloadFile {
  order: 4;
}

#toggleFav {
  order: 5;
}

#deleteEntry {
  order: 6;
  margin-left: auto;
}

#cliForm .form-actions {
  display: grid;
  grid-template-columns: minmax(130px, 1fr) repeat(3, auto);
}

.hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.hint.empty-state {
  padding: 28px 12px;
  text-align: center;
  color: var(--text-faint);
}

.hidden {
  display: none !important;
}

.detail-panel {
  min-height: 260px;
  border-top-color: #5a654f;
}

.cli-panel {
  min-height: 230px;
  background: #151714;
}

input[type="file"] {
  padding: 6px;
}

input[type="file"]::file-selector-button {
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  color: #19150f;
  background: var(--accent);
  border: 1px solid #f0b976;
  border-radius: 4px;
  padding: 6px 10px;
  margin-right: 10px;
  cursor: pointer;
}

.toast {
  position: fixed;
  right: 18px;
  bottom: 18px;
  max-width: min(92vw, 420px);
  padding: 12px 14px;
  background: #252a23;
  border: 1px solid #59624f;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow);
  color: var(--text);
  font-size: 0.84rem;
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 0.18s ease, transform 0.18s ease;
  pointer-events: none;
  z-index: 1000;
}

.toast.show {
  opacity: 1;
  transform: translateY(0);
}

.video-modal {
  position: fixed;
  inset: 0;
  background: rgba(7, 9, 7, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  z-index: 1200;
}

.video-shell {
  width: min(1120px, 100%);
  border: 1px solid #4b5448;
  border-radius: var(--radius-lg);
  background: #171a16;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.video-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}

.video-subtitle {
  margin: 2px 0 0;
  color: var(--text-muted);
  font-size: 0.75rem;
  font-family: var(--font-mono);
}

.video-close {
  min-width: 84px;
}

.video-player {
  display: block;
  width: 100%;
  max-height: min(74vh, 720px);
  background: #000;
}

.cli-output {
  margin-top: 12px;
  min-height: 160px;
  max-height: 320px;
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  font-family: var(--font-mono);
  font-size: .76rem;
  white-space: pre-wrap;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}

@media (max-width: 1240px) {
  .vault-meta {
    width: 100%;
    justify-content: flex-start;
    margin-left: 0;
    margin-top: 4px;
  }

  .main-grid {
    grid-template-columns: 260px minmax(0, 1fr);
  }

  .forms-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .app {
    min-height: 100vh;
    padding: 16px;
  }

  .header-bar {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-intro {
    margin: 0;
  }

  .vault-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .vault-primary {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .vault-controls form {
    flex-direction: column;
    align-items: stretch;
  }

  .main-grid {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .sidebar {
    position: static;
    min-height: 0;
  }

  .entry-list {
    max-height: 38vh;
  }

  #deleteEntry {
    margin-left: 0;
  }

  #cliForm .form-actions {
    grid-template-columns: 1fr 1fr;
  }

  .cli-output {
    max-height: 260px;
  }
}

@media (max-width: 640px) {
  .app {
    padding: 12px 12px 24px;
    gap: 16px;
  }

  .header-right {
    width: 100%;
    justify-content: space-between;
    gap: 8px;
  }

  .card,
  .header-bar,
  .vault-controls {
    padding: 14px;
  }

  #initForm input,
  #unlockForm input {
    max-width: none !important;
  }

  .filters {
    grid-template-columns: 1fr;
  }

  .form-actions {
    flex-direction: column;
  }

  .form-actions button {
    width: 100%;
  }

  #cliForm .form-actions {
    grid-template-columns: 1fr;
  }

  .video-shell {
    border-radius: 10px;
  }
}
  </style>
</head>
<body>
  <div class="app">
    <!-- ═══════════ HEADER ═══════════ -->
    <header class="header-bar">
      <div class="header-left">
        <div class="brand-icon">
          <img class="brand-logo" src="/api/brand/logo" alt="BlankDrive logo">
        </div>
        <div class="brand-text">
          <h1>BlankDrive</h1>
          <p class="tagline">Private archive / local only</p>
        </div>
      </div>
      <div class="header-intro">
        <strong>Everything important, kept close.</strong>
        <span>Encrypted entries, notes, and files in one quiet workspace.</span>
      </div>
      <div class="header-right">
        <span id="vaultBadge" class="badge warn">Checking…</span>
        <span id="meta" class="meta-text">Loading</span>
      </div>
    </header>

    <!-- ═══════════ VAULT CONTROLS ═══════════ -->
    <section class="vault-controls">
      <div class="vault-primary">
        <form id="initForm">
          <input id="initPassword" type="password" autocomplete="new-password" placeholder="New master password *" aria-label="New master password" required style="max-width:260px">
          <button type="submit" class="btn-danger btn-sm">Create Vault</button>
        </form>
        <form id="unlockForm">
          <input id="unlockPassword" type="password" autocomplete="current-password" placeholder="Master password *" aria-label="Master password" required style="max-width:260px">
          <button type="submit" class="btn-primary btn-sm">Unlock</button>
        </form>
        <button id="lockButton" type="button" class="btn-ghost btn-sm">Lock</button>
        <button id="refreshButton" type="button" class="btn-ghost btn-sm">Refresh state</button>
      </div>
      <div class="vault-meta">
        <span id="entryCount" class="badge">0 entries</span>
        <span id="vaultPath" class="meta-text"></span>
      </div>
    </section>

    <!-- ═══════════ MAIN GRID ═══════════ -->
    <section class="main-grid">
      <!-- SIDEBAR: Entry List -->
      <aside class="card sidebar">
        <div class="card-title">
          <span><span class="icon"></span>Your archive</span>
          <button id="reloadEntries" type="button" class="btn-ghost btn-sm">Reload</button>
        </div>
        <p class="hint" style="margin:-5px 0 14px">Search across everything you have tucked away.</p>
        <div class="filters">
          <input id="search" type="search" placeholder="Search archive… (/)" aria-label="Search entries (Press / to focus)">
          <select id="typeFilter" aria-label="Filter by type"><option value="all">All</option><option value="password">Passwords</option><option value="note">Notes</option><option value="file">Files</option></select>
        </div>
        <ul id="entryList" class="entry-list"></ul>
      </aside>

      <div class="workspace">
        <div class="forms-grid">
          <!-- ADD ENTRY -->
          <div class="card">
            <div class="card-title"><span><span class="icon"></span>Make something private</span></div>
            <p class="hint" style="margin-bottom:12px">A password or note becomes part of the archive immediately.</p>
            <form id="createForm" class="form-stack">
              <select id="createType" aria-label="Entry type"><option value="password">Password Entry</option><option value="note">Secure Note</option></select>
              <input id="createTitle" type="text" maxlength="256" placeholder="Title *" aria-label="Entry title" required>
              <div id="createPwd" class="form-stack">
                <input id="createUsername" type="text" maxlength="256" placeholder="Username (optional)" aria-label="Username">
                <input id="createPassword" type="text" maxlength="4096" placeholder="Password (optional)" aria-label="Password">
                <input id="createUrl" type="url" maxlength="2048" placeholder="URL (optional)" aria-label="URL">
                <input id="createCategory" type="text" maxlength="64" placeholder="Category (optional)" aria-label="Category">
                <textarea id="createNotes" maxlength="65536" placeholder="Notes (optional)" aria-label="Notes"></textarea>
              </div>
              <div id="createNote" class="form-stack hidden"><textarea id="createContent" maxlength="1048576" placeholder="Note content" aria-label="Note content"></textarea></div>
              <button id="createBtn" type="submit" class="btn-primary">Add to archive</button>
            </form>
          </div>

          <!-- FILE UPLOAD -->
          <div class="card">
            <div class="card-title"><span><span class="icon"></span>Bring in a file</span></div>
            <p class="hint" style="margin-bottom:12px">Encrypt and store a file here. Larger files upload in secure chunks.</p>
            <form id="uploadForm" class="form-stack">
              <input id="uploadFile" type="file" required aria-label="File to upload">
              <input id="uploadTitle" type="text" maxlength="256" placeholder="Custom title (optional)" aria-label="File title">
              <textarea id="uploadNotes" maxlength="65536" placeholder="Notes (optional)" aria-label="File notes"></textarea>
              <button id="uploadBtn" type="submit" class="btn-primary">Encrypt file</button>
            </form>
          </div>
        </div>

        <!-- DETAIL PANEL -->
        <section class="card detail-panel">
          <div class="card-title"><span><span class="icon"></span>Entry detail</span><span class="meta-text">Edit with care</span></div>
          <p id="detailHint" class="hint empty-state">Select an entry to inspect, edit, download, or preview video.</p>
          <form id="detailForm" class="form-stack hidden">
            <input id="detailTitle" type="text" maxlength="256" required aria-label="Entry title">
            <p style="display:flex;align-items:center;gap:10px">
              <span id="detailType" class="pill password">password</span>
              <span id="detailMod" class="meta-text" style="font-size:.78rem"></span>
            </p>
            <div id="detailPwd" class="form-stack">
              <input id="detailUsername" type="text" maxlength="256" placeholder="Username" aria-label="Username">
              <input id="detailPassword" type="text" maxlength="4096" placeholder="Password" aria-label="Password">
              <input id="detailUrl" type="url" maxlength="2048" placeholder="URL" aria-label="URL">
              <input id="detailCategory" type="text" maxlength="64" placeholder="Category" aria-label="Category">
              <textarea id="detailNotes" maxlength="65536" placeholder="Notes" aria-label="Notes"></textarea>
            </div>
            <div id="detailNote" class="form-stack hidden"><textarea id="detailContent" maxlength="1048576" placeholder="Note content" aria-label="Note content"></textarea></div>
            <div id="detailFile" class="form-stack hidden"><p id="fileInfo" class="hint"></p></div>
            <div class="form-actions">
              <button id="saveDetail" type="submit" class="btn-primary">Save Changes</button>
              <button id="copyPassword" type="button" class="btn-ghost hidden">Copy Password</button>
              <button id="downloadFile" type="button" class="btn-ghost hidden">Download</button>
              <button id="watchVideo" type="button" class="btn-ghost hidden">Watch Video</button>
              <button id="toggleFav" type="button" class="btn-ghost">Favorite</button>
              <button id="deleteEntry" type="button" class="btn-danger">Delete</button>
            </div>
          </form>
        </section>

        <!-- CLI CONSOLE -->
        <section class="card cli-panel">
          <div class="card-title"><span><span class="icon"></span>Command line</span><span class="meta-text">BLANK</span></div>
          <p class="hint">Run a safe BLANK command without leaving this workspace.</p>
          <form id="cliForm" class="form-stack" style="margin-top:12px">
            <input id="cliCommand" type="text" maxlength="2048" placeholder="Example: sync --status" autocomplete="off" aria-label="CLI command">
            <div class="form-actions">
              <button id="runCliBtn" type="submit" class="btn-primary">Run Command</button>
              <button id="cliQuickStatus" type="button" class="btn-ghost">status</button>
              <button id="cliQuickSync" type="button" class="btn-ghost">sync --status</button>
              <button id="cliQuickSettings" type="button" class="btn-ghost">settings</button>
            </div>
          </form>
          <pre id="cliOutput" class="hint cli-output">CLI output will appear here.</pre>
        </section>
      </div>
    </section>
  </div>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
  <div id="videoModal" class="video-modal hidden" role="dialog" aria-modal="true" aria-label="Video preview">
    <section class="video-shell">
      <header class="video-header">
        <div>
          <strong id="videoTitle">Video Preview</strong>
          <p class="video-subtitle">Streaming from encrypted vault</p>
        </div>
        <button id="closeVideo" type="button" class="btn-ghost btn-sm video-close" title="Close (Esc)" aria-label="Close video preview">Close</button>
      </header>
      <video id="videoPlayer" class="video-player" controls preload="metadata"></video>
    </section>
  </div>

  <script type="module" nonce="${nonce}">
    const DEFAULT_UPLOAD_CHUNK_BYTES=2*1024*1024;

    /* ── State ── */
    const s={status:{vaultExists:false,unlocked:false,stats:null,vaultPath:''},entries:[],entryFilters:{query:'',type:'all'},selectedId:null,selected:null};
    const el={
      badge:document.getElementById('vaultBadge'),
      meta:document.getElementById('meta'),
      entryCount:document.getElementById('entryCount'),
      vaultPath:document.getElementById('vaultPath'),
      initForm:document.getElementById('initForm'),
      initPassword:document.getElementById('initPassword'),
      unlockForm:document.getElementById('unlockForm'),
      unlockPassword:document.getElementById('unlockPassword'),
      lockButton:document.getElementById('lockButton'),
      refreshButton:document.getElementById('refreshButton'),
      reloadEntries:document.getElementById('reloadEntries'),
      search:document.getElementById('search'),
      typeFilter:document.getElementById('typeFilter'),
      entryList:document.getElementById('entryList'),
      createForm:document.getElementById('createForm'),
      createType:document.getElementById('createType'),
      createTitle:document.getElementById('createTitle'),
      createPwd:document.getElementById('createPwd'),
      createUsername:document.getElementById('createUsername'),
      createPassword:document.getElementById('createPassword'),
      createUrl:document.getElementById('createUrl'),
      createCategory:document.getElementById('createCategory'),
      createNotes:document.getElementById('createNotes'),
      createNote:document.getElementById('createNote'),
      createContent:document.getElementById('createContent'),
      createBtn:document.getElementById('createBtn'),
      uploadForm:document.getElementById('uploadForm'),
      uploadFile:document.getElementById('uploadFile'),
      uploadTitle:document.getElementById('uploadTitle'),
      uploadNotes:document.getElementById('uploadNotes'),
      uploadBtn:document.getElementById('uploadBtn'),
      detailHint:document.getElementById('detailHint'),
      detailForm:document.getElementById('detailForm'),
      detailTitle:document.getElementById('detailTitle'),
      detailType:document.getElementById('detailType'),
      detailMod:document.getElementById('detailMod'),
      detailPwd:document.getElementById('detailPwd'),
      detailUsername:document.getElementById('detailUsername'),
      detailPassword:document.getElementById('detailPassword'),
      detailUrl:document.getElementById('detailUrl'),
      detailCategory:document.getElementById('detailCategory'),
      detailNotes:document.getElementById('detailNotes'),
      detailNote:document.getElementById('detailNote'),
      detailContent:document.getElementById('detailContent'),
      detailFile:document.getElementById('detailFile'),
      fileInfo:document.getElementById('fileInfo'),
      saveDetail:document.getElementById('saveDetail'),
      copyPassword:document.getElementById('copyPassword'),
      downloadFile:document.getElementById('downloadFile'),
      watchVideo:document.getElementById('watchVideo'),
      toggleFav:document.getElementById('toggleFav'),
      deleteEntry:document.getElementById('deleteEntry'),
      cliForm:document.getElementById('cliForm'),
      cliCommand:document.getElementById('cliCommand'),
      runCliBtn:document.getElementById('runCliBtn'),
      cliQuickStatus:document.getElementById('cliQuickStatus'),
      cliQuickSync:document.getElementById('cliQuickSync'),
      cliQuickSettings:document.getElementById('cliQuickSettings'),
      cliOutput:document.getElementById('cliOutput'),
      toast:document.getElementById('toast'),
      videoModal:document.getElementById('videoModal'),
      videoTitle:document.getElementById('videoTitle'),
      closeVideo:document.getElementById('closeVideo'),
      videoPlayer:document.getElementById('videoPlayer')
    };

    let toastTimer=null,searchTimer=null;
    const nt=t=>t==='note'||t==='file'?t:'password';
    const dt=v=>v?new Date(v).toLocaleString():'Never';
    const VIDEO_EXT_PATTERN=/\.(mp4|m4v|mov|webm|mkv|avi|ogv|ogg)$/i;

    function showToast(msg){el.toast.textContent=msg;el.toast.classList.add('show');if(toastTimer)clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.toast.classList.remove('show'),2800)}
    function busy(btn,on,label,idle){if(!btn)return;if(!btn.dataset.idle)btn.dataset.idle=idle||btn.textContent||'';btn.disabled=on;if(on){btn.setAttribute('aria-busy','true');btn.setAttribute('title','Operation in progress')}else{btn.removeAttribute('aria-busy');btn.removeAttribute('title')}btn.textContent=on?label:(idle||btn.dataset.idle)}
    function switchCreate(){const note=el.createType.value==='note';el.createPwd.classList.toggle('hidden',note);el.createNote.classList.toggle('hidden',!note)}
    function isVideoEntry(en){if(!en)return false;const mime=String(en.mimeType||'').toLowerCase();if(mime.startsWith('video/'))return true;const fileName=String(en.originalName||en.title||'').toLowerCase();return VIDEO_EXT_PATTERN.test(fileName)}
    function closeVideoPreview(){el.videoModal.classList.add('hidden');el.videoPlayer.pause();el.videoPlayer.removeAttribute('src');el.videoPlayer.load();if(!el.watchVideo.classList.contains('hidden')){el.watchVideo.focus();}}
    function switchDetail(type,canWatchVideo){const note=type==='note',file=type==='file';el.detailPwd.classList.toggle('hidden',note||file);el.detailNote.classList.toggle('hidden',!note);el.detailFile.classList.toggle('hidden',!file);el.saveDetail.disabled=file;el.copyPassword.classList.toggle('hidden',note||file);el.downloadFile.classList.toggle('hidden',!file);el.watchVideo.classList.toggle('hidden',!canWatchVideo);if(!canWatchVideo)closeVideoPreview()}
    function entryFilters(){return {query:String(el.search.value||'').trim(),type:String(el.typeFilter.value||'all')}}
    function queryUrl(filters){const p=new URLSearchParams();if(filters.query)p.set('query',filters.query);if(filters.type!=='all')p.set('type',filters.type);const qs=p.toString();return qs?'/api/entries?'+qs:'/api/entries'}

    async function api(path,opt){const o=opt?Object.assign({},opt):{};const m=String(o.method||'GET').toUpperCase();const h=new Headers(o.headers||{});if(m!=='GET')h.set('X-BlankDrive-UI','1');if(o.body!==undefined&&typeof o.body!=='string'){h.set('Content-Type','application/json');o.body=JSON.stringify(o.body)}o.method=m;o.headers=h;const r=await fetch(path,o);const ct=r.headers.get('content-type')||'';const d=ct.includes('application/json')?await r.json():await r.text();if(!r.ok){const msg=d&&typeof d==='object'&&d.error?d.error:'Request failed ('+r.status+')';throw new Error(msg)}return d}

    function setUnlocked(enabled){
      const lockMsg='Vault is locked';
      const toggleTitle=(n, disabled)=>{if(disabled)n.setAttribute('title',lockMsg);else n.removeAttribute('title');};
      el.search.disabled=!enabled;toggleTitle(el.search,!enabled);
      el.typeFilter.disabled=!enabled;toggleTitle(el.typeFilter,!enabled);
      el.reloadEntries.disabled=!enabled;toggleTitle(el.reloadEntries,!enabled);
      el.createBtn.disabled=!enabled;toggleTitle(el.createBtn,!enabled);
      el.uploadBtn.disabled=!enabled;toggleTitle(el.uploadBtn,!enabled);
      el.lockButton.disabled=!enabled;toggleTitle(el.lockButton,!enabled);
      el.createForm.querySelectorAll('input,textarea,select').forEach(n=>{if(n.id!=='createType'){n.disabled=!enabled;toggleTitle(n,!enabled);}});
      el.uploadForm.querySelectorAll('input,textarea').forEach(n=>{n.disabled=!enabled;toggleTitle(n,!enabled);});
    }

    function statusUi(){
      if(!s.status.vaultExists){el.badge.textContent='Not Initialized';el.badge.className='badge bad';el.meta.textContent='Create a vault to begin.'}
      else if(!s.status.unlocked){el.badge.textContent='Locked';el.badge.className='badge warn';el.meta.textContent='Unlock to access entries.'}
      else{el.badge.textContent='Unlocked';el.badge.className='badge ok';el.meta.textContent='Created: '+dt(s.status.stats?s.status.stats.created:null)}
       el.entryCount.textContent=String(s.status.stats?s.status.stats.entryCount:0)+' entries';
      el.vaultPath.textContent=s.status.vaultPath||'';
      el.vaultPath.title=s.status.vaultPath||'';

      el.initForm.classList.toggle('hidden', s.status.vaultExists);
      el.unlockForm.classList.toggle('hidden', !s.status.vaultExists || s.status.unlocked);
      el.lockButton.classList.toggle('hidden', !s.status.unlocked);

      setUnlocked(Boolean(s.status.unlocked));
      if(!s.status.unlocked){
        s.entries=[];s.selectedId=null;s.selected=null;renderEntries();showDetail('Unlock vault to inspect entries.');
        if(!s.status.vaultExists) setTimeout(()=>el.initPassword.focus(), 100);
        else setTimeout(()=>el.unlockPassword.focus(), 100);
      }
    }

    function renderEntries(){
      el.entryList.innerHTML='';
      if(!s.status.unlocked){const li=document.createElement('li');li.className='hint empty-state';li.textContent='Vault is locked. Unlock to access your entries.';el.entryList.appendChild(li);return}
      if(!s.entries.length){const li=document.createElement('li');li.className='hint empty-state';li.textContent=(s.entryFilters.query||s.entryFilters.type!=='all')?'No entries match your search.':'Vault is empty. Create an entry or upload a file.';el.entryList.appendChild(li);return}
      s.entries.forEach(en=>{
        const li=document.createElement('li');
        const b=document.createElement('button');b.type='button';b.className='entry-item';
        if(s.selectedId===en.id){b.classList.add('active');b.setAttribute('aria-current','true');}
        const titleText=(en.favorite?'★ ':'')+en.title;
        const t=document.createElement('div');t.className='entry-title';t.textContent=titleText;t.title=titleText;
        const m=document.createElement('div');m.className='entry-meta';
        const ty=nt(en.entryType);const p=document.createElement('span');p.className='pill '+ty;p.textContent=ty;
        const dateText=new Date(en.modified).toLocaleDateString();
        const d=document.createElement('span');d.textContent=dateText;
        m.appendChild(p);
        let catText='';
        if(en.category){const c=document.createElement('span');c.textContent='['+en.category+']';m.appendChild(c);catText=' Category: '+en.category;}
        m.appendChild(d);b.appendChild(t);b.appendChild(m);
        b.setAttribute('aria-label', titleText + ' (' + ty + ')' + catText + ', modified ' + dateText);
        b.addEventListener('click',()=>{void loadEntry(en.id)});
        li.appendChild(b);el.entryList.appendChild(li);
      })
    }

    function showDetail(msg){closeVideoPreview();el.detailHint.textContent=msg;el.detailForm.classList.add('hidden')}
    function fillDetail(en){
      const ty=nt(en.type||en.entryType);el.detailHint.textContent='';el.detailForm.classList.remove('hidden');
      el.detailType.textContent=ty;el.detailType.className='pill '+ty;
      el.detailMod.textContent='Modified: '+dt(en.modified);
      el.detailTitle.value=en.title||'';el.detailUsername.value=en.username||'';el.detailPassword.value=en.password||'';
      el.detailUrl.value=en.url||'';el.detailCategory.value=en.category||'';el.detailNotes.value=en.notes||'';el.detailContent.value=en.content||'';
      const canWatchVideo=ty==='file'&&isVideoEntry(en);
      if(ty==='file'){const parts=[];if(en.originalName)parts.push('Name: '+en.originalName);if(en.mimeType)parts.push('MIME: '+en.mimeType);if(typeof en.size==='number')parts.push('Size: '+en.size+' bytes');if(en.checksum)parts.push('SHA: '+en.checksum);if(en.notes)parts.push('Notes: '+en.notes);if(canWatchVideo)parts.push('Video preview enabled');el.fileInfo.textContent=parts.join(' · ')}
      switchDetail(ty,canWatchVideo);
    }

    async function refreshStatus(load){s.status=await api('/api/status');statusUi();if(load!==false&&s.status.unlocked)await refreshEntries()}
    async function refreshEntries(){if(!s.status.unlocked)return;const filters=entryFilters();const d=await api(queryUrl(filters));s.entryFilters=filters;s.entries=Array.isArray(d.entries)?d.entries:[];renderEntries();if(s.selectedId&&!s.entries.some(x=>x.id===s.selectedId)){s.selectedId=null;s.selected=null;showDetail('Entry no longer exists.')}}
    async function loadEntry(id){if(!s.status.unlocked)return;s.selectedId=id;renderEntries();try{const d=await api('/api/entries/'+encodeURIComponent(id));s.selected=d.entry||null;if(!s.selected){showDetail('Entry not found.');return}fillDetail(s.selected)}catch(err){s.selected=null;showDetail(err instanceof Error?err.message:'Failed to load entry.')}}

    function createPayload(){if(nt(el.createType.value)==='note')return{type:'note',title:String(el.createTitle.value||'').trim(),content:String(el.createContent.value||'')};return{type:'password',title:String(el.createTitle.value||'').trim(),username:String(el.createUsername.value||''),password:String(el.createPassword.value||''),url:String(el.createUrl.value||''),category:String(el.createCategory.value||''),notes:String(el.createNotes.value||'')}}
    function updatePayload(){if(!s.selected)return{};const ty=nt(s.selected.type||s.selected.entryType);if(ty==='note')return{title:String(el.detailTitle.value||'').trim(),content:String(el.detailContent.value||'')};if(ty==='file')return{};return{title:String(el.detailTitle.value||'').trim(),username:String(el.detailUsername.value||''),password:String(el.detailPassword.value||''),url:String(el.detailUrl.value||''),category:String(el.detailCategory.value||''),notes:String(el.detailNotes.value||'')}}
    function parseDownloadName(disposition,fallback){if(!disposition)return fallback;const utf=disposition.match(/filename\\*=UTF-8''([^;]+)/i);if(utf&&utf[1]){try{return decodeURIComponent(utf[1])}catch{return fallback}}const basic=disposition.match(/filename="([^"]+)"/i);if(basic&&basic[1])return basic[1];return fallback}
    async function readFetchError(r,fallback){const ct=r.headers.get('content-type')||'';if(ct.includes('application/json')){try{const payload=await r.json();if(payload&&payload.error)return payload.error}catch{}}try{const txt=await r.text();if(txt&&txt.trim())return txt.trim()}catch{}return fallback+' ('+r.status+')'}
    function formatBytes(bytes){if(bytes<1024)return bytes+' B';if(bytes<1024*1024)return(Math.round((bytes/1024)*10)/10)+' KB';if(bytes<1024*1024*1024)return(Math.round((bytes/(1024*1024))*10)/10)+' MB';return(Math.round((bytes/(1024*1024*1024))*100)/100)+' GB'}
    function setCliOutput(text){el.cliOutput.textContent=text&&text.trim()?text.trim():'(no output)'}
    async function uploadInChunks(file,title,notes){const init=await api('/api/files/upload/start',{method:'POST',body:{fileName:file.name,title,notes,totalSize:file.size,chunkSize:DEFAULT_UPLOAD_CHUNK_BYTES}});const uploadId=String(init&&init.uploadId||'');if(!uploadId)throw new Error('Failed to initialize upload.');const chunkSize=Number(init&&init.chunkSize)||DEFAULT_UPLOAD_CHUNK_BYTES;const totalChunks=Number(init&&init.totalChunks)||0;let uploadedBytes=0;try{for(let i=0;i<totalChunks;i++){const start=i*chunkSize;const end=Math.min(start+chunkSize,file.size);const chunk=file.slice(start,end);const r=await fetch('/api/files/upload/chunk?uploadId='+encodeURIComponent(uploadId)+'&index='+i,{method:'POST',headers:{'X-BlankDrive-UI':'1','Content-Type':'application/octet-stream'},body:chunk});if(!r.ok)throw new Error(await readFetchError(r,'Upload chunk failed'));uploadedBytes=end;const pct=file.size>0?Math.floor((uploadedBytes/file.size)*100):100;busy(el.uploadBtn,true,'Uploading '+pct+'%…','Upload File')}const complete=await api('/api/files/upload/complete',{method:'POST',body:{uploadId}});return complete}catch(error){await api('/api/files/upload/abort',{method:'POST',body:{uploadId}}).catch(()=>{});throw error}}
    async function runCliCommandFromUi(command){const trimmed=String(command||'').trim();if(!trimmed){showToast('Enter a command first.');return}busy(el.runCliBtn,true,'Running…','Run Command');try{const result=await api('/api/cli/run',{method:'POST',body:{command:trimmed}});const out=[];out.push('$ BLANK '+trimmed);if(result&&result.stdout)out.push(String(result.stdout));if(result&&result.stderr)out.push(String(result.stderr));out.push('exitCode: '+String(result&&result.exitCode!==undefined?result.exitCode:'unknown'));if(result&&result.timedOut)out.push('timedOut: true');setCliOutput(out.join('\\n\\n'));showToast(result&&result.exitCode===0?'Command completed.':'Command finished with errors.');await refreshStatus(true);if(s.selectedId)await loadEntry(s.selectedId)}catch(err){setCliOutput(err instanceof Error?err.message:'Command failed.');showToast(err instanceof Error?err.message:'Command failed.')}finally{busy(el.runCliBtn,false,'Running…','Run Command')}}

     async function onCreate(ev){ev.preventDefault();if(!s.status.unlocked){showToast('Unlock vault first.');return}busy(el.createBtn,true,'Saving…','Add to archive');try{const d=await api('/api/entries',{method:'POST',body:createPayload()});el.createForm.reset();switchCreate();await refreshStatus(false);await refreshEntries();showToast('Entry created.');if(d&&d.entry&&d.entry.id)await loadEntry(d.entry.id)}catch(err){showToast(err instanceof Error?err.message:'Create failed.')}finally{busy(el.createBtn,false,'Saving…','Add to archive')}}
     async function onUpload(ev){ev.preventDefault();if(!s.status.unlocked){showToast('Unlock vault first.');return}const file=el.uploadFile.files&&el.uploadFile.files[0];if(!file){showToast('Choose a file first.');return}busy(el.uploadBtn,true,'Preparing…','Encrypt file');try{const d=await uploadInChunks(file,String(el.uploadTitle.value||'').trim(),String(el.uploadNotes.value||''));el.uploadForm.reset();await refreshStatus(false);await refreshEntries();showToast('File uploaded ('+formatBytes(file.size)+').');if(d&&d.entry&&d.entry.id)await loadEntry(d.entry.id)}catch(err){showToast(err instanceof Error?err.message:'Upload failed.')}finally{busy(el.uploadBtn,false,'Uploading…','Encrypt file')}}
    async function onSaveDetail(ev){ev.preventDefault();if(!s.selectedId||!s.selected)return;if(nt(s.selected.type||s.selected.entryType)==='file'){showToast('File metadata is read-only.');return}busy(el.saveDetail,true,'Saving…','Save Changes');try{const d=await api('/api/entries/'+encodeURIComponent(s.selectedId),{method:'PUT',body:updatePayload()});s.selected=d.entry||s.selected;fillDetail(s.selected);await refreshStatus(false);await refreshEntries();showToast('Entry updated.')}catch(err){showToast(err instanceof Error?err.message:'Update failed.')}finally{busy(el.saveDetail,false,'Saving…','Save Changes')}}
    async function onCopyPassword(){if(!s.selected)return;try{await navigator.clipboard.writeText(String(el.detailPassword.value||''));showToast('Password copied.');const origText=el.copyPassword.textContent;el.copyPassword.textContent='Copied!';setTimeout(()=>el.copyPassword.textContent=origText,2000)}catch(err){showToast('Failed to copy.')}}
    async function onDownload(){if(!s.selectedId||!s.selected||nt(s.selected.type||s.selected.entryType)!=='file'){showToast('Select a file entry first.');return}busy(el.downloadFile,true,'Downloading…','Download');try{const r=await fetch('/api/files/'+encodeURIComponent(s.selectedId)+'/download',{method:'GET',headers:{'X-BlankDrive-UI':'1'}});if(!r.ok){let msg='Download failed ('+r.status+')';try{const p=await r.json();if(p&&p.error)msg=p.error}catch{}throw new Error(msg)}const blob=await r.blob();const fallback=s.selected.originalName||'download.bin';const fileName=parseDownloadName(r.headers.get('content-disposition'),fallback);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);showToast('File download started.')}catch(err){showToast(err instanceof Error?err.message:'Download failed.')}finally{busy(el.downloadFile,false,'Downloading…','Download')}}
    async function onWatchVideo(){if(!s.selectedId||!s.selected||nt(s.selected.type||s.selected.entryType)!=='file'){showToast('Select a file entry first.');return}if(!isVideoEntry(s.selected)){showToast('This file is not recognized as a video.');return}closeVideoPreview();el.videoTitle.textContent=s.selected.originalName||s.selected.title||'Video Preview';el.videoPlayer.src='/api/files/'+encodeURIComponent(s.selectedId)+'/stream?ts='+Date.now();el.videoModal.classList.remove('hidden');el.closeVideo.focus();el.videoPlayer.load();try{await el.videoPlayer.play()}catch{}}
    async function onToggleFav(){if(!s.selectedId)return;busy(el.toggleFav,true,'…','Favorite');try{await api('/api/entries/'+encodeURIComponent(s.selectedId)+'/favorite',{method:'POST'});await refreshEntries();if(s.selectedId)await loadEntry(s.selectedId);showToast('Favorite toggled.')}catch(err){showToast(err instanceof Error?err.message:'Failed.')}finally{busy(el.toggleFav,false,'…','Favorite')}}
    async function onDelete(){if(!s.selectedId)return;if(!confirm('Delete this entry permanently?'))return;busy(el.deleteEntry,true,'Deleting…','Delete');try{await api('/api/entries/'+encodeURIComponent(s.selectedId),{method:'DELETE'});s.selectedId=null;s.selected=null;showDetail('Entry deleted.');await refreshStatus(false);await refreshEntries();showToast('Entry deleted.')}catch(err){showToast(err instanceof Error?err.message:'Delete failed.')}finally{busy(el.deleteEntry,false,'Deleting…','Delete')}}
    async function onInit(ev){ev.preventDefault();const pw=String(el.initPassword.value||'');if(!pw){showToast('Password required.');return}const b=el.initForm.querySelector('button');busy(b,true,'Creating…','Create Vault');try{await api('/api/init',{method:'POST',body:{password:pw}});el.initForm.reset();await refreshStatus(true);showToast('Vault created!')}catch(err){showToast(err instanceof Error?err.message:'Init failed.')}finally{busy(b,false,'Creating…','Create Vault')}}
    async function onUnlock(ev){ev.preventDefault();const pw=String(el.unlockPassword.value||'');if(!pw){showToast('Password required.');return}const b=el.unlockForm.querySelector('button');busy(b,true,'Unlocking…','Unlock');try{await api('/api/unlock',{method:'POST',body:{password:pw}});el.unlockForm.reset();await refreshStatus(true);showToast('Vault unlocked!')}catch(err){showToast(err instanceof Error?err.message:'Unlock failed.')}finally{busy(b,false,'Unlocking…','Unlock')}}
    async function onLock(){busy(el.lockButton,true,'Locking…','Lock');try{await api('/api/lock',{method:'POST'});await refreshStatus(true);showToast('Vault locked.')}catch(err){showToast(err instanceof Error?err.message:'Lock failed.')}finally{busy(el.lockButton,false,'Locking…','Lock')}}
    async function onRunCli(ev){ev.preventDefault();await runCliCommandFromUi(String(el.cliCommand.value||''))}

    /* ── Bind ── */
    el.createType.addEventListener('change',switchCreate);
    el.search.addEventListener('input',()=>{if(searchTimer)clearTimeout(searchTimer);searchTimer=setTimeout(()=>{void refreshEntries()},200)});
    el.typeFilter.addEventListener('change',()=>{void refreshEntries()});
    el.refreshButton.addEventListener('click',async ()=>{busy(el.refreshButton,true,'Refreshing…','Refresh');await refreshStatus(true);busy(el.refreshButton,false,'Refreshing…','Refresh')});
    el.reloadEntries.addEventListener('click',async ()=>{busy(el.reloadEntries,true,'Reloading…','Reload');await refreshEntries();busy(el.reloadEntries,false,'Reloading…','Reload')});
    el.lockButton.addEventListener('click',()=>{void onLock()});
    el.initForm.addEventListener('submit',ev=>{void onInit(ev)});
    el.unlockForm.addEventListener('submit',ev=>{void onUnlock(ev)});
    el.createForm.addEventListener('submit',ev=>{void onCreate(ev)});
    el.uploadForm.addEventListener('submit',ev=>{void onUpload(ev)});
    el.detailForm.addEventListener('submit',ev=>{void onSaveDetail(ev)});
    el.copyPassword.addEventListener('click',()=>{void onCopyPassword()});
    el.downloadFile.addEventListener('click',()=>{void onDownload()});
    el.watchVideo.addEventListener('click',()=>{void onWatchVideo()});
    el.toggleFav.addEventListener('click',()=>{void onToggleFav()});
    el.deleteEntry.addEventListener('click',()=>{void onDelete()});
    el.cliForm.addEventListener('submit',ev=>{void onRunCli(ev)});
    el.cliQuickStatus.addEventListener('click',()=>{el.cliCommand.value='status';void runCliCommandFromUi('status')});
    el.cliQuickSync.addEventListener('click',()=>{el.cliCommand.value='sync --status';void runCliCommandFromUi('sync --status')});
    el.cliQuickSettings.addEventListener('click',()=>{el.cliCommand.value='settings';void runCliCommandFromUi('settings')});
    el.closeVideo.addEventListener('click',closeVideoPreview);
    el.videoModal.addEventListener('click',ev=>{if(ev.target===el.videoModal)closeVideoPreview()});
    document.addEventListener('keydown',ev=>{
      if(ev.key==='Escape'&&!el.videoModal.classList.contains('hidden'))closeVideoPreview();
      if(ev.key==='/'&&!el.search.disabled){
        const tn=document.activeElement?.tagName;
        if(tn!=='INPUT'&&tn!=='TEXTAREA'&&tn!=='SELECT'){
          ev.preventDefault();
          el.search.focus();
        }
      }
    });
    el.videoPlayer.addEventListener('error',()=>{showToast('Video playback failed. This codec may not be supported here. Try Download.')});

    /* ── Init ── */
    switchCreate();showDetail('Select an entry to inspect, edit, download, or preview video.');
    void refreshStatus(true).catch(err=>showToast(err instanceof Error?err.message:'Failed to load status.'));
  </script>
</body>
</html>`;
}
