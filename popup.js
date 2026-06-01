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
const clearLogBtn = document.getElementById('clearLogBtn');
const geminiWarning = document.getElementById('geminiWarning');
const openGeminiBtn = document.getElementById('openGeminiBtn');
const newChatToggle = document.getElementById('newChatToggle');
const webhookUrlEl = document.getElementById('webhookUrl');
const downloadResponsesBtn = document.getElementById('downloadResponsesBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const stepCheckboxEls = document.querySelectorAll('.step-check');
const stepToggleBtns = document.querySelectorAll('.btn-edit-step');
const promptStepEls = document.querySelectorAll('.prompt-step');

// Pro mode elements
const proStoryIdeaEl = document.getElementById('proStoryIdea');
const proScriptOutlinerEl = document.getElementById('proScriptOutliner');
const proStoryArchitectEl = document.getElementById('proStoryArchitect');
const proScriptWriterEl = document.getElementById('proScriptWriter');
const proStoryCheckEl = document.getElementById('proStoryCheck');
const proStoryFixEl = document.getElementById('proStoryFix');
const proSceneDetailsEl = document.getElementById('proSceneDetails');
const startProBtn = document.getElementById('startProBtn');
const stopProBtn = document.getElementById('stopProBtn');
const proPresetSelectEl = document.getElementById('proPresetSelect');
const newPresetBtn = document.getElementById('newPresetBtn');
const deletePresetBtn = document.getElementById('deletePresetBtn');

const modeRadios = document.getElementsByName('proMode');

// Extra tab elements (removed)
const extraCharacterPromptEl = document.getElementById('extraCharacterPrompt');
const extraLocationPromptEl = document.getElementById('extraLocationPrompt');
const descriptionGeneratorPromptEl = document.getElementById('descriptionGeneratorPrompt');
const thumbnailDetailsPromptEl = document.getElementById('thumbnailDetailsPrompt');
const imagePromptGenEl = document.getElementById('imagePromptGen');
const playImagePromptBtn = document.getElementById('playImagePrompt');
const replayImagePromptBtn = document.getElementById('replayImagePrompt');
const stopImageBtn = document.getElementById('stopImageBtn');
const imageStartSceneEl = document.getElementById('imageStartScene');
const imageRerunSceneEl = document.getElementById('imageRerunScene');
const imageCharacterRefEl = document.getElementById('imageCharacterRef');
const importCharacterRefBtn = document.getElementById('importCharacterRefBtn');

const PRO_MODE_STORAGE_KEY = 'proMode';
const ACTIVE_TAB_STORAGE_KEY = 'activeWorkspaceTab';
const PRO_SELECTED_STEPS_STORAGE_KEY = 'proSelectedSteps';
const PRO_EXPANDED_STEPS_STORAGE_KEY = 'proExpandedSteps';
const STEP_ORDER = [
  'script_outliner',
  'story_architect',
  'script_writer',
  'story_check',
  'story_fix',
  'scene_details',
  'extra_character',
  'extra_location',
  'description_generator',
  'thumbnail_details'
];
const STORY_CHECK_OUTPUT_STORAGE_KEY = 'storyCheckOutput';

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

function normalizeSceneNumbers(dataArray) {
  if (!Array.isArray(dataArray)) return dataArray;
  return dataArray.map((d, index) => {
    if (d == null) return '';
    let text = d.toString();
    const expectedSceneNumber = index + 1;
    return text.replace(/((?:Scene|दृश्य)\s*#?:?\s*)\d+/i, `$1${expectedSceneNumber}`);
  });
}

function normalizeSheetRow(row) {
  if (row && typeof row === 'object' && row.row != null) {
    row = row.row;
  }

  const normalized = Number.parseInt(row, 10);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

async function saveSheetCell(column, row, response) {
  const url = webhookUrlEl.value.trim();
  if (!url || !url.startsWith('https://script.google.com')) {
    log('Valid Google Sheets Webhook URL is required.', 'error');
    return false;
  }

  const normalizedRow = normalizeSheetRow(row);
  if (!normalizedRow) {
    log(`Invalid sheet row for ${column}: ${JSON.stringify(row)}`, 'error');
    return false;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'pro', column, row: normalizedRow, response })
    });
    const text = await res.text();
    if (!res.ok || !/success/i.test(text)) {
      throw new Error(text || `HTTP ${res.status}`);
    }
    return true;
  } catch (err) {
    log(`Error saving to ${column}${row}: ${err.message}`, 'error');
    return false;
  }
}

async function saveSheetBatch(column, entries) {
  const url = webhookUrlEl.value.trim();
  if (!url || !url.startsWith('https://script.google.com')) {
    log('Valid Google Sheets Webhook URL is required.', 'error');
    return false;
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    return true;
  }

  const normalizedEntries = entries.map(entry => ({
    row: normalizeSheetRow(entry.row),
    response: entry.response
  }));

  const invalidEntry = normalizedEntries.find(entry => !entry.row);
  if (invalidEntry) {
    log(`Invalid batch row for ${column}: ${JSON.stringify(invalidEntry)}`, 'error');
    return false;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'pro',
        batch: normalizedEntries.map(entry => ({
          column,
          row: entry.row,
          response: entry.response
        }))
      })
    });
    const text = await res.text();
    if (!res.ok || !/success/i.test(text)) {
      throw new Error(text || `HTTP ${res.status}`);
    }
    return true;
  } catch (err) {
    log(`Batch save failed for column ${column}: ${err.message}`, 'warning');
    log(`Falling back to single-cell saves for column ${column}...`, 'info');

    let allSaved = true;
    for (const entry of normalizedEntries) {
      const saved = await saveSheetCell(column, entry.row, entry.response);
      if (!saved) {
        allSaved = false;
      }
    }
    return allSaved;
  }
}

function parseImagePromptSceneTag(text) {
  const match = (text || '').toString().match(/\bs(\d+)p(\d+)\b/i);
  if (!match) return null;
  return {
    scene: parseInt(match[1], 10),
    prompt: parseInt(match[2], 10)
  };
}

function ensureImagePromptTag(prompt, sceneNumber, promptNumber) {
  let text = (prompt || '').trim();
  const expectedTag = `s${sceneNumber}p${promptNumber}`;
  const existingTag = parseImagePromptSceneTag(text);
  
  if (existingTag) {
    return text.replace(/\bs\d+p\d+\b/i, expectedTag);
  }
  
  return `${expectedTag}\n${text}`;
}

function parseImagePromptBlock(block) {
  const lines = (block || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length === 0) {
    return { storyLine: '', promptText: '' };
  }

  const firstLine = lines[0];
  const bracketedStoryLineMatch = firstLine.match(/^\[(.+)\]$/);
  if (bracketedStoryLineMatch) {
    return {
      storyLine: bracketedStoryLineMatch[1].trim(),
      promptText: lines.slice(1).join('\n').trim()
    };
  }

  // Fallback: If no brackets are used, find the first line that contains a tag like s1p1
  let tagLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/\bs\d+p\d+\b/i)) {
      tagLineIndex = i;
      break;
    }
  }

  if (tagLineIndex > 0) {
    return {
      storyLine: lines.slice(0, tagLineIndex).join('\n').trim(),
      promptText: lines.slice(tagLineIndex).join('\n').trim()
    };
  }

  return {
    storyLine: '',
    promptText: lines.join('\n').trim()
  };
}

function extractCharacterRefName(characterText) {
  const text = (characterText || '').toString().trim();
  if (!text) return '';

  const dashMatch = text.match(/^(.*?)(?:\s+[—-]\s+)(.*)$/);
  if (dashMatch) {
    return dashMatch[1].trim();
  }

  return text.split('\n')[0].trim();
}

async function importCharacterRefsFromSheet() {
  let data = await fetchColumnFromSheet('E');
  if (!Array.isArray(data) || data.length === 0) {
    log('No character details found in Column E.', 'warning');
    return;
  }

  const names = data
    .map(extractCharacterRefName)
    .filter(name => name.length > 0);

  if (names.length === 0) {
    log('No valid character names found in Column E.', 'warning');
    return;
  }

  const lines = names.map((name, index) => `@img${index + 1} as ${name}`);
  lines.push(`@img${names.length + 1} as progession for location`);

  if (imageCharacterRefEl) {
    imageCharacterRefEl.value = lines.join('\n');
    await chrome.storage.local.set({ imageCharacterRef: imageCharacterRefEl.value.trim() });
  }

  log(`Imported ${names.length} character reference(s) from column E.`, 'success');
}

function splitEpisodes(text) {
  return (text || '')
    .split(/(?:^|\n)(?=[\s\*\-\#\[\]]*(?:Episode|एपिसोड)\s*\d+)/i)
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

function buildStoryFixPrompt(prompt, correctionInput, storyInput) {
  return `${(prompt || '').trim()}

<correction_input>
${(correctionInput || '').trim()}
</correction_input>

<story_input>
${(storyInput || '').trim()}
</story_input>`;
}

async function saveEpisodesToColumnC(episodes) {
  const normalizedEpisodes = Array.isArray(episodes)
    ? episodes.map(item => (item || '').trim()).filter(item => item.length > 0)
    : [];

  let existingStories = await fetchColumnFromSheet('C');
  existingStories = Array.isArray(existingStories)
    ? existingStories.filter(item => item && item.trim().length > 0)
    : [];

  const totalRows = Math.max(existingStories.length, normalizedEpisodes.length);
  const batchEntries = [];

  for (let i = 0; i < totalRows; i++) {
    batchEntries.push({
      row: i + 1,
      response: normalizedEpisodes[i] || ''
    });
  }

  if (webhookUrlEl.value.trim().startsWith('https://script.google.com')) {
    const saved = await saveSheetBatch('C', batchEntries);
    if (saved) {
      log(`Saved ${normalizedEpisodes.length} episode(s) to column C`, 'success');
    }
  }

  return normalizedEpisodes;
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
const PRO_PRESET_STORAGE_KEY = 'proPromptPresets';
const ACTIVE_PRO_PRESET_STORAGE_KEY = 'activeProPromptPresetId';
let proPromptPresets = {};
let activeProPresetId = '';
let isApplyingProPreset = false;
let proPresetSaveTimer = null;

function getProMode() {
  const selected = Array.from(modeRadios).find(radio => radio.checked);
  return selected ? selected.value : 'auto';
}

function setProMode(mode, persist = true) {
  const nextMode = mode === 'manual' ? 'manual' : 'auto';
  Array.from(modeRadios).forEach(radio => {
    radio.checked = radio.value === nextMode;
  });
  updateProButtons();
  if (persist) {
    chrome.storage.local.set({ [PRO_MODE_STORAGE_KEY]: nextMode });
  }
}

function getSelectedProSteps() {
  return Array.from(stepCheckboxEls)
    .filter(checkbox => checkbox.checked)
    .map(checkbox => checkbox.dataset.step)
    .filter(Boolean);
}

function applySelectedProSteps(stepIds = [], persist = true) {
  const selected = new Set(stepIds);
  stepCheckboxEls.forEach(checkbox => {
    checkbox.checked = selected.has(checkbox.dataset.step);
  });
  updateProButtons();
  if (persist) {
    chrome.storage.local.set({ [PRO_SELECTED_STEPS_STORAGE_KEY]: getSelectedProSteps() });
  }
}

function applyExpandedSteps(stepIds = [], persist = true) {
  const expanded = new Set(stepIds);
  promptStepEls.forEach(stepEl => {
    stepEl.classList.toggle('expanded', expanded.has(stepEl.dataset.step));
  });
  if (persist) {
    const openSteps = Array.from(promptStepEls)
      .filter(stepEl => stepEl.classList.contains('expanded'))
      .map(stepEl => stepEl.dataset.step);
    chrome.storage.local.set({ [PRO_EXPANDED_STEPS_STORAGE_KEY]: openSteps });
  }
}

function setActiveTab(tabId, persist = true) {
  tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  tabContents.forEach(content => {
    content.classList.toggle('active', content.id === `${tabId}-tab`);
  });
  if (persist) {
    chrome.storage.local.set({ [ACTIVE_TAB_STORAGE_KEY]: tabId });
  }
}

function updateProRunButtonLabel() {
  if (!startProBtn) return;
  const mode = getProMode();
  const selectedCount = getSelectedProSteps().length;
  const label = startProBtn.lastChild && startProBtn.lastChild.nodeType === Node.TEXT_NODE
    ? startProBtn.lastChild
    : null;

  let nextText = ' Start Pro Pipeline';
  if (mode === 'manual') {
    nextText = selectedCount === 1 ? ' Replay Selected Step' : ' Run Selected Steps';
  }

  if (label) {
    label.textContent = nextText;
  } else {
    startProBtn.append(document.createTextNode(nextText));
  }
}

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tabId = btn.getAttribute('data-tab');
    setActiveTab(tabId);
  });
});

Array.from(modeRadios).forEach(radio => {
  radio.addEventListener('change', () => {
    setProMode(radio.value);
  });
});

stepCheckboxEls.forEach(checkbox => {
  checkbox.addEventListener('change', () => {
    applySelectedProSteps(getSelectedProSteps());
  });
});

stepToggleBtns.forEach(button => {
  button.addEventListener('click', () => {
    const stepId = button.dataset.toggleStep;
    const stepEl = document.querySelector(`.prompt-step[data-step="${stepId}"]`);
    if (!stepEl) return;
    stepEl.classList.toggle('expanded');
    applyExpandedSteps(
      Array.from(promptStepEls)
        .filter(item => item.classList.contains('expanded'))
        .map(item => item.dataset.step)
    );
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
  if (!logOutput) return;
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
      if (!logOutput) return;
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
  if (statusText) {
    statusText.textContent = text;
  }
  if (statusDot) {
    statusDot.className = 'status-indicator ' + state;
  }
  chrome.storage.local.set({ statusText: text, statusState: state });
}

function clearActivityLog() {
  if (logOutput) {
    logOutput.innerHTML = '';
  }
  chrome.storage.local.remove('logEntries');
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

function createPresetId() {
  return `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePresetName(name) {
  return (name || '').trim().replace(/\s+/g, ' ');
}

function getCurrentProPromptValues() {
  return {
    proStoryIdea: proStoryIdeaEl ? proStoryIdeaEl.value.trim() : '',
    proScriptOutliner: proScriptOutlinerEl ? proScriptOutlinerEl.value.trim() : '',
    proStoryArchitect: proStoryArchitectEl ? proStoryArchitectEl.value.trim() : '',
    proScriptWriter: proScriptWriterEl ? proScriptWriterEl.value.trim() : '',
    proStoryCheck: proStoryCheckEl ? proStoryCheckEl.value.trim() : '',
    proStoryFix: proStoryFixEl ? proStoryFixEl.value.trim() : '',
    proSceneDetails: proSceneDetailsEl ? proSceneDetailsEl.value.trim() : '',
    extraCharacterPrompt: extraCharacterPromptEl ? extraCharacterPromptEl.value.trim() : '',
    extraLocationPrompt: extraLocationPromptEl ? extraLocationPromptEl.value.trim() : '',
    descriptionGeneratorPrompt: descriptionGeneratorPromptEl ? descriptionGeneratorPromptEl.value.trim() : '',
    thumbnailDetailsPrompt: thumbnailDetailsPromptEl ? thumbnailDetailsPromptEl.value.trim() : '',
    imagePromptGen: imagePromptGenEl ? imagePromptGenEl.value.trim() : ''
  };
}

function applyProPromptValues(values = {}) {
  isApplyingProPreset = true;
  if (proStoryIdeaEl) proStoryIdeaEl.value = values.proStoryIdea || '';
  if (proScriptOutlinerEl) proScriptOutlinerEl.value = values.proScriptOutliner || '';
  if (proStoryArchitectEl) proStoryArchitectEl.value = values.proStoryArchitect || '';
  if (proScriptWriterEl) proScriptWriterEl.value = values.proScriptWriter || '';
  if (proStoryCheckEl) proStoryCheckEl.value = values.proStoryCheck || '';
  if (proStoryFixEl) proStoryFixEl.value = values.proStoryFix || '';
  if (proSceneDetailsEl) proSceneDetailsEl.value = values.proSceneDetails || '';
  if (extraCharacterPromptEl) extraCharacterPromptEl.value = values.extraCharacterPrompt || '';
  if (extraLocationPromptEl) extraLocationPromptEl.value = values.extraLocationPrompt || '';
  if (descriptionGeneratorPromptEl) descriptionGeneratorPromptEl.value = values.descriptionGeneratorPrompt || '';
  if (thumbnailDetailsPromptEl) thumbnailDetailsPromptEl.value = values.thumbnailDetailsPrompt || '';
  if (imagePromptGenEl) imagePromptGenEl.value = values.imagePromptGen || '';
  isApplyingProPreset = false;
}

function renderProPresetOptions() {
  if (!proPresetSelectEl) return;

  const presetList = Object.values(proPromptPresets).sort((a, b) => a.name.localeCompare(b.name));
  proPresetSelectEl.innerHTML = '';

  presetList.forEach(preset => {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.name;
    proPresetSelectEl.appendChild(option);
  });

  if (activeProPresetId && proPromptPresets[activeProPresetId]) {
    proPresetSelectEl.value = activeProPresetId;
  }

  const hasMultiplePresets = presetList.length > 1;
  if (deletePresetBtn) deletePresetBtn.disabled = !hasMultiplePresets;
}

async function persistProPresetState() {
  await chrome.storage.local.set({
    [PRO_PRESET_STORAGE_KEY]: proPromptPresets,
    [ACTIVE_PRO_PRESET_STORAGE_KEY]: activeProPresetId
  });
}

async function switchProPreset(presetId, options = {}) {
  if (!presetId || !proPromptPresets[presetId]) return;

  activeProPresetId = presetId;
  renderProPresetOptions();
  applyProPromptValues(proPromptPresets[presetId].values);
  await persistProPresetState();

  if (!options.silent) {
    log(`Loaded preset "${proPromptPresets[presetId].name}"`, 'success');
  }
}

async function saveActiveProPresetValues(options = {}) {
  if (isApplyingProPreset || !activeProPresetId || !proPromptPresets[activeProPresetId]) return;

  const values = getCurrentProPromptValues();
  proPromptPresets[activeProPresetId] = {
    ...proPromptPresets[activeProPresetId],
    values
  };

  await chrome.storage.local.set({
    proStoryIdea: values.proStoryIdea,
    proScriptOutliner: values.proScriptOutliner,
    proStoryArchitect: values.proStoryArchitect,
    proScriptWriter: values.proScriptWriter,
    proStoryCheck: values.proStoryCheck,
    proStoryFix: values.proStoryFix,
    proSceneDetails: values.proSceneDetails,
    extraCharacterPrompt: values.extraCharacterPrompt,
    extraLocationPrompt: values.extraLocationPrompt,
    descriptionGeneratorPrompt: values.descriptionGeneratorPrompt,
    thumbnailDetailsPrompt: values.thumbnailDetailsPrompt,
    imagePromptGen: values.imagePromptGen,
    [PRO_PRESET_STORAGE_KEY]: proPromptPresets,
    [ACTIVE_PRO_PRESET_STORAGE_KEY]: activeProPresetId
  });

  if (!options.silent) {
    log(`Saved preset "${proPromptPresets[activeProPresetId].name}"`, 'info');
  }
}

function scheduleSaveActiveProPreset() {
  if (proPresetSaveTimer) {
    clearTimeout(proPresetSaveTimer);
  }

  proPresetSaveTimer = window.setTimeout(() => {
    proPresetSaveTimer = null;
    saveActiveProPresetValues({ silent: true });
  }, 250);
}

async function createNewProPreset() {
  const rawName = window.prompt('Enter a preset name:');
  const name = normalizePresetName(rawName);
  if (!name) return;

  const duplicate = Object.values(proPromptPresets).find(preset => preset.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    await switchProPreset(duplicate.id, { silent: true });
    log(`Preset "${name}" already exists. Switched to it instead.`, 'warning');
    return;
  }

  const id = createPresetId();
  proPromptPresets[id] = {
    id,
    name,
    values: getCurrentProPromptValues()
  };

  activeProPresetId = id;
  renderProPresetOptions();
  await persistProPresetState();
  log(`Created preset "${name}"`, 'success');
}

async function renameActiveProPreset() {
  if (!activeProPresetId || !proPromptPresets[activeProPresetId]) return;

  const currentName = proPromptPresets[activeProPresetId].name;
  const rawName = window.prompt('Rename preset:', currentName);
  const name = normalizePresetName(rawName);
  if (!name || name === currentName) return;

  const duplicate = Object.values(proPromptPresets).find(preset => preset.id !== activeProPresetId && preset.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    log(`A preset named "${name}" already exists.`, 'warning');
    return;
  }

  proPromptPresets[activeProPresetId] = {
    ...proPromptPresets[activeProPresetId],
    name
  };

  renderProPresetOptions();
  await persistProPresetState();
  log(`Renamed preset to "${name}"`, 'success');
}

async function deleteActiveProPreset() {
  if (!activeProPresetId || !proPromptPresets[activeProPresetId]) return;

  const presetIds = Object.keys(proPromptPresets);
  if (presetIds.length <= 1) {
    log('Keep at least one preset available.', 'warning');
    return;
  }

  const name = proPromptPresets[activeProPresetId].name;
  if (!window.confirm(`Delete preset "${name}"?`)) return;

  const nextPresetId = presetIds.find(id => id !== activeProPresetId);
  delete proPromptPresets[activeProPresetId];
  activeProPresetId = nextPresetId || '';
  renderProPresetOptions();
  await switchProPreset(activeProPresetId, { silent: true });
  log(`Deleted preset "${name}"`, 'warning');
}

function initializeProPresets(data) {
  const storedPresets = data[PRO_PRESET_STORAGE_KEY];
  const storedActivePresetId = data[ACTIVE_PRO_PRESET_STORAGE_KEY];

  if (storedPresets && Object.keys(storedPresets).length > 0) {
    proPromptPresets = storedPresets;
    activeProPresetId = storedActivePresetId && storedPresets[storedActivePresetId]
      ? storedActivePresetId
      : Object.keys(storedPresets)[0];
    renderProPresetOptions();
    applyProPromptValues(proPromptPresets[activeProPresetId].values);
    return;
  }

  const storiesPresetId = createPresetId();
  proPromptPresets = {
    [storiesPresetId]: {
      id: storiesPresetId,
      name: 'Stories',
      values: getCurrentProPromptValues()
    }
  };
  activeProPresetId = storiesPresetId;
  renderProPresetOptions();
}

function createBaseProState(overrides = {}) {
  return {
    active: true,
    step: '',
    episodes: [],
    currentEpisodeIndex: 0,
    scriptWriterResponses: [],
    currentSceneIndex: 0,
    globalSceneOutputIndex: 0,
    sceneDetailsData: [],
    currentExtraCharacterIndex: 0,
    globalExtraCharacterOutputIndex: 0,
    sceneDetailsDataForLocation: [],
    currentExtraLocationIndex: 0,
    globalExtraLocationOutputIndex: 0,
    selectedSteps: [],
    selectedStepIndex: 0,
    runMode: 'auto',
    singleStep: false,
    ...overrides
  };
}

function finishProRun(message) {
  if (message) {
    log(message, 'success');
  }
  proState.active = false;
  saveProState();
}

function dispatchSelectedProStep(stepName) {
  if (!stepName) {
    finishProRun('Selected steps complete.');
    return;
  }

  if (stepName === 'script_outliner') {
    const storyIdea = proStoryIdeaEl.value.trim();
    const scriptOutliner = proScriptOutlinerEl.value.trim();
    if (!storyIdea || !scriptOutliner) {
      finishProRun('');
      log('Story Idea and Script Outliner prompt are required.', 'error');
      return;
    }

    proState.step = 'script_outliner';
    saveProState();
    const fullPrompt = `${scriptOutliner}\n\n${storyIdea}`;
    log('Running Script Outliner...', 'running');
    sendMessageToContentScript('run_single', {
      prompt: fullPrompt,
      stepName: 'script_outliner',
      isNewChat: newChatToggle.checked,
      meta: { row: 1, col: 'A' }
    });
    return;
  }

  if (stepName === 'story_architect') {
    (async () => {
      const data = await fetchColumnFromSheet('A');
      if (!data || !data[0]) {
        finishProRun('');
        log('No data found in Column A for Story Architect', 'error');
        return;
      }
      const architectPrompt = proStoryArchitectEl.value.trim();
      if (!architectPrompt) {
        finishProRun('');
        log('Story Architect prompt missing.', 'error');
        return;
      }
      proState.step = 'story_architect';
      saveProState();
      const fullPrompt = `${architectPrompt}\n\n${data[0]}`;
      log('Running Story Architect...', 'running');
      sendMessageToContentScript('run_single', {
        prompt: fullPrompt,
        stepName: 'story_architect',
        isNewChat: newChatToggle.checked,
        meta: { row: 1, col: 'B' }
      });
    })();
    return;
  }

  if (stepName === 'script_writer') {
    (async () => {
      let data = await fetchColumnFromSheet('B');
      if (!data || data.length === 0) {
        finishProRun('');
        log('No data found in Column B for Script Writer', 'error');
        return;
      }
      data = data.filter(d => d && d.trim().length > 0);
      if (data.length === 0) {
        finishProRun('');
        log('No episodes found in Column B', 'error');
        return;
      }
      proState = createBaseProState({
        ...proState,
        active: true,
        step: 'script_writer',
        episodes: data,
        scriptWriterResponses: [],
        currentEpisodeIndex: 0
      });
      saveProState();
      log(`Running Script Writer with ${data.length} episode(s)...`, 'running');
      runNextScriptWriter();
    })();
    return;
  }

  if (stepName === 'story_check') {
    (async () => {
      let data = await fetchColumnFromSheet('C');
      if (!data || data.length === 0) {
        finishProRun('');
        log('No data found in Column C for Story Check', 'error');
        return;
      }
      
      const episodesWithHeaders = [];
      data.forEach((d, index) => {
        if (d && d.trim().length > 0) {
          episodesWithHeaders.push(`Episode ${index + 1}\n\n${d.trim()}`);
        }
      });
      
      if (episodesWithHeaders.length === 0) {
        finishProRun('');
        log('No story episodes found in Column C', 'error');
        return;
      }
      const storyCheckPrompt = proStoryCheckEl ? proStoryCheckEl.value.trim() : '';
      if (!storyCheckPrompt) {
        finishProRun('');
        log('Story Check prompt missing.', 'error');
        return;
      }
      const fullStory = episodesWithHeaders.join('\n\n');
      proState.step = 'story_check';
      proState.storyEpisodes = data;
      proState.originalCombinedStory = fullStory;
      saveProState();
      log('Running Story Check...', 'running');
      sendMessageToContentScript('run_single', {
        prompt: `${storyCheckPrompt}\n\n${fullStory}`,
        stepName: 'story_check',
        isNewChat: newChatToggle.checked,
        meta: { col: 'C' }
      });
    })();
    return;
  }

  if (stepName === 'story_fix') {
    (async () => {
      let data = await fetchColumnFromSheet('C');
      if (!data || data.length === 0) {
        finishProRun('');
        log('No data found in Column C for Story Fix', 'error');
        return;
      }
      
      const episodesWithHeaders = [];
      data.forEach((d, index) => {
        if (d && d.trim().length > 0) {
          episodesWithHeaders.push(`Episode ${index + 1}\n\n${d.trim()}`);
        }
      });
      
      if (episodesWithHeaders.length === 0) {
        finishProRun('');
        log('No story episodes found in Column C', 'error');
        return;
      }
      const storyFixPrompt = proStoryFixEl ? proStoryFixEl.value.trim() : '';
      if (!storyFixPrompt) {
        finishProRun('');
        log('Story Fix prompt missing.', 'error');
        return;
      }
      const storageData = await chrome.storage.local.get(STORY_CHECK_OUTPUT_STORAGE_KEY);
      const correctionInput = storageData[STORY_CHECK_OUTPUT_STORAGE_KEY] || '';
      if (!correctionInput.trim()) {
        finishProRun('');
        log('Run Story Check first so Story Fix has a correction report.', 'error');
        return;
      }
      const fullStory = episodesWithHeaders.join('\n\n');
      proState.step = 'story_fix';
      proState.storyEpisodes = data;
      proState.originalCombinedStory = fullStory;
      saveProState();
      log('Running Story Fix...', 'running');
      sendMessageToContentScript('run_single', {
        prompt: buildStoryFixPrompt(storyFixPrompt, correctionInput, fullStory),
        stepName: 'story_fix',
        isNewChat: newChatToggle.checked,
        meta: { col: 'C' }
      });
    })();
    return;
  }

  if (stepName === 'scene_details') {
    (async () => {
      let data = await fetchColumnFromSheet('C');
      if (!data || data.length === 0) {
        finishProRun('');
        log('No data found in Column C for Scene Details', 'error');
        return;
      }
      data = data.filter(d => d && d.trim().length > 0);
      if (data.length === 0) {
        finishProRun('');
        log('No script outputs found in Column C', 'error');
        return;
      }
      proState = createBaseProState({
        ...proState,
        active: true,
        step: 'scene_details',
        scriptWriterResponses: data,
        currentSceneIndex: 0
      });
      saveProState();
      log(`Running Scene Details with ${data.length} script output(s)...`, 'running');
      runNextSceneDetails();
    })();
    return;
  }

  if (stepName === 'extra_character') {
    proState.step = 'extra_character';
    saveProState();
    runExtraCharacter();
    return;
  }

  if (stepName === 'extra_location') {
    proState.step = 'extra_location';
    saveProState();
    runExtraLocation();
    return;
  }

  if (stepName === 'description_generator') {
    proState.step = 'description_generator';
    saveProState();
    runDescriptionGenerator();
    return;
  }

  if (stepName === 'thumbnail_details') {
    proState.step = 'thumbnail_details';
    saveProState();
    runThumbnailDetails();
  }
}

function advanceSelectedProStep() {
  if (!proState.active) return;
  const selectedSteps = Array.isArray(proState.selectedSteps) ? proState.selectedSteps : [];
  const nextIndex = (proState.selectedStepIndex || 0) + 1;
  if (nextIndex >= selectedSteps.length) {
    finishProRun('Selected steps complete.');
    return;
  }
  proState.selectedStepIndex = nextIndex;
  saveProState();
  dispatchSelectedProStep(selectedSteps[nextIndex]);
}

function startSelectedProRun(stepIds) {
  if (!Array.isArray(stepIds) || stepIds.length === 0) {
    log('Select at least one prompt step to run.', 'warning');
    return;
  }

  proState = createBaseProState({
    step: stepIds[0],
    selectedSteps: stepIds,
    selectedStepIndex: 0,
    runMode: 'selected',
    singleStep: stepIds.length === 1
  });
  saveProState();
  dispatchSelectedProStep(stepIds[0]);
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

if (importCharacterRefBtn) {
  importCharacterRefBtn.addEventListener('click', async () => {
    await importCharacterRefsFromSheet();
  });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'progress') {
    const { currentIndex, total, currentPrompt } = message;
    updateProgress(currentIndex, total);
    setStatus(`Running prompt ${currentIndex}/${total}`, 'running');
    const promptText = typeof currentPrompt === 'string' ? currentPrompt : '';
    const preview = promptText.substring(0, 50) + (promptText.length > 50 ? '...' : '');
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
      if (stepName !== 'story_architect' && stepName !== 'scene_details' && stepName !== 'image_prompt' && stepName !== 'story_check' && stepName !== 'story_fix') {
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

      if (stepName === 'script_outliner') {
        const storyIdeaValue = proStoryIdeaEl ? proStoryIdeaEl.value.trim() : '';
        if (storyIdeaValue) {
          fetch(webhookUrl, {
            method: 'POST',
            body: JSON.stringify({
              mode: 'pro',
              column: 'K',
              row: meta.row || 1,
              response: storyIdeaValue
            })
          }).then(() => log(`Saved story idea to K${meta.row || 1}`, 'success'))
            .catch(err => log(`Error saving story idea to Sheet: ${err.message}`, 'error'));
        }
      }
    }

    if (!proState.active) return;

    if (stepName === 'script_outliner') {
      if (proState.runMode === 'selected') {
        advanceSelectedProStep();
        return;
      }
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
      const episodes = splitEpisodes(response || '');
      proState.episodes = episodes;
      log(`Found ${episodes.length} episodes.`, 'info');
      
      (async () => {
        if (webhookUrl && webhookUrl.startsWith('https://script.google.com')) {
          const batchEntries = episodes.map((ep, idx) => ({
            row: idx + 1,
            response: ep
          }));
          const saved = await saveSheetBatch('B', batchEntries);
          if (saved) {
            log(`Saved ${batchEntries.length} episode(s) to column B`, 'success');
          }
        }
        if (proState.runMode === 'selected') {
          advanceSelectedProStep();
          return;
        }
        if (proState.singleStep) {
          finishProRun('Story Architect complete.');
          return;
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
    } else if (stepName === 'story_check') {
      const combinedStory = proState.originalCombinedStory || '';
      (async () => {
        await chrome.storage.local.set({ [STORY_CHECK_OUTPUT_STORAGE_KEY]: response || '' });
        log('Story Check report saved to browser storage.', 'success');

        if (proState.runMode === 'selected') {
          advanceSelectedProStep();
          return;
        }
        if (proState.singleStep) {
          finishProRun('Story Check complete.');
          return;
        }

        const storyFixPrompt = proStoryFixEl ? proStoryFixEl.value.trim() : '';
        if (!storyFixPrompt) {
          log('Story Fix prompt missing.', 'warning');
          proState.active = false;
          saveProState();
          return;
        }
        proState.step = 'story_fix';
        saveProState();
        log('Running Story Fix...', 'running');
        sendMessageToContentScript('run_single', {
          prompt: buildStoryFixPrompt(storyFixPrompt, response || '', combinedStory),
          stepName: 'story_fix',
          isNewChat: newChatToggle.checked,
          meta: { col: 'C' }
        });
      })();
    } else if (stepName === 'story_fix') {
      const fixedEpisodesText = response || '';
      const regex = /(?:^|\n)[\s\*\-\#\[\]]*(?:Episode|एपिसोड)\s*(\d+)(.*?)(?=(?:\n[\s\*\-\#\[\]]*(?:Episode|एपिसोड)\s*\d+)|$)/gis;
      
      const batchEntries = [];
      let match;
      while ((match = regex.exec(fixedEpisodesText)) !== null) {
        const row = parseInt(match[1], 10);
        let content = match[2].replace(/^[\s\:\-\*]+/, '').trim();
        if (content) {
          batchEntries.push({ row, response: content });
        }
      }

      log(`Found ${batchEntries.length} fixed episode(s).`, 'info');

      (async () => {
        if (batchEntries.length > 0 && webhookUrlEl.value.trim().startsWith('https://script.google.com')) {
          const saved = await saveSheetBatch('C', batchEntries);
          if (saved) {
            log(`Saved ${batchEntries.length} specific episode(s) back to column C`, 'success');
          }
        }

        let updatedData = await fetchColumnFromSheet('C');
        proState.scriptWriterResponses = Array.isArray(updatedData) 
          ? updatedData.map(item => (item || '').trim()).filter(item => item.length > 0)
          : [];

        if (proState.runMode === 'selected') {
          advanceSelectedProStep();
          return;
        }
        if (proState.singleStep) {
          finishProRun('Story Fix complete.');
          return;
        }

        proState.step = 'scene_details';
        proState.currentSceneIndex = 0;
        saveProState();
        runNextSceneDetails();
      })();
    } else if (stepName === 'scene_details') {
      const scenes = (response || '').split(/(?:^|\n)(?=[\s\*\-\#\[\]]*Scene\s*\d+)/i).map(s => s.trim()).filter(s => s.length > 0);
      log(`Found ${scenes.length} scenes.`, 'info');

      (async () => {
        if (webhookUrl && webhookUrl.startsWith('https://script.google.com')) {
          const batchEntries = scenes.map(sc => {
            proState.globalSceneOutputIndex = (proState.globalSceneOutputIndex || 0) + 1;
            return {
              row: proState.globalSceneOutputIndex,
              response: sc
            };
          });
          const saved = await saveSheetBatch('D', batchEntries);
          if (saved) {
            log(`Saved ${batchEntries.length} scene detail(s) to column D`, 'success');
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
      const idx = proState.currentExtraCharacterIndex || 0;
      const endIdx = Math.min(idx + 10, (proState.sceneDetailsData || []).length || idx + 10);
      log(`Found ${items.length} character details for D${idx + 1}-D${endIdx}.`, 'info');

      (async () => {
        if (webhookUrl && webhookUrl.startsWith('https://script.google.com')) {
          const batchEntries = items.map((item) => {
            proState.globalExtraCharacterOutputIndex = (proState.globalExtraCharacterOutputIndex || 0) + 1;
            return {
              row: proState.globalExtraCharacterOutputIndex,
              response: item
            };
          });
          if (batchEntries.length > 0) {
            const saved = await saveSheetBatch('E', batchEntries);
            if (saved) {
              log(`Saved ${batchEntries.length} character detail(s) to column E`, 'success');
            }
          }
        }
        
        proState.currentExtraCharacterIndex = (proState.currentExtraCharacterIndex || 0) + 10;
        saveProState();
        runExtraCharacter();
      })();
    } else if (stepName === 'extra_location') {
      let items = (response || '').split(/(?:^|\n)(?=[\s\*\-\#\[\]]*(?:Character|Location)\s*\d*|(?:\d+\.))/i).map(s => s.trim()).filter(s => s.length > 0);
      if (items.length <= 1) {
        items = (response || '').split(/\n\s*\n/).map(s => s.trim()).filter(s => s.length > 0);
      }
      const idx = proState.currentExtraLocationIndex || 0;
      const endIdx = Math.min(idx + 10, (proState.sceneDetailsDataForLocation || []).length || idx + 10);
      log(`Found ${items.length} location details for D${idx + 1}-D${endIdx}.`, 'info');

      (async () => {
        if (webhookUrl && webhookUrl.startsWith('https://script.google.com')) {
          const batchEntries = items.map((item) => {
            proState.globalExtraLocationOutputIndex = (proState.globalExtraLocationOutputIndex || 0) + 1;
            return {
              row: proState.globalExtraLocationOutputIndex,
              response: item
            };
          });
          if (batchEntries.length > 0) {
            const saved = await saveSheetBatch('F', batchEntries);
            if (saved) {
              log(`Saved ${batchEntries.length} location detail(s) to column F`, 'success');
            }
          }
        }
        
        proState.currentExtraLocationIndex = (proState.currentExtraLocationIndex || 0) + 10;
        saveProState();
        runExtraLocation();
      })();
    } else if (stepName === 'description_generator') {
      let items = (response || '').split(/(?:^|\n)(?=[\s\*\-\#\[\]]*(?:Character|Location|Description)\s*\d*|(?:\d+\.))/i).map(s => s.trim()).filter(s => s.length > 0);
      if (items.length <= 1) {
        items = (response || '').split(/\n\s*\n/).map(s => s.trim()).filter(s => s.length > 0);
      }
      log(`Found ${items.length} descriptions.`, 'info');

      (async () => {
        if (webhookUrl && webhookUrl.startsWith('https://script.google.com')) {
          const batchEntries = items.map((item, i) => ({
            row: i + 1,
            response: item
          }));
          const saved = await saveSheetBatch('I', batchEntries);
          if (saved) {
            log(`Saved ${batchEntries.length} description(s) to column I`, 'success');
          }
        }
        if (proState.runMode === 'selected') {
          advanceSelectedProStep();
          return;
        }
        if (proState.singleStep) {
          finishProRun('Description Generator complete.');
          return;
        }
        proState.step = 'thumbnail_details';
        saveProState();
        runThumbnailDetails();
      })();
    } else if (stepName === 'thumbnail_details') {
      let items = (response || '').split(/(?:^|\n)(?=[\s\*\-\#\[\]]*(?:Thumbnail|Image)\s*\d*|(?:\d+\.))/i).map(s => s.trim()).filter(s => s.length > 0);
      if (items.length <= 1) {
        items = (response || '').split(/\n\s*\n/).map(s => s.trim()).filter(s => s.length > 0);
      }
      log(`Found ${items.length} thumbnails.`, 'info');

      (async () => {
        if (webhookUrl && webhookUrl.startsWith('https://script.google.com')) {
          const batchEntries = items.map((item, i) => ({
            row: i + 1,
            response: item
          }));
          const saved = await saveSheetBatch('J', batchEntries);
          if (saved) {
            log(`Saved ${batchEntries.length} thumbnail(s) to column J`, 'success');
          }
        }
        if (proState.runMode === 'selected') {
          advanceSelectedProStep();
          return;
        }
        finishProRun('Thumbnail Details complete.');
      })();
    } else if (stepName === 'image_prompt') {
      const promptBlocks = (response || '').split(/\n\s*\n/).map(s => s.trim()).filter(s => s.length > 0);
      log(`Found ${promptBlocks.length} image prompts in this scene.`, 'info');

      (async () => {
        if (webhookUrl && webhookUrl.startsWith('https://script.google.com')) {
          const imagePromptEntries = [];
          const storyLineEntries = [];
          for (let i = 0; i < promptBlocks.length; i++) {
            const sceneNumber = proState.imageRerunScene || (proState.currentImageIndex + 1);
            const promptNumber = i + 1;
            const parsedBlock = parseImagePromptBlock(promptBlocks[i]);
            const promptSource = parsedBlock.promptText || promptBlocks[i];
            const promptText = ensureImagePromptTag(promptSource, sceneNumber, promptNumber);
            let row;

            if (proState.imageTargetRows && proState.imageTargetRows.length > 0) {
              row = proState.imageTargetRows[i];
              if (!row) {
                proState.globalImageOutputIndex = (proState.globalImageOutputIndex || 0) + 1;
                row = proState.globalImageOutputIndex;
              }
            } else {
              proState.globalImageOutputIndex = (proState.globalImageOutputIndex || 0) + 1;
              row = proState.globalImageOutputIndex;
            }

            imagePromptEntries.push({ row, response: promptText });
            storyLineEntries.push({ row, response: parsedBlock.storyLine });
          }

          const promptsSaved = await saveSheetBatch('G', imagePromptEntries);
          const storyLinesSaved = await saveSheetBatch('H', storyLineEntries);
          if (promptsSaved && storyLinesSaved) {
            const rowsLabel = imagePromptEntries.map(entry => `G${entry.row}/H${entry.row}`).join(', ');
            log(`Saved ${imagePromptEntries.length} image prompt(s) to ${rowsLabel}`, 'success');
          }
        }
        
        if (proState.singleStep) {
          log('Image Prompt complete.', 'success');
          proState.active = false;
          saveProState();
          return;
        }
        
        proState.currentImageIndex++;
        saveProState();
        runNextImagePrompt();
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
    'proStoryIdea', 'proScriptOutliner', 'proStoryArchitect', 'proScriptWriter', 'proStoryCheck', 'proStoryFix', 'proSceneDetails', 'proState',
    'extraCharacterPrompt', 'extraLocationPrompt', 'descriptionGeneratorPrompt', 'thumbnailDetailsPrompt', 'imagePromptGen', 'imageStartScene', 'imageRerunScene', 'imageCharacterRef',
    PRO_PRESET_STORAGE_KEY, ACTIVE_PRO_PRESET_STORAGE_KEY,
    PRO_MODE_STORAGE_KEY, ACTIVE_TAB_STORAGE_KEY, PRO_SELECTED_STEPS_STORAGE_KEY, PRO_EXPANDED_STEPS_STORAGE_KEY
  ]);
  
  if (data.systemPrompt) systemPromptEl.value = data.systemPrompt;
  if (data.newChat !== undefined) newChatToggle.checked = data.newChat;
  if (data.webhookUrl && webhookUrlEl) webhookUrlEl.value = data.webhookUrl;
  
  if (data.proStoryIdea && proStoryIdeaEl) proStoryIdeaEl.value = data.proStoryIdea;
  if (data.proScriptOutliner && proScriptOutlinerEl) proScriptOutlinerEl.value = data.proScriptOutliner;
  if (data.proStoryArchitect && proStoryArchitectEl) proStoryArchitectEl.value = data.proStoryArchitect;
  if (data.proScriptWriter && proScriptWriterEl) proScriptWriterEl.value = data.proScriptWriter;
  if (data.proStoryCheck && proStoryCheckEl) proStoryCheckEl.value = data.proStoryCheck;
  if (data.proStoryFix && proStoryFixEl) proStoryFixEl.value = data.proStoryFix;
  if (data.proSceneDetails && proSceneDetailsEl) proSceneDetailsEl.value = data.proSceneDetails;
  if (data.proState) proState = data.proState;

  if (data.extraCharacterPrompt && extraCharacterPromptEl) extraCharacterPromptEl.value = data.extraCharacterPrompt;
  if (data.extraLocationPrompt && extraLocationPromptEl) extraLocationPromptEl.value = data.extraLocationPrompt;
  if (data.descriptionGeneratorPrompt && descriptionGeneratorPromptEl) descriptionGeneratorPromptEl.value = data.descriptionGeneratorPrompt;
  if (data.thumbnailDetailsPrompt && thumbnailDetailsPromptEl) thumbnailDetailsPromptEl.value = data.thumbnailDetailsPrompt;
  if (data.imagePromptGen && imagePromptGenEl) imagePromptGenEl.value = data.imagePromptGen;
  if (data.imageStartScene && imageStartSceneEl) imageStartSceneEl.value = data.imageStartScene;
  if (data.imageRerunScene && imageRerunSceneEl) imageRerunSceneEl.value = data.imageRerunScene;
  if (data.imageCharacterRef && imageCharacterRefEl) imageCharacterRefEl.value = data.imageCharacterRef;
  initializeProPresets(data);
  setProMode(data[PRO_MODE_STORAGE_KEY] || 'auto', false);
  applySelectedProSteps(data[PRO_SELECTED_STEPS_STORAGE_KEY] || [], false);
  applyExpandedSteps(data[PRO_EXPANDED_STEPS_STORAGE_KEY] || [], false);
  setActiveTab(data[ACTIVE_TAB_STORAGE_KEY] || 'pro', false);
  updateProRunButtonLabel();

  if (webhookUrlEl) {
    webhookUrlEl.addEventListener('change', () => {
      chrome.storage.local.set({ webhookUrl: webhookUrlEl.value.trim() });
    });
  }

  if (newChatToggle) {
    newChatToggle.addEventListener('change', () => {
      chrome.storage.local.set({ newChat: newChatToggle.checked });
    });
  }

  [proStoryIdeaEl, proScriptOutlinerEl, proStoryArchitectEl, proScriptWriterEl, proStoryCheckEl, proStoryFixEl, proSceneDetailsEl, extraCharacterPromptEl, extraLocationPromptEl, descriptionGeneratorPromptEl, thumbnailDetailsPromptEl, imagePromptGenEl, imageStartSceneEl, imageRerunSceneEl, imageCharacterRefEl].forEach(el => {
    if (el) {
      if (el !== imageStartSceneEl && el !== imageRerunSceneEl && el !== imageCharacterRefEl) {
        el.addEventListener('input', () => {
          scheduleSaveActiveProPreset();
        });
      }

      el.addEventListener('change', async () => {
        await chrome.storage.local.set({
          imageStartScene: imageStartSceneEl ? imageStartSceneEl.value.trim() : '',
          imageRerunScene: imageRerunSceneEl ? imageRerunSceneEl.value.trim() : '',
          imageCharacterRef: imageCharacterRefEl ? imageCharacterRefEl.value.trim() : ''
        });
        await saveActiveProPresetValues({ silent: true });
      });
    }
  });

  if (proPresetSelectEl) {
    proPresetSelectEl.addEventListener('change', async () => {
      await saveActiveProPresetValues({ silent: true });
      await switchProPreset(proPresetSelectEl.value);
    });
  }

  if (newPresetBtn) {
    newPresetBtn.addEventListener('click', createNewProPreset);
  }

  if (deletePresetBtn) {
    deletePresetBtn.addEventListener('click', deleteActiveProPreset);
  }

  if (clearLogBtn) {
    clearLogBtn.addEventListener('click', () => {
      clearActivityLog();
    });
  }

  await persistProPresetState();

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
  if (startProBtn) {
    const isManual = getProMode() === 'manual';
    startProBtn.disabled = proState.active || (isManual && getSelectedProSteps().length === 0);
  }
  if (stopProBtn) stopProBtn.disabled = !proState.active;
  if (stopImageBtn) stopImageBtn.disabled = !proState.active;
  updateProRunButtonLabel();
}

if (startProBtn) {
  startProBtn.addEventListener('click', async () => {
    if (getProMode() === 'manual') {
      startSelectedProRun(getSelectedProSteps());
      return;
    }

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
    
    proState = createBaseProState({
      step: 'script_outliner',
      runMode: 'auto'
    });
    saveProState();
    
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

if (stopProBtn) {
  stopProBtn.addEventListener('click', async () => {
    log('Stopping Pro Pipeline...', 'error');
    proState.active = false;
    chrome.storage.local.set({ proState });
    updateProButtons();
    await sendMessageToContentScript('stop');
  });
}

if (stopImageBtn) {
  stopImageBtn.addEventListener('click', async () => {
    log('Stopping Image Pipeline...', 'error');
    proState.active = false;
    chrome.storage.local.set({ proState });
    updateProButtons();
    await sendMessageToContentScript('stop');
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
    if (proState.runMode === 'selected') {
      (async () => {
        await saveEpisodesToColumnC(proState.scriptWriterResponses || []);
        advanceSelectedProStep();
      })();
      return;
    }
    if (proState.singleStep) {
      finishProRun('Script Writer complete.');
      return;
    }
    const storyCheckPrompt = proStoryCheckEl ? proStoryCheckEl.value.trim() : '';
    if (!storyCheckPrompt) {
      log('Story Check prompt missing. Pipeline halted.', 'warning');
      proState.active = false;
      saveProState();
      return;
    }
    proState.step = 'story_check';
    proState.originalCombinedStory = (proState.scriptWriterResponses || []).join('\n\n');
    saveProState();
    log('Running Story Check...', 'running');
    sendMessageToContentScript('run_single', {
      prompt: `${storyCheckPrompt}\n\n${proState.originalCombinedStory}`,
      stepName: 'story_check',
      isNewChat: newChatToggle.checked,
      meta: { col: 'C' }
    });
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
    if (proState.runMode === 'selected') {
      advanceSelectedProStep();
      return;
    }
    if (proState.singleStep) {
      finishProRun('Scene Details complete.');
      return;
    }
    proState.step = 'extra_character';
    saveProState();
    runExtraCharacter();
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

async function runExtraCharacter() {
  if (!proState.active) return;
  
  if (proState.currentExtraCharacterIndex === undefined || !proState.sceneDetailsData || proState.sceneDetailsData.length === 0) {
    let data = await fetchColumnFromSheet('D');
    if (!data || data.length === 0) {
      finishProRun('');
      return log('No data found in Column D', 'error');
    }
    data = normalizeSceneNumbers(data);
    data = data.filter(d => d && d.trim().length > 0);
    if (data.length === 0) {
      finishProRun('');
      return log('No scene details found in Column D', 'error');
    }
    proState.sceneDetailsData = data;
    proState.currentExtraCharacterIndex = 0;
    proState.globalExtraCharacterOutputIndex = 0;
    saveProState();
  }

  const idx = proState.currentExtraCharacterIndex;
  if (idx >= proState.sceneDetailsData.length) {
    proState.currentExtraCharacterIndex = 0;
    proState.sceneDetailsData = [];
    if (proState.runMode === 'selected') {
      advanceSelectedProStep();
      return;
    }
    if (proState.singleStep) {
      finishProRun('Character Details complete.');
      return;
    }
    proState.step = 'extra_location';
    saveProState();
    runExtraLocation();
    return;
  }
  
  const prompt = extraCharacterPromptEl.value.trim();
  if (!prompt) {
    finishProRun('');
    return log('Character Details prompt missing.', 'error');
  }
  
  const endIdx = Math.min(idx + 10, proState.sceneDetailsData.length);
  const batchData = proState.sceneDetailsData.slice(idx, endIdx);
  const cellData = batchData.join('\n\n');
  const fullPrompt = `${prompt}\n\n${cellData}`;
  log(`Running Character Details Gen for D${idx + 1}-D${endIdx}...`, 'running');
  sendMessageToContentScript('run_single', {
    prompt: fullPrompt, stepName: 'extra_character',
    isNewChat: newChatToggle.checked, meta: { col: 'E' }
  });
}

async function runExtraLocation() {
  if (!proState.active) return;
  
  if (proState.currentExtraLocationIndex === undefined || !proState.sceneDetailsDataForLocation || proState.sceneDetailsDataForLocation.length === 0) {
    let data = await fetchColumnFromSheet('D');
    if (!data || data.length === 0) {
      finishProRun('');
      return log('No data found in Column D', 'error');
    }
    data = normalizeSceneNumbers(data);
    data = data.filter(d => d && d.trim().length > 0);
    if (data.length === 0) {
      finishProRun('');
      return log('No scene details found in Column D', 'error');
    }
    proState.sceneDetailsDataForLocation = data;
    proState.currentExtraLocationIndex = 0;
    proState.globalExtraLocationOutputIndex = 0;
    saveProState();
  }

  const idx = proState.currentExtraLocationIndex;
  if (idx >= proState.sceneDetailsDataForLocation.length) {
    proState.currentExtraLocationIndex = 0;
    proState.sceneDetailsDataForLocation = [];
    if (proState.runMode === 'selected') {
      advanceSelectedProStep();
      return;
    }
    if (proState.singleStep) {
      finishProRun('Location Details complete.');
      return;
    }
    proState.step = 'description_generator';
    saveProState();
    runDescriptionGenerator();
    return;
  }
  
  const prompt = extraLocationPromptEl.value.trim();
  if (!prompt) {
    finishProRun('');
    return log('Location Details prompt missing.', 'error');
  }
  
  const endIdx = Math.min(idx + 10, proState.sceneDetailsDataForLocation.length);
  const batchData = proState.sceneDetailsDataForLocation.slice(idx, endIdx);
  const cellData = batchData.join('\n\n');
  const fullPrompt = `${prompt}\n\n${cellData}`;
  log(`Running Location Details Gen for D${idx + 1}-D${endIdx}...`, 'running');
  sendMessageToContentScript('run_single', {
    prompt: fullPrompt, stepName: 'extra_location',
    isNewChat: newChatToggle.checked, meta: { col: 'F' }
  });
}

async function runDescriptionGenerator() {
  if (!proState.active) return;
  let data = await fetchColumnFromSheet('B');
  if (!data || data.length === 0) {
    finishProRun('');
    return log('No data found in Column B', 'error');
  }
  
  data = data.filter(d => d && d.trim().length > 0);
  if (data.length === 0) {
    finishProRun('');
    return log('No scene outliners found in Column B', 'error');
  }
  
  const combinedData = data.join('\n\n');
  const prompt = descriptionGeneratorPromptEl.value.trim();
  if (!prompt) {
    finishProRun('');
    return log('Description Generator prompt missing.', 'error');
  }
  
  const fullPrompt = `${prompt}\n\n${combinedData}`;
  log(`Running Description Generator...`, 'running');
  sendMessageToContentScript('run_single', {
    prompt: fullPrompt, stepName: 'description_generator',
    isNewChat: newChatToggle.checked, meta: { col: 'I' }
  });
}

async function runThumbnailDetails() {
  if (!proState.active) return;
  let data = await fetchColumnFromSheet('B');
  if (!data || data.length === 0) {
    finishProRun('');
    return log('No data found in Column B', 'error');
  }
  
  data = data.filter(d => d && d.trim().length > 0);
  if (data.length === 0) {
    finishProRun('');
    return log('No scene outliners found in Column B', 'error');
  }
  
  const combinedData = data.join('\n\n');
  const prompt = thumbnailDetailsPromptEl.value.trim();
  if (!prompt) {
    finishProRun('');
    return log('Thumbnail Details prompt missing.', 'error');
  }
  
  const fullPrompt = `${prompt}\n\n${combinedData}`;
  log(`Running Thumbnail Details...`, 'running');
  sendMessageToContentScript('run_single', {
    prompt: fullPrompt, stepName: 'thumbnail_details',
    isNewChat: newChatToggle.checked, meta: { col: 'J' }
  });
}

function runNextImagePrompt() {
  if (!proState.active) return;
  
  // Skip any empty scenes
  while (proState.currentImageIndex < proState.sceneDetailsResponses.length) {
    const text = proState.sceneDetailsResponses[proState.currentImageIndex];
    if (text && text.trim().length > 0) {
      break;
    }
    proState.currentImageIndex++;
  }

  const idx = proState.currentImageIndex;
  
  if (idx >= proState.sceneDetailsResponses.length) {
    if (proState.singleStep) {
      log('Image Prompt complete.', 'success');
      proState.active = false;
      saveProState();
      return;
    }
    log('All Image Prompts complete.', 'success');
    proState.active = false;
    saveProState();
    return;
  }
  
  const prompt = imagePromptGenEl.value.trim();
  const charRef = imageCharacterRefEl ? imageCharacterRefEl.value.trim() : '';
  if (!prompt) {
     log('Image Prompt missing. Pipeline halted.', 'warning');
     proState.active = false;
     saveProState();
     return;
  }
  
  const sceneText = proState.sceneDetailsResponses[idx];
  let fullPrompt = prompt;
  if (charRef) {
    fullPrompt += `\n\n${charRef}`;
  }
  fullPrompt += `\n\n${sceneText}`;
  log(`Running Image Prompt for Scene ${idx + 1}...`, 'running');
  sendMessageToContentScript('run_single', {
    prompt: fullPrompt,
    stepName: 'image_prompt',
    isNewChat: true,
    meta: { row: idx + 1, col: 'G' }
  });
}

async function setupImagePromptStart(isSingleStep) {
  let dataD = await fetchColumnFromSheet('D');
  if (!dataD || dataD.length === 0) return log('No data found in Column D', 'error');
  dataD = normalizeSceneNumbers(dataD);
  let scenes = dataD.map(d => (d || '').toString());
  if (scenes.length === 0) return log('No scene details found in Column D', 'error');

  let rerunScene = 0;
  if (isSingleStep && imageRerunSceneEl && imageRerunSceneEl.value.trim() !== '') {
    rerunScene = parseInt(imageRerunSceneEl.value.trim(), 10);
    if (isNaN(rerunScene) || rerunScene < 1) {
      return log('Enter a valid rerun scene number.', 'error');
    }
    if (rerunScene > scenes.length || !scenes[rerunScene - 1].trim()) {
      return log(`No scene details found in D${rerunScene}.`, 'error');
    }
  }
  
  let startIndex = rerunScene ? rerunScene - 1 : 0;
  if (!rerunScene && imageStartSceneEl && imageStartSceneEl.value.trim() !== '') {
    const startSceneVal = parseInt(imageStartSceneEl.value.trim(), 10);
    if (!isNaN(startSceneVal) && startSceneVal > 0) {
      startIndex = startSceneVal - 1;
      if (startIndex >= scenes.length || !scenes[startIndex].trim()) {
        return log(`No scene details found in D${startSceneVal}.`, 'error');
      }
    }
  }

  let emptyGIndex = 0;
  let imageTargetRows = [];
  if (rerunScene || startIndex > 0) {
    let dataG = await fetchColumnFromSheet('G');
    if (dataG && dataG.length > 0) {
      let lastFilled = -1;
      for (let i = 0; i < dataG.length; i++) {
        const cellText = dataG[i] ? dataG[i].toString().trim() : '';
        if (cellText.length > 0) {
          lastFilled = i;
        }

        if (rerunScene) {
          const tag = parseImagePromptSceneTag(cellText);
          if (tag && tag.scene === rerunScene) {
            imageTargetRows.push({ row: i + 1, prompt: tag.prompt });
          }
        }
      }
      emptyGIndex = lastFilled + 1;
    }
  }

  if (rerunScene) {
    if (imageTargetRows.length === 0) {
      return log(`No existing G cells tagged s${rerunScene}p* were found.`, 'error');
    }

    imageTargetRows.sort((a, b) => a.prompt - b.prompt || a.row - b.row);
    imageTargetRows = imageTargetRows.map(item => item.row);

    for (const row of imageTargetRows) {
      const cleared = await saveSheetCell('G', row, '');
      if (cleared) {
        log(`Cleared G${row}`, 'warning');
      }
      const clearedStory = await saveSheetCell('H', row, '');
      if (clearedStory) {
        log(`Cleared H${row}`, 'warning');
      }
    }
  }

  proState = { 
    active: true, 
    step: 'image_prompt', 
    singleStep: isSingleStep,
    sceneDetailsResponses: scenes,
    currentImageIndex: startIndex,
    globalImageOutputIndex: emptyGIndex,
    imageRerunScene: rerunScene || null,
    imageTargetRows
  };
  saveProState();
  const startType = rerunScene ? 'Rerunning' : (isSingleStep ? 'Replaying' : 'Starting');
  const outputText = rerunScene ? `replacement rows ${imageTargetRows.map(row => `G${row}`).join(', ')}` : `output to G${emptyGIndex + 1}`;
  log(`${startType} Image Prompt from Scene ${startIndex + 1}, ${outputText}...`, 'running');
  runNextImagePrompt();
}

if (playImagePromptBtn) {
  playImagePromptBtn.addEventListener('click', () => setupImagePromptStart(false));
}

if (replayImagePromptBtn) {
  replayImagePromptBtn.addEventListener('click', () => setupImagePromptStart(true));
}
