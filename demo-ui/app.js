/**
 * Levora Frontend Demo Application
 * Interacts with Features 10 & 11 Endpoints on http://localhost:3000/api/v1
 */

const BASE_URL = 'http://localhost:3000/api/v1';

// Global Application State
const state = {
  token: null,
  refreshToken: null,
  user: {
    email: 'candidate@levora.app',
    name: 'Fatima Al-Mansoor',
    role: 'user'
  },
  workspaces: [],
  currentWorkspace: null,
  currentPage: null,
  currentVersions: [],
  currentAttachments: [],
  currentProposals: [],
  conversationId: null,
  unreadCount: 0,
  notifications: [],
  autoSaveTimer: null,
  selectedTextRange: null
};

// ── Generic API Helper ──────────────────────────────────────────
async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = { ...(options.headers || {}) };

  if (state.token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    return { ok: false, status: 0, data: { message: err.message } };
  }
}

// ── 0. Automatic Authentication ────────────────────────────────
async function initAuth(role = 'candidate') {
  const overlay = document.getElementById('auth-overlay');
  const title = document.getElementById('auth-title');
  const desc = document.getElementById('auth-desc');
  const retryBox = document.getElementById('auth-retry');

  overlay.classList.remove('hidden');
  retryBox.classList.add('hidden');
  title.innerText = 'Authenticating...';
  desc.innerText = `Connecting to Levora Local API as ${role}...`;

  const credentials = role === 'admin'
    ? { email: 'admin@levora.app', password: 'Password123!' }
    : { email: 'candidate@levora.app', password: 'Password123!' };

  const res = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  });

  if (res.ok && res.data?.data?.accessToken) {
    state.token = res.data.data.accessToken;
    state.refreshToken = res.data.data.refreshToken;
    state.user.role = role === 'admin' ? 'system_admin' : 'user';
    state.user.email = credentials.email;
    state.user.name = role === 'admin' ? 'System Administrator' : 'Fatima Al-Mansoor';

    updateUserUI();
    showToast(`Connected as ${state.user.name}`, 'success');

    // Fade out overlay after short confirmation
    setTimeout(() => {
      overlay.classList.add('hidden');
    }, 400);

    // Initial Data Hydration
    await loadWorkspaces();
    await checkUnreadNotifications();
  } else {
    title.innerText = 'Authentication Failed';
    desc.innerText = 'Unable to connect to local backend server.';
    document.getElementById('auth-error-msg').innerText = res.data?.message || 'Check if NestJS server is running on port 3000.';
    retryBox.classList.remove('hidden');
  }
}

function updateUserUI() {
  const nameEl = document.getElementById('user-display-name');
  const roleEl = document.getElementById('user-display-role');
  const avatarEl = document.getElementById('user-avatar');
  const adminSection = document.getElementById('admin-invite-section');

  nameEl.innerText = state.user.name;
  roleEl.innerText = state.user.role === 'system_admin' ? 'System Admin' : 'Candidate';
  avatarEl.innerText = state.user.role === 'system_admin' ? 'AD' : 'FA';
  if (state.user.role === 'system_admin') {
    avatarEl.style.background = '#f59e0b';
    adminSection?.classList.remove('hidden');
  } else {
    avatarEl.style.background = '#6366f1';
    adminSection?.classList.add('hidden');
  }
}

function toggleUserMenu() {
  document.getElementById('user-menu').classList.toggle('hidden');
}

async function switchUserRole(role) {
  document.getElementById('user-menu').classList.add('hidden');
  await initAuth(role);
}

// ── 2. Draft Workspaces API (/drafts/spaces) ───────────────────
async function loadWorkspaces() {
  const res = await apiRequest('/drafts/spaces');
  if (res.ok && Array.isArray(res.data?.data)) {
    state.workspaces = res.data.data;
    renderWorkspacesList();

    if (state.workspaces.length > 0) {
      await selectWorkspace(state.workspaces[0].slug);
    } else {
      // Auto-create a starter workspace if empty
      await createInitialWorkspace();
    }
  }
}

async function createInitialWorkspace() {
  const res = await apiRequest('/drafts/spaces', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Chevening Scholarship 2026',
      description: 'Essays and statement of purpose for UK master\'s application',
      icon: 'graduation-cap'
    })
  });
  if (res.ok && res.data?.data) {
    state.workspaces = [res.data.data];
    renderWorkspacesList();
    await selectWorkspace(res.data.data.slug);
  }
}

function renderWorkspacesList() {
  const container = document.getElementById('workspaces-list');
  container.innerHTML = state.workspaces.map(ws => `
    <div class="workspace-item ${state.currentWorkspace?.slug === ws.slug ? 'active' : ''}" onclick="selectWorkspace('${ws.slug}')">
      <span>📁 ${escapeHtml(ws.name)}</span>
      <span class="workspace-pages-count">${ws._count?.pages ?? 0}</span>
    </div>
  `).join('');
}

async function selectWorkspace(slug) {
  const res = await apiRequest(`/drafts/spaces/${slug}`);
  if (res.ok && res.data?.data) {
    state.currentWorkspace = res.data.data;
    document.getElementById('current-space-title').innerText = `${state.currentWorkspace.name} Pages`;
    renderWorkspacesList();
    renderPagesTree();
    await loadTags();

    if (state.currentWorkspace.pages && state.currentWorkspace.pages.length > 0) {
      await selectPage(state.currentWorkspace.pages[0].id);
    } else {
      await createNewPage();
    }
  }
}

function openCreateWorkspaceModal() {
  document.getElementById('new-space-name').value = '';
  document.getElementById('new-space-desc').value = '';
  document.getElementById('create-space-modal').classList.remove('hidden');
}

async function createWorkspaceSubmit() {
  const name = document.getElementById('new-space-name').value.trim();
  const desc = document.getElementById('new-space-desc').value.trim();
  if (!name) return showToast('Workspace name required', 'error');

  const res = await apiRequest('/drafts/spaces', {
    method: 'POST',
    body: JSON.stringify({ name, description: desc, icon: 'folder' })
  });

  if (res.ok && res.data?.data) {
    closeAllModals();
    showToast('Workspace created', 'success');
    await loadWorkspaces();
    await selectWorkspace(res.data.data.slug);
  } else {
    showToast(res.data?.message || 'Error creating workspace', 'error');
  }
}

// ── 3. Draft Pages & Auto-Save API (/drafts/spaces/:slug/pages) ─
function renderPagesTree() {
  const container = document.getElementById('pages-tree');
  const pages = state.currentWorkspace?.pages || [];
  if (pages.length === 0) {
    container.innerHTML = '<small class="text-muted" style="padding: 0.5rem">No pages in this workspace.</small>';
    return;
  }

  container.innerHTML = pages.map(p => `
    <div class="page-tree-item ${state.currentPage?.id === p.id ? 'active' : ''}" onclick="selectPage('${p.id}')">
      <span>📄</span>
      <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${escapeHtml(p.title || 'Untitled')}</span>
      <span class="badge badge-${(p.status || 'draft').toLowerCase()}">${p.status || 'DRAFT'}</span>
    </div>
  `).join('');
}

async function selectPage(pageId) {
  if (!state.currentWorkspace) return;
  const res = await apiRequest(`/drafts/spaces/${state.currentWorkspace.slug}/pages/${pageId}`);
  if (res.ok && res.data?.data) {
    state.currentPage = res.data.data;
    populateEditor(state.currentPage);
    renderPagesTree();
    await loadStagedProposals();
  }
}

async function createNewPage() {
  if (!state.currentWorkspace) return;
  const res = await apiRequest(`/drafts/spaces/${state.currentWorkspace.slug}/pages`, {
    method: 'POST',
    body: JSON.stringify({
      title: 'Leadership Essay',
      contentJson: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Leadership & Community Influence' }]
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'I really want to get into your university because it is very good and famous.' }]
          }
        ]
      }
    })
  });

  if (res.ok && res.data?.data) {
    showToast('New draft page created', 'success');
    await selectWorkspace(state.currentWorkspace.slug);
    await selectPage(res.data.data.id);
  }
}

function populateEditor(page) {
  document.getElementById('page-title-input').value = page.title || 'Untitled Draft Document';
  updateStatusBadge(page.status);

  const isFinalized = page.status === 'FINALIZED';
  const editorEl = document.getElementById('editor-content');
  const lockedBanner = document.getElementById('locked-banner');
  const unlockBtn = document.getElementById('unlock-btn');
  const finalizeBtn = document.getElementById('finalize-btn');

  // Convert AST to HTML
  editorEl.innerHTML = astToHtml(page.contentJson);
  editorEl.contentEditable = isFinalized ? 'false' : 'true';

  if (isFinalized) {
    lockedBanner.classList.remove('hidden');
    unlockBtn.classList.remove('hidden');
    finalizeBtn.classList.add('hidden');
    document.getElementById('autosave-indicator').innerText = 'Draft locked';
  } else {
    lockedBanner.classList.add('hidden');
    unlockBtn.classList.add('hidden');
    finalizeBtn.classList.remove('hidden');
    document.getElementById('autosave-indicator').innerText = 'All changes saved';
  }

  updateWordCountChips(page.wordCount || countWords(editorEl.innerText), page.readingTime || 1);
  document.getElementById('attachments-count').innerText = page.attachments?.length || 0;
}

function updateStatusBadge(status = 'DRAFT') {
  const badge = document.getElementById('page-status-badge');
  badge.className = `badge badge-${status.toLowerCase()}`;
  badge.innerText = status;
}

function updateWordCountChips(words, readTime) {
  document.getElementById('word-count-chip').innerText = `${words} words`;
  document.getElementById('reading-time-chip').innerText = `${readTime || Math.ceil(words / 200) || 1} min read`;
}

function handleTitleInput(newTitle) {
  triggerDebouncedAutoSave();
}

function handleEditorInput() {
  triggerDebouncedAutoSave();
  const text = document.getElementById('editor-content').innerText;
  const words = countWords(text);
  updateWordCountChips(words, Math.ceil(words / 200));
}

function triggerDebouncedAutoSave() {
  if (state.currentPage?.status === 'FINALIZED') return;

  document.getElementById('autosave-indicator').innerText = 'Saving...';
  clearTimeout(state.autoSaveTimer);

  state.autoSaveTimer = setTimeout(async () => {
    await executeAutoSave();
  }, 1500);
}

async function executeAutoSave() {
  if (!state.currentPage || !state.currentWorkspace) return;
  const title = document.getElementById('page-title-input').value.trim() || 'Untitled';
  const contentEl = document.getElementById('editor-content');
  const contentJson = htmlToAst(contentEl);

  const res = await apiRequest(`/drafts/spaces/${state.currentWorkspace.slug}/pages/${state.currentPage.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      title,
      contentJson,
      status: state.currentPage.status === 'DRAFT' ? 'IN_PROGRESS' : state.currentPage.status
    })
  });

  if (res.ok && res.data?.data) {
    state.currentPage = res.data.data;
    document.getElementById('autosave-indicator').innerText = 'All changes saved';
    updateStatusBadge(state.currentPage.status);
    renderPagesTree();
  } else if (res.status === 409) {
    document.getElementById('autosave-indicator').innerText = 'Locked';
    showToast('Draft is finalized and locked. Unlock to edit.', 'warning');
    populateEditor(state.currentPage);
  } else {
    document.getElementById('autosave-indicator').innerText = 'Save error';
  }
}

async function deleteCurrentPage() {
  if (!state.currentPage || !confirm('Move this draft page to trash?')) return;
  const res = await apiRequest(`/drafts/spaces/${state.currentWorkspace.slug}/pages/${state.currentPage.id}`, {
    method: 'DELETE'
  });
  if (res.ok) {
    showToast('Page moved to trash', 'info');
    await selectWorkspace(state.currentWorkspace.slug);
  }
}

// ── 4. Version History & Rollback API (/drafts/pages/:id/versions)
async function openVersionsDrawer() {
  if (!state.currentPage) return;
  const res = await apiRequest(`/drafts/pages/${state.currentPage.id}/versions`);
  if (res.ok && Array.isArray(res.data?.data)) {
    state.currentVersions = res.data.data;
    renderVersionsList();
    document.getElementById('versions-drawer').classList.remove('hidden');
  }
}

function renderVersionsList() {
  const container = document.getElementById('versions-list');
  if (state.currentVersions.length === 0) {
    container.innerHTML = '<small class="text-muted">No snapshots recorded yet.</small>';
    return;
  }
  container.innerHTML = state.currentVersions.map(v => `
    <div class="version-item">
      <div class="version-meta">
        <h5>Snapshot #${v.versionNumber || 1}: ${escapeHtml(v.title || 'Draft')}</h5>
        <small>${new Date(v.createdAt).toLocaleTimeString()} &bull; ${v.wordCount || 0} words</small>
      </div>
      <button class="btn btn-secondary btn-xs" onclick="revertToVersion('${v.id}')">Rollback</button>
    </div>
  `).join('');
}

async function revertToVersion(versionId) {
  if (!confirm('Revert draft to this snapshot? A backup snapshot of the current state will be created.')) return;
  const res = await apiRequest(`/drafts/pages/${state.currentPage.id}/versions/${versionId}/revert`, {
    method: 'POST'
  });
  if (res.ok && res.data?.data) {
    showToast('Draft rolled back to selected snapshot', 'success');
    closeAllDrawers();
    await selectPage(state.currentPage.id);
  } else {
    showToast(res.data?.message || 'Rollback failed', 'error');
  }
}

// ── 5. PDF Finalization & Lock Lifecycle (/drafts/pages/:id) ─────
async function finalizeCurrentDraft() {
  if (!state.currentPage) return;
  if (!confirm('Finalize this draft? It will be compiled into an official PDF and activated in your profile.')) return;

  const res = await apiRequest(`/drafts/pages/${state.currentPage.id}/finalize`, {
    method: 'POST',
    body: JSON.stringify({ displayName: `${state.currentPage.title || 'Statement'}.pdf` })
  });

  if (res.ok && res.data?.data) {
    showToast('Draft compiled to PDF & locked!', 'success');
    let pdfUrl = res.data.data.downloadUrl || res.data.data.pdfUrl;
    if (pdfUrl) {
      if (pdfUrl.startsWith('/')) {
        pdfUrl = `http://localhost:3000${pdfUrl}`;
      }
      window.open(pdfUrl, '_blank');
    }
    await selectPage(state.currentPage.id);
    await checkUnreadNotifications();
  } else {
    showToast(res.data?.message || 'Finalization error', 'error');
  }
}

async function unlockCurrentDraft() {
  if (!state.currentPage) return;
  const res = await apiRequest(`/drafts/pages/${state.currentPage.id}/unlock`, {
    method: 'POST'
  });
  if (res.ok) {
    showToast('Draft unlocked for editing', 'info');
    await selectPage(state.currentPage.id);
  }
}

// ── 6. Embedded Media & Attachments (/drafts/spaces/.../attachments)
async function openAttachmentsDrawer() {
  if (!state.currentPage) return;
  await loadAttachments();
  document.getElementById('attachments-drawer').classList.remove('hidden');
}

async function loadAttachments() {
  const res = await apiRequest(`/drafts/spaces/${state.currentWorkspace.slug}/pages/${state.currentPage.id}`);
  if (res.ok && res.data?.data) {
    state.currentAttachments = res.data.data.attachments || [];
    renderAttachmentsList();
  }
}

function renderAttachmentsList() {
  const container = document.getElementById('attachments-list');
  if (state.currentAttachments.length === 0) {
    container.innerHTML = '<small class="text-muted">No files attached to this page.</small>';
    return;
  }
  container.innerHTML = state.currentAttachments.map(att => `
    <div class="attachment-item">
      <div>
        <strong>${escapeHtml(att.filename || 'File')}</strong><br>
        <small class="text-muted">${Math.round((att.sizeBytes || 0) / 1024)} KB &bull; ${att.mimeType || 'binary'}</small>
      </div>
      <div style="display: flex; gap: 0.3rem">
        <button class="btn btn-secondary btn-xs" onclick="downloadAttachment('${att.id}')">Download</button>
        <button class="btn btn-danger btn-xs" onclick="deleteAttachment('${att.id}')">&times;</button>
      </div>
    </div>
  `).join('');
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  const res = await apiRequest(`/drafts/spaces/${state.currentWorkspace.slug}/pages/${state.currentPage.id}/attachments`, {
    method: 'POST',
    body: formData
  });

  if (res.ok) {
    showToast('Attachment uploaded', 'success');
    await loadAttachments();
    document.getElementById('attachments-count').innerText = state.currentAttachments.length;
  } else {
    showToast(res.data?.message || 'Upload failed', 'error');
  }
}

async function downloadAttachment(attachmentId) {
  const res = await apiRequest(`/drafts/spaces/${state.currentWorkspace.slug}/pages/${state.currentPage.id}/attachments/${attachmentId}/download`);
  if (res.ok && res.data?.data?.downloadUrl) {
    let url = res.data.data.downloadUrl;
    if (url.startsWith('/')) {
      url = `http://localhost:3000${url}`;
    }
    window.open(url, '_blank');
  } else {
    showToast('Failed to generate download URL', 'error');
  }
}

async function deleteAttachment(attachmentId) {
  if (!confirm('Delete this attachment?')) return;
  const res = await apiRequest(`/drafts/spaces/${state.currentWorkspace.slug}/pages/${state.currentPage.id}/attachments/${attachmentId}`, {
    method: 'DELETE'
  });
  if (res.ok) {
    showToast('Attachment deleted', 'info');
    await loadAttachments();
    document.getElementById('attachments-count').innerText = state.currentAttachments.length;
  }
}

// ── 7. Workspace Tags (/drafts/spaces/:slug/tags) ───────────────
async function loadTags() {
  if (!state.currentWorkspace) return;
  const res = await apiRequest(`/drafts/spaces/${state.currentWorkspace.slug}/tags`);
  if (res.ok && Array.isArray(res.data?.data)) {
    renderTagsList(res.data.data);
  }
}

function renderTagsList(tags) {
  const container = document.getElementById('tags-list');
  if (tags.length === 0) {
    container.innerHTML = '<small class="text-muted">No tags defined.</small>';
    return;
  }
  container.innerHTML = tags.map(t => `
    <span class="tag-pill" style="border-left: 3px solid ${t.color || '#3b82f6'}">
      ${escapeHtml(t.name)}
    </span>
  `).join('');
}

async function promptCreateTag() {
  const name = prompt('Enter new tag name (e.g. Urgent Revision, Scholarship):');
  if (!name) return;

  const res = await apiRequest(`/drafts/spaces/${state.currentWorkspace.slug}/tags`, {
    method: 'POST',
    body: JSON.stringify({ name: name.trim(), color: '#3b82f6' })
  });

  if (res.ok) {
    showToast('Tag created', 'success');
    await loadTags();
  } else {
    showToast(res.data?.message || 'Error creating tag', 'error');
  }
}

// ── 8. Draft Templates API (/drafts/templates) ──────────────────
async function openTemplatesModal() {
  const res = await apiRequest('/drafts/templates');
  if (res.ok && Array.isArray(res.data?.data)) {
    renderTemplatesGrid(res.data.data);
    document.getElementById('templates-modal').classList.remove('hidden');
  }
}

function renderTemplatesGrid(templates) {
  const container = document.getElementById('templates-grid');
  container.innerHTML = templates.map(t => `
    <div class="template-card">
      <div>
        <span class="template-tag">${t.category || 'general'}</span>
        <h4 style="margin: 0.5rem 0 0.3rem">${escapeHtml(t.title)}</h4>
        <p style="font-size: 0.75rem; color: var(--text-muted)">${escapeHtml(t.description || 'Standard academic structure')}</p>
      </div>
      <button class="btn btn-primary btn-xs" onclick="useTemplate('${t.id}')">Use Template</button>
    </div>
  `).join('');
}

async function useTemplate(templateId) {
  const res = await apiRequest(`/drafts/templates/${templateId}`);
  if (res.ok && res.data?.data) {
    const tpl = res.data.data;
    closeAllModals();

    const pageRes = await apiRequest(`/drafts/spaces/${state.currentWorkspace.slug}/pages`, {
      method: 'POST',
      body: JSON.stringify({
        title: tpl.title,
        contentJson: tpl.contentJson
      })
    });

    if (pageRes.ok && pageRes.data?.data) {
      showToast('Created page from template', 'success');
      await selectWorkspace(state.currentWorkspace.slug);
      await selectPage(pageRes.data.data.id);
    }
  }
}

async function saveCurrentDraftAsTemplate() {
  if (!state.currentPage) return;
  const title = prompt('Template Title:', `${state.currentPage.title} Template`);
  if (!title) return;

  const res = await apiRequest('/drafts/templates', {
    method: 'POST',
    body: JSON.stringify({
      title,
      description: 'Custom academic structure saved from draft',
      category: 'admission',
      contentJson: state.currentPage.contentJson
    })
  });

  if (res.ok) {
    showToast('Saved current draft as template', 'success');
    await openTemplatesModal();
  }
}

// ── 9. In-Editor AI Writing Assistant (/editor/ai) ──────────────
function checkTextSelection() {
  const sel = window.getSelection();
  const text = sel ? sel.toString().trim() : '';
  const toolbar = document.getElementById('floating-ai-toolbar');

  if (text.length > 5 && !state.currentPage?.status?.includes('FINALIZED')) {
    state.selectedTextRange = sel.getRangeAt(0);
    toolbar.classList.remove('hidden');
  } else {
    toolbar.classList.add('hidden');
  }
}

async function applyAiTransform(mode) {
  const selText = window.getSelection()?.toString().trim();
  if (!selText) return;

  document.getElementById('floating-ai-toolbar').classList.add('hidden');
  showToast(`Transforming highlighted text (${mode})...`, 'info');

  const res = await apiRequest('/editor/ai/edit', {
    method: 'POST',
    body: JSON.stringify({ text: selText, mode })
  });

  if (res.ok && res.data?.data?.transformedText) {
    document.execCommand('insertText', false, res.data.data.transformedText);
    handleEditorInput();
    showToast('Text transformed!', 'success');
  } else {
    showToast('AI transformation failed', 'error');
  }
}

function switchAiTab(tab) {
  document.querySelectorAll('.ai-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.ai-tab-panel').forEach(p => p.classList.add('hidden'));

  document.getElementById(`tab-btn-${tab}`).classList.add('active');
  document.getElementById(`tab-content-${tab}`).classList.remove('hidden');
}

function handleChatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
}

async function sendChatMessage() {
  const inputEl = document.getElementById('chat-input');
  const message = inputEl.value.trim();
  if (!message) return;

  inputEl.value = '';
  appendChatBubble('user', message);

  const payload = {
    message,
    conversationId: state.conversationId || undefined,
    pageContext: document.getElementById('editor-content').innerText.slice(0, 500)
  };

  const sendBtn = document.getElementById('send-chat-btn');
  sendBtn.disabled = true;

  const res = await apiRequest('/editor/ai/chat', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  sendBtn.disabled = false;

  if (res.ok && res.data?.data) {
    state.conversationId = res.data.data.conversationId;
    appendChatBubble('ai', res.data.data.reply);
    await loadStagedProposals();
  } else {
    appendChatBubble('ai', 'Sorry, I encountered an issue connecting to Gemini. Please try again.');
  }
}

function appendChatBubble(role, text) {
  const container = document.getElementById('chat-messages');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  bubble.innerHTML = `
    <div class="bubble-header">${role === 'user' ? 'You' : 'Levora Copilot'}</div>
    <p>${escapeHtml(text)}</p>
  `;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

async function generateAiContent() {
  const promptVal = document.getElementById('gen-prompt').value.trim();
  const contextVal = document.getElementById('gen-context').value.trim();
  if (!promptVal) return showToast('Prompt required', 'error');

  const btn = document.getElementById('gen-submit-btn');
  btn.disabled = true;
  btn.innerText = 'Generating with Gemini...';

  const res = await apiRequest('/editor/ai/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt: promptVal, context: contextVal })
  });

  btn.disabled = false;
  btn.innerText = 'Generate Content';

  if (res.ok && res.data?.data?.content) {
    document.getElementById('gen-result-body').innerText = res.data.data.content;
    document.getElementById('gen-result-container').classList.remove('hidden');
  } else {
    showToast('Failed to generate starter content', 'error');
  }
}

function insertGeneratedContent() {
  const content = document.getElementById('gen-result-body').innerText;
  const editor = document.getElementById('editor-content');
  editor.innerHTML += `<p>${escapeHtml(content).replace(/\n/g, '<br>')}</p>`;
  handleEditorInput();
  showToast('Content inserted into active draft', 'success');
}

// ── Staged AI Proposals Diff Review ─────────────────────────────
async function loadStagedProposals() {
  if (!state.currentPage) return;
  const res = await apiRequest(`/editor/ai/proposals/page/${state.currentPage.id}`);
  if (res.ok && Array.isArray(res.data?.data)) {
    state.currentProposals = res.data.data.filter(p => p.status === 'PENDING');
    renderStagedProposals();
  }
}

function renderStagedProposals() {
  const container = document.getElementById('staged-proposals-container');
  const listEl = document.getElementById('proposals-list');
  const countEl = document.getElementById('proposals-count');

  if (state.currentProposals.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  countEl.innerText = state.currentProposals.length;

  listEl.innerHTML = state.currentProposals.map(p => `
    <div class="proposal-card" id="prop-${p.id}">
      <div class="proposal-diff-box">
        <span class="diff-original">&minus; ${escapeHtml(p.originalText)}</span>
        <span class="diff-suggested">&plus; ${escapeHtml(p.suggestedText)}</span>
      </div>
      <div class="proposal-explanation">${escapeHtml(p.explanation || 'AI proposed refinement')}</div>
      <div class="proposal-actions">
        <button class="btn btn-secondary btn-xs" onclick="rejectProposal('${p.id}')">Discard</button>
        <button class="btn btn-success btn-xs" onclick="acceptProposal('${p.id}')">Apply to Document</button>
      </div>
    </div>
  `).join('');
}

async function acceptProposal(proposalId) {
  const res = await apiRequest(`/editor/ai/proposals/${proposalId}/accept`, {
    method: 'POST'
  });

  if (res.ok) {
    showToast('Proposal accepted & applied to document AST', 'success');
    await selectPage(state.currentPage.id);
  } else if (res.status === 409) {
    showToast('Proposal has already been reviewed', 'warning');
    await loadStagedProposals();
  } else {
    showToast('Error accepting proposal', 'error');
  }
}

async function rejectProposal(proposalId) {
  const res = await apiRequest(`/editor/ai/proposals/${proposalId}/reject`, {
    method: 'POST'
  });

  if (res.ok) {
    showToast('Proposal discarded', 'info');
    await loadStagedProposals();
  }
}

// ── 10. Universal Notifications (/notifications) ───────────────
async function checkUnreadNotifications() {
  const res = await apiRequest('/notifications/unread-count');
  if (res.ok && res.data?.data) {
    state.unreadCount = res.data.data.unreadCount || 0;
    const badge = document.getElementById('unread-badge');
    if (state.unreadCount > 0) {
      badge.innerText = state.unreadCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

async function toggleNotificationsDrawer() {
  const drawer = document.getElementById('notifications-drawer');
  drawer.classList.remove('hidden');

  const res = await apiRequest('/notifications');
  if (res.ok && Array.isArray(res.data?.data)) {
    state.notifications = res.data.data;
    renderNotificationsList();
  }
}

function renderNotificationsList() {
  const container = document.getElementById('notifications-list');
  if (state.notifications.length === 0) {
    container.innerHTML = '<small class="text-muted">No notifications.</small>';
    return;
  }

  container.innerHTML = state.notifications.map(n => `
    <div class="notification-item ${n.readAt ? '' : 'unread'}" onclick="markNotificationRead('${n.id}')">
      <div class="notification-title">${escapeHtml(n.payload?.title || n.notificationType?.nameEn || 'Notification')}</div>
      <div class="notification-msg">${escapeHtml(n.payload?.message || 'Update on your account')}</div>
      <small style="color:var(--text-light); font-size:0.65rem">${new Date(n.createdAt).toLocaleString()}</small>
    </div>
  `).join('');
}

async function markNotificationRead(id) {
  await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });
  await checkUnreadNotifications();
  await toggleNotificationsDrawer();
}

async function markAllNotificationsRead() {
  await apiRequest('/notifications/read-all', { method: 'PATCH' });
  showToast('All notifications marked as read', 'info');
  await checkUnreadNotifications();
  await toggleNotificationsDrawer();
}

// ── 11. Controlled Onboarding via Invitations (/auth) ───────────
function openInvitationsModal() {
  document.getElementById('invitations-modal').classList.remove('hidden');
}

async function issueInvitation() {
  const email = document.getElementById('invite-email').value.trim();
  if (!email) return showToast('Email required', 'error');

  const res = await apiRequest('/auth/invitations', {
    method: 'POST',
    body: JSON.stringify({ email, expiresInDays: 7 })
  });

  if (res.ok && res.data?.data) {
    const invite = res.data.data;
    const token = invite.token || invite.inviteUrl?.split('token=')[1];
    document.getElementById('invite-link-display').value = invite.inviteUrl || token;
    document.getElementById('validate-token-input').value = token;
    document.getElementById('invite-result').classList.remove('hidden');
    showToast('Invitation generated successfully', 'success');
  } else {
    showToast(res.data?.message || 'Admin privileges required', 'error');
  }
}

function copyInviteLink() {
  const input = document.getElementById('invite-link-display');
  input.select();
  document.execCommand('copy');
  showToast('Copied invitation link to clipboard', 'info');
}

async function validateInviteToken() {
  const token = document.getElementById('validate-token-input').value.trim();
  if (!token) return showToast('Enter token to validate', 'error');

  const badge = document.getElementById('token-validation-badge');
  const regForm = document.getElementById('invite-reg-form');

  const res = await apiRequest(`/auth/invitations/${token}`);
  if (res.ok && res.data?.data?.valid) {
    badge.className = 'token-badge valid';
    badge.innerText = `Token Valid! Designated email: ${res.data.data.email}`;
    badge.classList.remove('hidden');
    regForm.classList.remove('hidden');
  } else {
    badge.className = 'token-badge invalid';
    badge.innerText = 'Token is invalid or expired.';
    badge.classList.remove('hidden');
    regForm.classList.add('hidden');
  }
}

async function registerWithInviteToken() {
  const token = document.getElementById('validate-token-input').value.trim();
  const firstName = document.getElementById('reg-fname').value.trim();
  const lastName = document.getElementById('reg-lname').value.trim();
  const password = document.getElementById('reg-pass').value.trim();

  if (!firstName || !lastName || !password) return showToast('Fill all fields', 'error');

  const res = await apiRequest('/auth/register-with-invite', {
    method: 'POST',
    body: JSON.stringify({ token, firstName, lastName, password })
  });

  if (res.ok) {
    showToast('Account registered successfully via invitation!', 'success');
    closeAllModals();
  } else {
    showToast(res.data?.message || 'Registration failed', 'error');
  }
}

// ── Modals and Drawers Utility ──────────────────────────────────
function closeAllDrawers() {
  document.querySelectorAll('.drawer-overlay').forEach(d => d.classList.add('hidden'));
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
}

function closeDrawers(e) {
  if (e.target.classList.contains('drawer-overlay')) closeAllDrawers();
}

function closeModals(e) {
  if (e.target.classList.contains('modal-overlay')) closeAllModals();
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ── AST <-> HTML Conversion Helpers ─────────────────────────────
function astToHtml(ast) {
  if (!ast || !ast.content) return '<p></p>';
  return ast.content.map(node => {
    if (node.type === 'heading') {
      const text = (node.content || []).map(c => escapeHtml(c.text || '')).join('');
      return `<h1>${text}</h1>`;
    }
    if (node.type === 'paragraph') {
      const text = (node.content || []).map(c => escapeHtml(c.text || '')).join('');
      return `<p>${text}</p>`;
    }
    return '';
  }).join('');
}

function htmlToAst(el) {
  const nodes = [];
  el.childNodes.forEach(child => {
    if (child.nodeName === 'H1' || child.nodeName === 'H2') {
      nodes.push({
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: child.innerText || '' }]
      });
    } else if (child.nodeName === 'P' || child.nodeType === 3) {
      const text = child.innerText || child.textContent || '';
      if (text.trim()) {
        nodes.push({
          type: 'paragraph',
          content: [{ type: 'text', text }]
        });
      }
    }
  });

  if (nodes.length === 0) {
    nodes.push({ type: 'paragraph', content: [{ type: 'text', text: el.innerText || '' }] });
  }

  return { type: 'doc', content: nodes };
}

function countWords(str) {
  return str ? str.trim().split(/\s+/).filter(Boolean).length : 0;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── App Startup Entry Point ─────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  initAuth('candidate');
});
