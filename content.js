(() => {
  let isRunning = false;
  let isPaused = false;
  let isStopped = false;
  let currentIndex = 0;
  let prompts = [];
  let systemPrompt = '';
  let startNewChat = true;
  const POST_COMPLETION_DELAY = 1500;

  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  function findInputArea() {
    const selectors = [
      'div.ql-editor[contenteditable="true"]',
      '.ql-editor',
      'div[contenteditable="true"][aria-label*="prompt" i]',
      'div[contenteditable="true"][aria-label*="Enter a prompt" i]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"][data-lexical-editor="true"]',
      'rich-textarea div[contenteditable="true"]',
      'div.input-area-container div[contenteditable="true"]',
      'div.composer-container div[contenteditable="true"]',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) {
        return el;
      }
    }

    const editables = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
    for (let i = editables.length - 1; i >= 0; i--) {
      const el = editables[i];
      if (el.offsetParent !== null && el.closest('form, [role="textbox"], .input-area, .composer')) {
        return el;
      }
    }

    if (editables.length > 0) {
      return editables[editables.length - 1];
    }

    return null;
  }

  function findSendButton() {
    const labelSelectors = [
      'button[aria-label="Send message"]',
      'button[aria-label="Send prompt"]',
      'button[aria-label="Send"]',
    ];
    for (const sel of labelSelectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }

    const allButtons = Array.from(document.querySelectorAll('button'));
    for (const btn of allButtons) {
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (label === 'send message' || label === 'send prompt' || label === 'send' || label === 'submit') {
        return btn;
      }
    }

    const inputArea = findInputArea();
    if (inputArea) {
      const container = inputArea.closest('form, [role="textbox"], .input-area, .composer, [class*="prompt"], [class*="input"]');
      if (container) {
        const buttons = container.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.querySelector('svg') && !btn.disabled) {
            const label = (btn.getAttribute('aria-label') || '').toLowerCase();
            if (!label.includes('attach') && !label.includes('upload') && !label.includes('microphone') && !label.includes('mic') && !label.includes('image')) {
              return btn;
            }
          }
        }
      }
    }

    return null;
  }

  function findNewChatButton() {
    const allButtons = Array.from(document.querySelectorAll('button'));
    for (const btn of allButtons) {
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (label.includes('new chat') || label.includes('new conversation') || label.includes('start new')) {
        return btn;
      }
    }

    const links = Array.from(document.querySelectorAll('a'));
    for (const link of links) {
      const href = (link.getAttribute('href') || '').toLowerCase();
      const text = (link.textContent || '').toLowerCase();
      if (href === '/app' || text.includes('new chat') || text.includes('newConversation')) {
        return link;
      }
    }

    return null;
  }

  function findStopGeneratingButton() {
    const allButtons = Array.from(document.querySelectorAll('button'));
    for (const btn of allButtons) {
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (label === 'stop generating' || label === 'stop' || label === 'stop response' || label === 'halt') {
        if (btn.offsetParent !== null && !btn.disabled && window.getComputedStyle(btn).opacity !== '0' && window.getComputedStyle(btn).visibility !== 'hidden') {
          return btn;
        }
      }
    }

    for (const btn of allButtons) {
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (label.includes('stop') && !label.includes('stop watch') && !label.includes('stopwatch') && !label.includes('stop sharing')) {
        if (btn.offsetParent !== null && !btn.disabled && window.getComputedStyle(btn).opacity !== '0' && window.getComputedStyle(btn).visibility !== 'hidden') {
          return btn;
        }
      }
    }

    return null;
  }

  function isResponseStreaming() {
    const responseContainers = document.querySelectorAll('.response-container-text, [data-response], .model-response, .message-content, .conversation-container');
    for (const container of responseContainers) {
      const streamingIndicators = container.querySelectorAll('.loading, .streaming, [data-streaming="true"], .typing-indicator');
      if (streamingIndicators.length > 0) {
        return true;
      }
    }
    return false;
  }

  async function enterText(text) {
    const input = findInputArea();
    if (!input) return false;

    input.focus();
    await sleep(200);

    try {
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
    } catch (e) {
      input.textContent = '';
    }

    await sleep(80);

    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(80);

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      document.execCommand('insertText', false, lines[i]);
      if (i < lines.length - 1) {
        document.execCommand('insertParagraph', false, null);
        // Minimal delay to ensure the editor registers the paragraph break
        if (i % 10 === 0) await sleep(5);
      }
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(150);

    return true;
  }

  async function createNewChat() {
    sendProgress('progress', {
      currentIndex: currentIndex + 1,
      total: prompts.length,
      currentPrompt: prompts[currentIndex],
      detail: 'Starting new chat...',
    });

    const newChatBtn = findNewChatButton();
    if (newChatBtn) {
      newChatBtn.click();
      await sleep(2500);
    } else {
      window.location.href = 'https://gemini.google.com/app';
      await sleep(4000);
    }

    const input = await waitForElement('div[contenteditable="true"]', 8000);
    if (!input) {
      await sleep(3000);
    }

    await sleep(500);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function ensureInputReady() {
    let input = findInputArea();
    if (input) return input;

    if (!window.location.pathname.includes('/app')) {
      window.location.href = 'https://gemini.google.com/app';
      await sleep(4000);
    }

    input = await waitForElement('div[contenteditable="true"]', 10000);
    if (input) return input;

    return null;
  }

  async function clickSendButton() {
    let sendBtn = findSendButton();

    if (!sendBtn) {
      for (let i = 0; i < 15; i++) {
        await sleep(500);
        sendBtn = findSendButton();
        if (sendBtn) break;
      }
    }

    if (!sendBtn) {
      sendProgress('error', { error: 'Could not find send button. Make sure Gemini is on the /app page.' });
      return false;
    }

    let attempts = 0;
    while (sendBtn.disabled && attempts < 15) {
      await sleep(300);
      sendBtn = findSendButton();
      attempts++;
    }

    if (!sendBtn || sendBtn.disabled) {
      sendProgress('error', { error: 'Send button is disabled. Text may not have been entered properly.' });
      return false;
    }

    sendBtn.click();
    return true;
  }

  async function waitForCompletion(maxWaitMs = 300000) {
    const startTime = Date.now();
    let sawStopButton = false;
    let stopButtonGoneCount = 0;

    // Phase 1: Wait briefly for the message to be sent and generation to potentially start
    await sleep(1500);

    // Phase 2: Wait for generation to complete
    while (true) {
      if (isStopped) return false;

      while (isPaused) {
        await sleep(300);
        if (isStopped) return false;
      }

      const elapsed = Date.now() - startTime;
      if (elapsed > maxWaitMs) return true;

      const stopBtn = findStopGeneratingButton();
      const streaming = isResponseStreaming();

      if (stopBtn || streaming) {
        sawStopButton = true;
        stopButtonGoneCount = 0;
        await sleep(500);
        continue;
      }

      if (sawStopButton) {
        stopButtonGoneCount++;
        if (stopButtonGoneCount >= 3) {
          await sleep(400);
          return true;
        }
        await sleep(400);
        continue;
      }

      // No stop button ever seen - check if send button is back or input is clear
      const sendBtn = findSendButton();
      const inputArea = findInputArea();
      
      if (elapsed > 4000) {
        if (sendBtn && !sendBtn.disabled && inputArea && inputArea.textContent.trim().length === 0) {
           return true;
        }
      }

      // Failsafe: after 15 seconds with no stop button or streaming seen, assume done
      if (elapsed > 15000 && !sawStopButton) {
        return true;
      }

      await sleep(500);
    }
  }

  function sendProgress(type, data = {}) {
    const payload = { type, ...data };
    try {
      chrome.runtime.sendMessage(payload);
    } catch (e) {
      // popup may be closed
    }
    // Also persist to storage so popup can restore state on reopen
    if (type === 'progress' || type === 'complete' || type === 'error' || type === 'stopped' || type === 'prompt_done') {
      try {
        chrome.storage.local.set({
          lastProgress: payload,
          currentIndex: data.currentIndex || currentIndex,
          totalPrompts: data.total || prompts.length,
        });
      } catch (e) {
        // storage may not be available
      }
    }
  }

  async function runPrompt(index) {
    const prompt = prompts[index];
    const fullPrompt = systemPrompt
      ? `${systemPrompt}\n\n${prompt}`
      : prompt;

    sendProgress('progress', {
      currentIndex: index + 1,
      total: prompts.length,
      currentPrompt: prompt,
    });

    if (startNewChat && index > 0) {
      await createNewChat();
    }

    const input = await ensureInputReady();
    if (!input) {
      sendProgress('error', { error: 'Could not find input area. Open gemini.google.com/app' });
      return false;
    }

    sendProgress('typing', {});

    await enterText(fullPrompt);

    await sleep(500);

    const verifyInput = findInputArea();
    if (!verifyInput || !verifyInput.textContent || verifyInput.textContent.trim().length === 0) {
      sendProgress('error', { error: 'Failed to enter text. Try clicking the Gemini input area first.' });
      return false;
    }

    sendProgress('waiting', {});

    const sent = await clickSendButton();
    if (!sent) return false;

    const completed = await waitForCompletion();
    if (!completed && isStopped) {
      sendProgress('stopped', {});
      return false;
    }

    sendProgress('prompt_done', {
      currentIndex: index + 1,
      total: prompts.length,
    });

    return true;
  }

  async function startExecution(sysPrompt, promptList, options) {
    systemPrompt = sysPrompt;
    prompts = promptList;
    startNewChat = options?.newChat !== false;
    currentIndex = 0;
    isRunning = true;
    isPaused = false;
    isStopped = false;

    if (!window.location.href.includes('gemini.google.com')) {
      sendProgress('error', { error: 'Please navigate to gemini.google.com/app first' });
      isRunning = false;
      await chrome.storage.local.set({ state: 'idle' });
      return;
    }

    if (startNewChat && prompts.length > 1) {
      await createNewChat();
    }

    for (let i = 0; i < prompts.length; i++) {
      if (isStopped) {
        sendProgress('stopped', {});
        isRunning = false;
        await chrome.storage.local.set({ state: 'idle' });
        return;
      }

      while (isPaused) {
        await sleep(300);
        if (isStopped) {
          sendProgress('stopped', {});
          isRunning = false;
          await chrome.storage.local.set({ state: 'idle' });
          return;
        }
      }

      currentIndex = i;

      await chrome.storage.local.set({
        currentIndex: i,
        totalPrompts: prompts.length,
        state: 'running',
      });

      const success = await runPrompt(i);

      if (!success) {
        isRunning = false;
        await chrome.storage.local.set({ state: 'idle' });
        return;
      }

      if (isStopped) {
        sendProgress('stopped', {});
        isRunning = false;
        await chrome.storage.local.set({ state: 'idle' });
        return;
      }

      if (i < prompts.length - 1) {
        await sleepWithPauseCheck(POST_COMPLETION_DELAY);
        if (isStopped) {
          sendProgress('stopped', {});
          isRunning = false;
          await chrome.storage.local.set({ state: 'idle' });
          return;
        }
      }
    }

    isRunning = false;
    sendProgress('complete', {
      currentIndex: prompts.length,
      total: prompts.length,
    });

    await chrome.storage.local.set({ state: 'idle' });
  }

  async function sleepWithPauseCheck(totalMs) {
    const intervalMs = 150;
    let waited = 0;
    while (waited < totalMs) {
      if (isStopped) return;
      while (isPaused) {
        await sleep(150);
        if (isStopped) return;
      }
      await sleep(intervalMs);
      waited += intervalMs;
    }
  }

  function pauseExecution() {
    isPaused = true;
    sendProgress('paused', {});
  }

  function resumeExecution() {
    isPaused = false;
    sendProgress('resumed', {});
  }

  function stopExecution() {
    isStopped = true;
    isRunning = false;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'start') {
      if (isRunning) {
        sendResponse({ status: 'already_running' });
        return true;
      }

      startExecution(message.systemPrompt, message.prompts, { newChat: message.newChat });
      sendResponse({ status: 'started' });
    } else if (message.action === 'pause') {
      pauseExecution();
      sendResponse({ status: 'paused' });
    } else if (message.action === 'resume') {
      resumeExecution();
      sendResponse({ status: 'resumed' });
    } else if (message.action === 'stop') {
      stopExecution();
      sendResponse({ status: 'stopped' });
    } else if (message.action === 'status') {
      sendResponse({
        status: isRunning ? (isPaused ? 'paused' : 'running') : 'idle',
        currentIndex,
        total: prompts.length,
      });
    }

    return true;
  });
})();