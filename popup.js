const systemPromptEl = document.getElementById('systemPrompt');
const promptInputEl = document.getElementById('promptInput');
const promptListEl = document.getElementById('promptList');
const promptCountEl = document.getElementById('promptCount');
const emptyStateEl = document.getElementById('emptyState');
const addPromptBtn = document.getElementById('addPromptBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const listActionsEl = document.getElementById('listActions');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const progressContainer = document.getElementById('progressContainer');
const progressLabel = document.getElementById('progressLabel');
const progressPercent = document.getElementById('progressPercent');
const progressFill = document.getElementById('progressFill');
const logOutput = document.getElementById('logOutput');

let prompts = [];
let editingIndex = -1;

function log(message, type = 'info') {
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.innerHTML = `<span class="time">[${time}]</span> ${message}`;
  logOutput.appendChild(entry);
  logOutput.scrollTop = logOutput.scrollHeight;
}

function setStatus(text, state) {
  statusText.textContent = text;
  statusDot.className = 'status-indicator ' + state;
}

function updateProgress(current, total) {
  if (total === 0) {
    progressContainer.style.display = 'none';
    return;
  }
  progressContainer.style.display = 'block';
  progressLabel.textContent = `Prompt ${current} / ${total}`;
  const pct = Math.round((current / total) * 100);
  progressPercent.textContent = `${pct}%`;
  progressFill.style.width = `${pct}%`;
}

function setButtons(state) {
  if (state === 'idle') {
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    stopBtn.disabled = true;
    pauseBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg> Pause`;
    pauseBtn.classList.remove('active');
    systemPromptEl.disabled = false;
    promptInputEl.disabled = false;
    addPromptBtn.disabled = false;
    setPromptListInteractive(true);
  } else if (state === 'running') {
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    stopBtn.disabled = false;
    systemPromptEl.disabled = true;
    promptInputEl.disabled = true;
    addPromptBtn.disabled = true;
    setPromptListInteractive(false);
  } else if (state === 'paused') {
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    stopBtn.disabled = false;
    pauseBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Resume`;
    pauseBtn.classList.add('active');
  }
}

function setPromptListInteractive(enabled) {
  const items = promptListEl.querySelectorAll('.prompt-item');
  items.forEach(item => {
    const btns = item.querySelectorAll('.prompt-action-btn');
    btns.forEach(btn => {
      btn.disabled = !enabled;
      btn.style.pointerEvents = enabled ? 'auto' : 'none';
    });
  });
  clearAllBtn.disabled = !enabled;
}

function renderPromptList() {
  const items = promptListEl.querySelectorAll('.prompt-item');
  items.forEach(item => item.remove());

  promptCountEl.textContent = prompts.length;

  if (prompts.length === 0) {
    emptyStateEl.style.display = 'flex';
    listActionsEl.style.display = 'none';
    return;
  }

  emptyStateEl.style.display = 'none';
  listActionsEl.style.display = 'flex';

  prompts.forEach((prompt, index) => {
    const item = document.createElement('div');
    item.className = 'prompt-item';
    item.dataset.index = index;

    const number = document.createElement('div');
    number.className = 'prompt-number';
    number.textContent = index + 1;

    const text = document.createElement('div');
    text.className = 'prompt-text';
    text.textContent = prompt;

    const editInput = document.createElement('textarea');
    editInput.className = 'prompt-edit-input';
    editInput.value = prompt;

    const editActions = document.createElement('div');
    editActions.className = 'prompt-edit-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.style.padding = '5px 12px';
    saveBtn.style.fontSize = '11.5px';
    saveBtn.style.borderRadius = '6px';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
      const newText = editInput.value.trim();
      if (newText) {
        prompts[index] = newText;
        savePrompts();
        renderPromptList();
        log(`Prompt ${index + 1} updated`, 'success');
      }
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn';
    cancelBtn.style.padding = '5px 12px';
    cancelBtn.style.fontSize = '11.5px';
    cancelBtn.style.borderRadius = '6px';
    cancelBtn.style.background = '#F1F5F9';
    cancelBtn.style.color = '#64748B';
    cancelBtn.style.border = '1.5px solid #E2E8F0';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      renderPromptList();
    });

    editActions.appendChild(saveBtn);
    editActions.appendChild(cancelBtn);

    const actions = document.createElement('div');
    actions.className = 'prompt-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'prompt-action-btn edit';
    editBtn.title = 'Edit';
    editBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    editBtn.addEventListener('click', () => {
      item.classList.add('editing');
      text.style.display = 'none';
      editInput.style.display = 'block';
      editActions.style.display = 'flex';
      editInput.focus();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'prompt-action-btn delete';
    deleteBtn.title = 'Remove';
    deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
    deleteBtn.addEventListener('click', () => {
      prompts.splice(index, 1);
      savePrompts();
      renderPromptList();
      log(`Prompt ${index + 1} removed`, 'warning');
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(number);
    item.appendChild(text);
    item.appendChild(editInput);
    item.appendChild(editActions);
    item.appendChild(actions);

    promptListEl.appendChild(item);
  });
}

function savePrompts() {
  promptCountEl.textContent = prompts.length;
  chrome.storage.local.set({ prompts });
}

function loadPrompts() {
  return new Promise(resolve => {
    chrome.storage.local.get('prompts', (data) => {
      prompts = data.prompts || [];
      promptCountEl.textContent = prompts.length;
      renderPromptList();
      resolve();
    });
  });
}

addPromptBtn.addEventListener('click', () => {
  const text = promptInputEl.value.trim();
  if (!text) {
    log('Enter a prompt first', 'warning');
    return;
  }
  prompts.push(text);
  savePrompts();
  renderPromptList();
  promptInputEl.value = '';
  promptInputEl.focus();
  log(`Prompt ${prompts.length} added`, 'success');
});

promptInputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    addPromptBtn.click();
  }
});

clearAllBtn.addEventListener('click', () => {
  if (prompts.length === 0) return;
  prompts = [];
  savePrompts();
  renderPromptList();
  log('All prompts cleared', 'warning');
});

async function getGeminiTab() {
  const tabs = await chrome.tabs.query({ url: 'https://gemini.google.com/*' });
  if (tabs.length === 0) return null;
  return tabs[0];
}

async function sendMessageToContentScript(action, data = {}) {
  const tab = await getGeminiTab();
  if (!tab) {
    setStatus('Gemini tab not found', 'error');
    log('No Gemini tab found. Open gemini.google.com/app', 'error');
    return null;
  }
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action, ...data });
    return response;
  } catch (e) {
    setStatus('Connection error', 'error');
    log('Could not connect to Gemini. Try refreshing the page.', 'error');
    return null;
  }
}

startBtn.addEventListener('click', async () => {
  const systemPrompt = systemPromptEl.value.trim();

  if (prompts.length === 0) {
    log('Add at least one prompt', 'warning');
    setStatus('No prompts added', 'error');
    return;
  }

  log(`Starting ${prompts.length} prompt(s)...`, 'running');
  setButtons('running');
  setStatus('Starting...', 'running');
  updateProgress(0, prompts.length);

  await chrome.storage.local.set({
    systemPrompt,
    prompts,
    currentIndex: 0,
    state: 'running',
  });

  const response = await sendMessageToContentScript('start', { systemPrompt, prompts });
  if (!response) {
    setButtons('idle');
    setStatus('Failed to start', 'error');
    updateProgress(0, 0);
  }
});

pauseBtn.addEventListener('click', async () => {
  const data = await chrome.storage.local.get('state');
  const state = data.state || 'idle';
  if (state === 'paused') {
    log('Resuming...', 'running');
    setStatus('Resuming...', 'running');
    await chrome.storage.local.set({ state: 'running' });
    await sendMessageToContentScript('resume');
    setButtons('running');
  } else {
    log('Paused', 'warning');
    setStatus('Paused', 'paused');
    await chrome.storage.local.set({ state: 'paused' });
    await sendMessageToContentScript('pause');
    setButtons('paused');
  }
});

stopBtn.addEventListener('click', async () => {
  log('Stopping...', 'error');
  setStatus('Stopped', 'error');
  await chrome.storage.local.set({ state: 'stopped' });
  await sendMessageToContentScript('stop');
  setButtons('idle');
  updateProgress(0, 0);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'progress') {
    const { currentIndex, total, currentPrompt } = message;
    updateProgress(currentIndex, total);
    setStatus(`Running prompt ${currentIndex}/${total}`, 'running');
    const preview = currentPrompt.substring(0, 50) + (currentPrompt.length > 50 ? '...' : '');
    log(`Prompt ${currentIndex}/${total}: "${preview}"`, 'running');
  } else if (message.type === 'complete') {
    const { currentIndex, total } = message;
    updateProgress(currentIndex, total);
    setStatus('Complete!', 'complete');
    setButtons('idle');
    log('All prompts completed!', 'success');
  } else if (message.type === 'error') {
    setStatus(`Error: ${message.error}`, 'error');
    setButtons('idle');
    log(`Error: ${message.error}`, 'error');
  } else if (message.type === 'prompt_done') {
    const { currentIndex, total } = message;
    log(`Prompt ${currentIndex}/${total} done`, 'success');
  } else if (message.type === 'stopped') {
    setStatus('Stopped', 'error');
    setButtons('idle');
    log('Stopped', 'warning');
  } else if (message.type === 'waiting') {
    setStatus('Waiting for Gemini...', 'running');
    log('Waiting for Gemini response...', 'info');
  } else if (message.type === 'typing') {
    setStatus('Typing prompt...', 'running');
  } else if (message.type === 'paused') {
    setStatus('Paused', 'paused');
    setButtons('paused');
    log('Paused', 'warning');
  } else if (message.type === 'resumed') {
    setStatus('Resuming...', 'running');
    setButtons('running');
    log('Resumed', 'running');
  }
});

async function loadSavedSettings() {
  await loadPrompts();
  const data = await chrome.storage.local.get(['systemPrompt', 'state', 'currentIndex', 'totalPrompts']);
  if (data.systemPrompt) systemPromptEl.value = data.systemPrompt;

  const state = data.state || 'idle';
  if (state === 'running') {
    setButtons('running');
    setStatus('Running...', 'running');
    updateProgress(data.currentIndex || 0, data.totalPrompts || prompts.length);
  } else if (state === 'paused') {
    setButtons('paused');
    setStatus('Paused', 'paused');
    updateProgress(data.currentIndex || 0, data.totalPrompts || prompts.length);
  } else {
    setStatus('Ready', 'ready');
    setButtons('idle');
  }
}

loadSavedSettings();
log('Ready. Open gemini.google.com/app and add prompts.', 'info');