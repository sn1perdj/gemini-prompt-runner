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
const geminiWarning = document.getElementById('geminiWarning');
const openGeminiBtn = document.getElementById('openGeminiBtn');
const newChatToggle = document.getElementById('newChatToggle');
const webhookUrlEl = document.getElementById('webhookUrl');
const downloadResponsesBtn = document.getElementById('downloadResponsesBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Pro mode elements
const proStoryIdeaEl = document.getElementById('proStoryIdea');
const proScriptOutlinerEl = document.getElementById('proScriptOutliner');
const proStoryArchitectEl = document.getElementById('proStoryArchitect');
const proScriptWriterEl = document.getElementById('proScriptWriter');
const proSceneDetailsEl = document.getElementById('proSceneDetails');
const startProBtn = document.getElementById('startProBtn');
const stopProBtn = document.getElementById('stopProBtn');

// Manual mode elements
const modeRadios = document.getElementsByName('proMode');
const playOutlinerBtn = document.getElementById('playOutliner');
const playArchitectBtn = document.getElementById('playArchitect');
const playWriterBtn = document.getElementById('playWriter');
const playSceneBtn = document.getElementById('playScene');

// Extra tab elements
const extraCharacterPromptEl = document.getElementById('extraCharacterPrompt');
const extraLocationPromptEl = document.getElementById('extraLocationPrompt');
const playExtraCharacterBtn = document.getElementById('playExtraCharacter');
const playExtraLocationBtn = document.getElementById('playExtraLocation');

const stepPlayBtns = [playOutlinerBtn, playArchitectBtn, playWriterBtn, playSceneBtn];

Array.from(modeRadios).forEach(radio => {
  radio.addEventListener('change', (e) => {
    const isManual = e.target.value === 'manual';
    stepPlayBtns.forEach(btn => btn.style.display = isManual ? 'flex' : 'none');
    startProBtn.style.display = isManual ? 'none' : 'flex';
  });
});

async function fetchColumnFromSheet(column) {
  const url = webhookUrlEl.value.trim();
  if (!url || !url.startsWith('https://script.google.com')) {
    log('Valid Google Sheets Webhook URL is required.', 'error');
    return null;
  }
  try {
    log(`Fetching data from Column ${column}...`, 'info');
    const res = await fetch(`${url}?action=get&column=${column}`);
    const data = await res.json();
    return data;
  } catch (err) {
    log(`Failed to fetch from sheet: ${err.message}`, 'error');
    return null;
  }
}

let proState = {
  active: false,
  step: '',
  episodes: [],
  currentEpisodeIndex: 0,
  scriptWriterResponses: [],
  currentSceneIndex: 0,
  globalSceneOutputIndex: 0
};

let prompts = [];
const MAX_LOG_ENTRIES = 200;

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    
    btn.classList.add('active');
    const tabId = btn.getAttribute('data-tab');
    document.getElementById(`${tabId}-tab`).classList.add('active');
  });
});

if (settingsBtn && settingsPanel) {
  settingsBtn.addEventListener('click', () => {
    if (settingsPanel.style.display === 'none') {
      settingsPanel.style.display = 'block';
    } else {
      settingsPanel.style.display = 'none';
    }
  });
}

function log(message, type = 'info') {
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  const timeSpan = document.createElement('span');
  timeSpan.className = 'time';
  timeSpan.textContent = `[${time}]`;
  entry.appendChild(timeSpan);
  entry.appendChild(document.createTextNode(` ${message}`));
  logOutput.appendChild(entry);
  logOutput.scrollTop = logOutput.scrollHeight;

  while (logOutput.childElementCount > MAX_LOG_ENTRIES) {
    logOutput.removeChild(logOutput.firstChild);
  }

  persistLog(message, type, time);
}

function persistLog(message, type, time) {
  try {
    chrome.storage.local.get('logEntries', (data) => {
      const entries = data.logEntries || [];
      entries.push({ message, type, time });
      if (entries.length > MAX_LOG_ENTRIES) {
        entries.splice(0, entries.length - MAX_LOG_ENTRIES);
      }
      chrome.storage.local.set({ logEntries: entries });
    });
  } catch (e) {
    // ignore storage errors
  }
}

function restoreLogs() {
  try {
    chrome.storage.local.get('logEntries', (data) => {
      const entries = data.logEntries || [];
      logOutput.innerHTML = '';
      entries.forEach(e => {
        const entry = document.createElement('div');
        entry.className = `log-entry ${e.type}`;
        const timeSpan = document.createElement('span');
        timeSpan.className = 'time';
        timeSpan.textContent = `[${e.time}]`;
        entry.appendChild(timeSpan);
        entry.appendChild(document.createTextNode(` ${e.message}`));
        logOutput.appendChild(entry);
      });
      logOutput.scrollTop = logOutput.scrollHeight;
    });
  } catch (e) {
    // ignore
  }
}

function setStatus(text, state) {
  statusText.textContent = text;
  statusDot.className = 'status-indicator ' + state;
  chrome.storage.local.set({ statusText: text, statusState: state });
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
    newChatToggle.disabled = false;
    setPromptListInteractive(true);
  } else if (state === 'running') {
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    stopBtn.disabled = false;
    systemPromptEl.disabled = true;
    promptInputEl.disabled = true;
    addPromptBtn.disabled = true;
    newChatToggle.disabled = true;
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
  if (!confirm('Clear all prompts? This cannot be undone.')) return;
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
    geminiWarning.style.display = 'flex';
    log('No Gemini tab found. Open gemini.google.com/app', 'error');
    return null;
  }
  geminiWarning.style.display = 'none';
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action, ...data });
    return response;
  } catch (e) {
    setStatus('Connection error', 'error');
    log('Could not connect. Try refreshing the Gemini page.', 'error');
    return null;
  }
}

openGeminiBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://gemini.google.com/app' });
  geminiWarning.style.display = 'none';
  setStatus('Opening Gemini...', 'ready');
  log('Opening gemini.google.com/app...', 'info');
});

startBtn.addEventListener('click', async () => {
  const systemPrompt = systemPromptEl.value.trim();

  if (prompts.length === 0) {
    log('Add at least one prompt', 'warning');
    setStatus('No prompts added', 'error');
    return;
  }

  const newChat = newChatToggle.checked;

  log(`Starting ${prompts.length} prompt(s)...`, 'running');
  setButtons('running');
  setStatus('Starting...', 'running');
  updateProgress(0, prompts.length);

  await chrome.storage.local.set({
    systemPrompt,
    prompts,
    responses: [],
    currentIndex: 0,
    totalPrompts: prompts.length,
    state: 'running',
    newChat,
  });

  const response = await sendMessageToContentScript('start', { systemPrompt, prompts, newChat });
  if (!response) {
    setButtons('idle');
    setStatus('Failed to start', 'error');
    updateProgress(0, 0);
  }
});

pauseBtn.addEventListener('click', async () => {
  const response = await sendMessageToContentScript('status');
  const state = response?.status || 'idle';

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
    chrome.storage.local.set({ state: 'idle' });
  } else if (message.type === 'error') {
    setStatus(`Error: ${message.error}`, 'error');
    setButtons('idle');
    log(`Error: ${message.error}`, 'error');
    chrome.storage.local.set({ state: 'idle' });
  } else if (message.type === 'prompt_done') {
    const { currentIndex, total, response } = message;
    log(`Prompt ${currentIndex}/${total} done`, 'success');
    
    chrome.storage.local.get(['responses', 'webhookUrl', 'prompts'], (data) => {
      const responses = data.responses || [];
      responses[currentIndex - 1] = response || '';
      chrome.storage.local.set({ responses });

      const webhookUrl = data.webhookUrl;
      if (webhookUrl && webhookUrl.startsWith('https://script.google.com')) {
        log(`Sending response ${currentIndex} to Sheets...`, 'info');
        fetch(webhookUrl, {
          method: 'POST',
          body: JSON.stringify({
            prompt: data.prompts[currentIndex - 1],
            response: response || ''
          })
        }).then(() => {
          log(`Response ${currentIndex} saved to Sheets`, 'success');
        }).catch((err) => {
          log(`Error saving to Sheets: ${err.message}`, 'error');
        });
      }
    });
  } else if (message.type === 'stopped') {
    setStatus('Stopped', 'error');
    setButtons('idle');
    log('Stopped', 'warning');
    chrome.storage.local.set({ state: 'idle' });
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
  } else if (message.type === 'pro_progress') {
    setStatus(`Pro: ${message.stepName}`, 'running');
    log(`Pro [${message.stepName}]: ${message.detail}`, 'info');
  } else if (message.type === 'pro_error') {
    setStatus(`Pro Error: ${message.error}`, 'error');
    log(`Pro Error: ${message.error}`, 'error');
    proState.active = false;
    saveProState();
  } else if (message.type === 'pro_stopped') {
    setStatus('Pro Stopped', 'error');
    log('Pro Pipeline Stopped', 'warning');
    proState.active = false;
    saveProState();
  } else if (message.type === 'pro_prompt_done') {
    const { stepName, response, meta } = message;
    log(`Pro Step '${stepName}' done.`, 'success');

    const webhookUrl = webhookUrlEl.value.trim();
    if (webhookUrl && webhookUrl.startsWith('https://script.google.com')) {
      if (stepName !== 'story_architect' && stepName !== 'scene_details') {
        fetch(webhookUrl, {
          method: 'POST',
          body: JSON.stringify({
            mode: 'pro',
            column: meta.col,
            row: meta.row,
            response: response || ''
          })
        }).then(() => log(`Saved to ${meta.col}${meta.row}`, 'success'))
          .catch(err => log(`Error saving to Sheet: ${err.message}`, 'error'));
      }
    }

    if (!proState.active) return;

    if (stepName === 'script_outliner') {
      const architectPrompt = proStoryArchitectEl.value.trim();
      if (!architectPrompt) {
        log('Story Architect prompt missing.', 'warning');
        proState.active = false;
        saveProState();
        return;
      }
      proState.step = 'story_architect';
      saveProState();
      const fullPrompt = `${architectPrompt}\n\n${response}`;
      log('Running Story Architect...', 'running');
      sendMessageToContentScript('run_single', {
        prompt: fullPrompt,
        stepName: 'story_architect',
        isNewChat: newChatToggle.checked,
        meta: { row: 1, col: 'B' }
      });
    } else if (stepName === 'story_architect') {
      const episodes = (response || '').split(/(?:^|\n)(?=[\s\*\-\#\[\]]*Episode\s*\d+)/i).map(e => e.trim()).filter(e => e.length > 0);
      proState.episodes = episodes;
      log(`Found ${episodes.length} episodes.`, 'info');
      
      (async () => {
        if (webhookUrl && webhookUrl.startsWith('https://script.google.com')) {
          for (let idx = 0; idx < episodes.length; idx++) {
            const ep = episodes[idx];
            try {
              await fetch(webhookUrl, {
                method: 'POST',
                body: JSON.stringify({ mode: 'pro', column: 'B', row: idx + 1, response: ep })
              });
              log(`Saved Episode to B${idx + 1}`, 'success');
            } catch (err) {
              log(`Error saving to B${idx + 1}: ${err.message}`, 'error');
            }
          }
        }
        proState.step = 'script_writer';
        proState.currentEpisodeIndex = 0;
        saveProState();
        runNextScriptWriter();
      })();

    } else if (stepName === 'script_writer') {
      proState.scriptWriterResponses.push(response);
      proState.currentEpisodeIndex++;
      saveProState();
      runNextScriptWriter();
    } else if (stepName === 'scene_details') {
      const scenes = (response || '').split(/(?:^|\n)(?=[\s\*\-\#\[\]]*Scene\s*\d+)/i).map(s => s.trim()).filter(s => s.length > 0);
      log(`Found ${scenes.length} scenes.`, 'info');

      (async () => {
        if (webhookUrl && webhookUrl.startsWith('https://script.google.com')) {
          for (const sc of scenes) {
            proState.globalSceneOutputIndex = (proState.globalSceneOutputIndex || 0) + 1;
            const row = proState.globalSceneOutputIndex;
            try {
              await fetch(webhookUrl, {
                method: 'POST',
                body: JSON.stringify({ mode: 'pro', column: 'D', row: row, response: sc })
              });
              log(`Saved to D${row}`, 'success');
            } catch (err) {
              log(`Error saving to D${row}: ${err.message}`, 'error');
            }
          }
        }
        proState.currentSceneIndex++;
        saveProState();
        runNextSceneDetails();
      })();
    } else if (stepName === 'extra_character') {
      let items = (response || '').split(/(?:^|\n)(?=[\s\*\-\#\[\]]*(?:Character|Location)\s*\d*|(?:\d+\.))/i).map(s => s.trim()).filter(s => s.length > 0);
      if (items.length <= 1) {
        items = (response || '').split(/\n\s*\n/).map(s => s.trim()).filter(s => s.length > 0);
      }
      log(`Found ${items.length} character details.`, 'info');

      (async () => {
        if (webhookUrl && webhookUrl.startsWith('https://script.google.com')) {
          for (let i = 0; i < items.length; i++) {
            try {
              await fetch(webhookUrl, {
                method: 'POST',
                body: JSON.stringify({ mode: 'pro', column: 'E', row: i + 1, response: items[i] })
              });
              log(`Saved to E${i + 1}`, 'success');
            } catch (err) {
              log(`Error saving to E${i + 1}: ${err.message}`, 'error');
            }
          }
        }
        proState.active = false;
        saveProState();
      })();
    } else if (stepName === 'extra_location') {
      let items = (response || '').split(/(?:^|\n)(?=[\s\*\-\#\[\]]*(?:Character|Location)\s*\d*|(?:\d+\.))/i).map(s => s.trim()).filter(s => s.length > 0);
      if (items.length <= 1) {
        items = (response || '').split(/\n\s*\n/).map(s => s.trim()).filter(s => s.length > 0);
      }
      log(`Found ${items.length} location details.`, 'info');

      (async () => {
        if (webhookUrl && webhookUrl.startsWith('https://script.google.com')) {
          for (let i = 0; i < items.length; i++) {
            try {
              await fetch(webhookUrl, {
                method: 'POST',
                body: JSON.stringify({ mode: 'pro', column: 'F', row: i + 1, response: items[i] })
              });
              log(`Saved to F${i + 1}`, 'success');
            } catch (err) {
              log(`Error saving to F${i + 1}: ${err.message}`, 'error');
            }
          }
        }
        proState.active = false;
        saveProState();
      })();
    }
  }
});

async function syncStateFromContentScript() {
  const data = await chrome.storage.local.get([
    'state', 'currentIndex', 'totalPrompts', 'statusText', 'statusState'
  ]);

  const response = await sendMessageToContentScript('status');

  if (response) {
    const { status, currentIndex: ci, total } = response;
    if (status === 'running') {
      setButtons('running');
      setStatus('Running...', 'running');
      updateProgress(ci + 1, total || data.totalPrompts || prompts.length);
    } else if (status === 'paused') {
      setButtons('paused');
      setStatus('Paused', 'paused');
      updateProgress(ci + 1, total || data.totalPrompts || prompts.length);
    } else {
      setStatus('Ready', 'ready');
      setButtons('idle');
      updateProgress(0, 0);
    }
  } else {
    const state = data.state || 'idle';
    if (state === 'running') {
      setButtons('running');
      setStatus(data.statusText || 'Running...', data.statusState || 'running');
      updateProgress((data.currentIndex || 0) + 1, data.totalPrompts || prompts.length);
    } else if (state === 'paused') {
      setButtons('paused');
      setStatus(data.statusText || 'Paused', data.statusState || 'paused');
      updateProgress((data.currentIndex || 0) + 1, data.totalPrompts || prompts.length);
    } else {
      setStatus('Ready', 'ready');
      setButtons('idle');
      updateProgress(0, 0);
    }
  }
}

async function loadSavedSettings() {
  await loadPrompts();
  const data = await chrome.storage.local.get([
    'systemPrompt', 'newChat', 'webhookUrl', 
    'proStoryIdea', 'proScriptOutliner', 'proStoryArchitect', 'proScriptWriter', 'proSceneDetails', 'proState',
    'extraCharacterPrompt', 'extraLocationPrompt'
  ]);
  
  if (data.systemPrompt) systemPromptEl.value = data.systemPrompt;
  if (data.newChat !== undefined) newChatToggle.checked = data.newChat;
  if (data.webhookUrl && webhookUrlEl) webhookUrlEl.value = data.webhookUrl;
  
  if (data.proStoryIdea && proStoryIdeaEl) proStoryIdeaEl.value = data.proStoryIdea;
  if (data.proScriptOutliner && proScriptOutlinerEl) proScriptOutlinerEl.value = data.proScriptOutliner;
  if (data.proStoryArchitect && proStoryArchitectEl) proStoryArchitectEl.value = data.proStoryArchitect;
  if (data.proScriptWriter && proScriptWriterEl) proScriptWriterEl.value = data.proScriptWriter;
  if (data.proSceneDetails && proSceneDetailsEl) proSceneDetailsEl.value = data.proSceneDetails;
  if (data.proState) proState = data.proState;

  if (data.extraCharacterPrompt && extraCharacterPromptEl) extraCharacterPromptEl.value = data.extraCharacterPrompt;
  if (data.extraLocationPrompt && extraLocationPromptEl) extraLocationPromptEl.value = data.extraLocationPrompt;

  if (webhookUrlEl) {
    webhookUrlEl.addEventListener('change', () => {
      chrome.storage.local.set({ webhookUrl: webhookUrlEl.value.trim() });
    });
  }

  [proStoryIdeaEl, proScriptOutlinerEl, proStoryArchitectEl, proScriptWriterEl, proSceneDetailsEl, extraCharacterPromptEl, extraLocationPromptEl].forEach(el => {
    if (el) {
      el.addEventListener('change', () => {
        chrome.storage.local.set({
          proStoryIdea: proStoryIdeaEl.value.trim(),
          proScriptOutliner: proScriptOutlinerEl.value.trim(),
          proStoryArchitect: proStoryArchitectEl.value.trim(),
          proScriptWriter: proScriptWriterEl.value.trim(),
          proSceneDetails: proSceneDetailsEl.value.trim(),
          extraCharacterPrompt: extraCharacterPromptEl.value.trim(),
          extraLocationPrompt: extraLocationPromptEl.value.trim()
        });
      });
    }
  });

  restoreLogs();
  await syncStateFromContentScript();
}

loadSavedSettings();

if (downloadResponsesBtn) {
  downloadResponsesBtn.addEventListener('click', () => {
    chrome.storage.local.get(['responses', 'prompts'], (data) => {
      const responses = data.responses || [];
      const savedPrompts = data.prompts || prompts;
      
      if (responses.length === 0 || responses.every(r => !r)) {
        log('No responses to download yet', 'warning');
        return;
      }
      
      let content = '';
      for (let i = 0; i < savedPrompts.length; i++) {
        content += `--- PROMPT ${i + 1} ---\n`;
        content += `${savedPrompts[i]}\n\n`;
        content += `--- RESPONSE ${i + 1} ---\n`;
        content += `${responses[i] || 'No response captured'}\n\n`;
        content += `=========================================\n\n`;
      }
      
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gemini_responses_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      log('Responses downloaded', 'success');
    });
  });
}

function updateProButtons() {
  if (startProBtn) startProBtn.disabled = proState.active;
  if (stopProBtn) stopProBtn.disabled = !proState.active;
}

if (startProBtn) {
  startProBtn.addEventListener('click', async () => {
    const storyIdea = proStoryIdeaEl.value.trim();
    const scriptOutliner = proScriptOutlinerEl.value.trim();
    
    if (!storyIdea || !scriptOutliner) {
      log('Story Idea and Script Outliner prompt are required.', 'error');
      return;
    }

    if (!webhookUrlEl.value.trim().startsWith('https://script.google.com')) {
      log('Google Sheets Webhook URL is required for Pro mode.', 'error');
      return;
    }
    
    proState = {
      active: true,
      step: 'script_outliner',
      episodes: [],
      currentEpisodeIndex: 0,
      scriptWriterResponses: [],
      currentSceneIndex: 0,
      globalSceneOutputIndex: 0
    };
    chrome.storage.local.set({ proState });
    updateProButtons();
    
    const fullPrompt = `${scriptOutliner}\n\n${storyIdea}`;
    log('Starting Pro Pipeline: Script Outliner...', 'running');
    
    await sendMessageToContentScript('run_single', {
      prompt: fullPrompt,
      stepName: 'script_outliner',
      isNewChat: newChatToggle.checked,
      meta: { row: 1, col: 'A' }
    });
  });
}

if (playOutlinerBtn) {
  playOutlinerBtn.addEventListener('click', () => {
    if (startProBtn) startProBtn.click();
  });
}

if (stopProBtn) {
  stopProBtn.addEventListener('click', async () => {
    log('Stopping Pro Pipeline...', 'error');
    proState.active = false;
    chrome.storage.local.set({ proState });
    updateProButtons();
    await sendMessageToContentScript('stop');
  });
}

if (playArchitectBtn) {
  playArchitectBtn.addEventListener('click', async () => {
    const data = await fetchColumnFromSheet('A');
    if (!data || !data[0]) return log('No data found in Column A for Architect', 'error');
    
    proState = {
      active: true, step: 'story_architect', episodes: [],
      currentEpisodeIndex: 0, scriptWriterResponses: [], currentSceneIndex: 0
    };
    saveProState();
    
    const architectPrompt = proStoryArchitectEl.value.trim();
    if (!architectPrompt) return log('Story Architect prompt missing.', 'error');
    const fullPrompt = `${architectPrompt}\n\n${data[0]}`;
    log('Manual Start: Story Architect...', 'running');
    sendMessageToContentScript('run_single', {
      prompt: fullPrompt, stepName: 'story_architect',
      isNewChat: newChatToggle.checked, meta: { row: 1, col: 'B' }
    });
  });
}

if (playWriterBtn) {
  playWriterBtn.addEventListener('click', async () => {
    let data = await fetchColumnFromSheet('B');
    if (!data || data.length === 0) return log('No data found in Column B for Script Writer', 'error');
    
    // Filter out empty rows
    data = data.filter(d => d && d.trim().length > 0);
    if (data.length === 0) return log('No episodes found in Column B', 'error');

    proState = {
      active: true, step: 'script_writer', episodes: data,
      currentEpisodeIndex: 0, scriptWriterResponses: [], currentSceneIndex: 0,
      globalSceneOutputIndex: 0
    };
    saveProState();
    log(`Manual Start: Script Writer with ${data.length} episodes...`, 'running');
    runNextScriptWriter();
  });
}

if (playSceneBtn) {
  playSceneBtn.addEventListener('click', async () => {
    let data = await fetchColumnFromSheet('C');
    if (!data || data.length === 0) return log('No data found in Column C for Scene Details', 'error');
    
    data = data.filter(d => d && d.trim().length > 0);
    if (data.length === 0) return log('No script outputs found in Column C', 'error');

    proState = {
      active: true, step: 'scene_details', episodes: [],
      currentEpisodeIndex: 0, scriptWriterResponses: data, currentSceneIndex: 0,
      globalSceneOutputIndex: 0
    };
    saveProState();
    log(`Manual Start: Scene Details with ${data.length} scenes...`, 'running');
    runNextSceneDetails();
  });
}

function saveProState() {
  chrome.storage.local.set({ proState });
  updateProButtons();
}

function runNextScriptWriter() {
  if (!proState.active) return;
  const idx = proState.currentEpisodeIndex;
  if (idx >= proState.episodes.length) {
    proState.step = 'scene_details';
    proState.currentSceneIndex = 0;
    saveProState();
    runNextSceneDetails();
    return;
  }
  
  const writerPrompt = proScriptWriterEl.value.trim();
  if (!writerPrompt) {
     log('Script Writer prompt missing. Pipeline halted.', 'warning');
     proState.active = false;
     saveProState();
     return;
  }
  
  const epText = proState.episodes[idx];
  const fullPrompt = `${writerPrompt}\n\n${epText}`;
  log(`Running Script Writer for Episode ${idx + 1}...`, 'running');
  sendMessageToContentScript('run_single', {
    prompt: fullPrompt,
    stepName: 'script_writer',
    isNewChat: newChatToggle.checked,
    meta: { row: idx + 1, col: 'C', episodeIndex: idx }
  });
}

function runNextSceneDetails() {
  if (!proState.active) return;
  const idx = proState.currentSceneIndex;
  if (idx >= proState.scriptWriterResponses.length) {
    log('Pro Pipeline complete!', 'success');
    proState.active = false;
    saveProState();
    return;
  }
  
  const scenePrompt = proSceneDetailsEl.value.trim();
  if (!scenePrompt) {
     log('Scene Details prompt missing. Pipeline halted.', 'warning');
     proState.active = false;
     saveProState();
     return;
  }
  
  const writerResponseText = proState.scriptWriterResponses[idx];
  const fullPrompt = `${scenePrompt}\n\n${writerResponseText}`;
  log(`Running Scene Details for Episode ${idx + 1}...`, 'running');
  sendMessageToContentScript('run_single', {
    prompt: fullPrompt,
    stepName: 'scene_details',
    isNewChat: newChatToggle.checked,
    meta: { row: idx + 1, col: 'D', sceneIndex: idx }
  });
}

if (playExtraCharacterBtn) {
  playExtraCharacterBtn.addEventListener('click', async () => {
    let data = await fetchColumnFromSheet('D');
    if (!data || data.length === 0) return log('No data found in Column D', 'error');
    
    data = data.filter(d => d && d.trim().length > 0);
    if (data.length === 0) return log('No scene details found in Column D', 'error');
    
    const combinedData = data.join('\n\n');
    const prompt = extraCharacterPromptEl.value.trim();
    if (!prompt) return log('Character Details prompt missing.', 'error');
    
    const fullPrompt = `${prompt}\n\n${combinedData}`;
    
    proState = {
      active: true, step: 'extra_character'
    };
    saveProState();
    log(`Running Character Details Gen...`, 'running');
    sendMessageToContentScript('run_single', {
      prompt: fullPrompt, stepName: 'extra_character',
      isNewChat: newChatToggle.checked, meta: { col: 'E' }
    });
  });
}

if (playExtraLocationBtn) {
  playExtraLocationBtn.addEventListener('click', async () => {
    let data = await fetchColumnFromSheet('D');
    if (!data || data.length === 0) return log('No data found in Column D', 'error');
    
    data = data.filter(d => d && d.trim().length > 0);
    if (data.length === 0) return log('No scene details found in Column D', 'error');
    
    const combinedData = data.join('\n\n');
    const prompt = extraLocationPromptEl.value.trim();
    if (!prompt) return log('Location Details prompt missing.', 'error');
    
    const fullPrompt = `${prompt}\n\n${combinedData}`;
    
    proState = {
      active: true, step: 'extra_location'
    };
    saveProState();
    log(`Running Location Details Gen...`, 'running');
    sendMessageToContentScript('run_single', {
      prompt: fullPrompt, stepName: 'extra_location',
      isNewChat: newChatToggle.checked, meta: { col: 'F' }
    });
  });
}