(() => {
  let isRunning = false;
  let isPaused = false;
  let isStopped = false;
  let currentIndex = 0;
  let prompts = [];
  let systemPrompt = '';
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
            if (!label.includes('attach') && !label.includes('upload') && !label.includes('microphone') && !label.includes('mic')) {
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
      if (label.includes('new chat') || label.includes('new conversation') || label.includes('start')) {
        return btn;
      }
    }

    const links = Array.from(document.querySelectorAll('a'));
    for (const link of links) {
      const href = (link.getAttribute('href') || '').toLowerCase();
      const text = (link.textContent || '').toLowerCase();
      if (href.includes('/app') || text.includes('new chat') || text.includes('newConversation')) {
        return link;
      }
    }

    return null;
  }

  function findStopButton() {
    const allButtons = Array.from(document.querySelectorAll('button'));
    for (const btn of allButtons) {
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (label.includes('stop')) {
        return btn;
      }
    }
    return null;
  }

  async function pasteText(text) {
    const input = findInputArea();
    if (!input) return false;

    input.focus();
    await sleep(200);

    input.textContent = '';
    await sleep(50);

    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(50);

    try {
      const clipboardItems = [
        new ClipboardItem({
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ];
      await navigator.clipboard.write(clipboardItems);
    } catch (e) {
      // fallback: try older clipboard API
      try {
        await navigator.clipboard.writeText(text);
      } catch (e2) {
        // fallback: use execCommand
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        await sleep(50);
        document.execCommand('insertText', false, text);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(300);
        return true;
      }
    }

    input.focus();
    await sleep(100);

    // Clear existing content first
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    await sleep(100);

    // Dispatch paste event
    document.execCommand('paste', false, null);
    await sleep(300);

    // If paste command didn't work, try DataTransfer approach
    if (!input.textContent || input.textContent.trim().length === 0) {
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(pasteEvent);
      await sleep(300);
    }

    // If still empty, try insertText as final fallback
    if (!input.textContent || input.textContent.trim().length === 0) {
      document.execCommand('insertText', false, text);
      await sleep(200);
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(200);

    return true;
  }

  async function typeTextWithInsertText(text) {
    const input = findInputArea();
    if (!input) return false;

    input.focus();
    await sleep(200);

    input.textContent = '';
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    await sleep(50);

    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(100);

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      document.execCommand('insertText', false, lines[i]);
      if (i < lines.length - 1) {
        const shiftEnter = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          which: 13,
          keyCode: 13,
          shiftKey: true,
          bubbles: true,
        });
        input.dispatchEvent(shiftEnter);
        await sleep(20);
      }
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(300);

    return true;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function ensureInputReady() {
    let input = findInputArea();
    if (input) return input;

    // Try navigating to /app
    if (!window.location.pathname.includes('/app')) {
      window.location.href = 'https://gemini.google.com/app';
      await sleep(3000);
    }

    // Wait for input to appear
    input = await waitForElement('div[contenteditable="true"]', 8000);
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

    // Wait for button to become enabled
    let attempts = 0;
    while (sendBtn.disabled && attempts < 15) {
      await sleep(300);
      sendBtn = findSendButton();
      attempts++;
    }

    if (sendBtn.disabled) {
      sendProgress('error', { error: 'Send button is disabled. Text may not have been entered properly.' });
      return false;
    }

    sendBtn.click();
    return true;
  }

  async function waitForCompletion(maxWaitMs = 300000) {
    const startTime = Date.now();
    let wasGenerating = false;

    await sleep(2000);

    while (true) {
      if (isStopped) return false;

      while (isPaused) {
        await sleep(500);
        if (isStopped) return false;
      }

      const stopBtn = findStopButton();
      const elapsed = Date.now() - startTime;

      if (elapsed > maxWaitMs) {
        break;
      }

      if (stopBtn) {
        wasGenerating = true;
        await sleep(1000);
        continue;
      }

      if (wasGenerating) {
        // Stop button disappeared = Gemini finished
        await sleep(1500);

        // Check for "regenerate" or other indicators
        await sleep(1000);
        return true;
      }

      // If waiting too long with no stop button appearing, the prompt may not have been sent
      const inputArea = findInputArea();
      if (inputArea && inputArea.textContent.trim().length === 0) {
        if (elapsed > 5000) {
          return true;
        }
      }

      await sleep(1000);
    }

    return true;
  }

  function sendProgress(type, data = {}) {
    try {
      chrome.runtime.sendMessage({ type, ...data });
    } catch (e) {
      // popup may be closed
    }
  }

  async function runPrompt(index) {
    const prompt = prompts[index];
    const fullPrompt = systemPrompt
      ? `${systemPrompt}\n\n${prompt}`
      : prompt;

    const input = await ensureInputReady();
    if (!input) {
      sendProgress('error', { error: 'Could not find input area. Open gemini.google.com/app' });
      return false;
    }

    sendProgress('typing', {});

    // Primary: try paste method
    let success = await pasteText(fullPrompt);

    // Fallback: if paste didn't populate the field, try insertText
    const checkInput = findInputArea();
    if (checkInput && (!checkInput.textContent || checkInput.textContent.trim().length === 0)) {
      sendProgress('typing', {});
      success = await typeTextWithInsertText(fullPrompt);
    }

    await sleep(800);

    // Verify text was entered
    const verifyInput = findInputArea();
    if (verifyInput && (!verifyInput.textContent || verifyInput.textContent.trim().length === 0)) {
      sendProgress('error', { error: 'Failed to enter text into Gemini input. Try clicking the input area first.' });
      return false;
    }

    sendProgress('progress', {
      currentIndex: index + 1,
      total: prompts.length,
      currentPrompt: prompt,
    });

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

  async function startExecution(sysPrompt, promptList) {
    systemPrompt = sysPrompt;
    prompts = promptList;
    currentIndex = 0;
    isRunning = true;
    isPaused = false;
    isStopped = false;

    // Verify we're on the right page
    if (!window.location.href.includes('gemini.google.com')) {
      sendProgress('error', { error: 'Please navigate to gemini.google.com/app first' });
      isRunning = false;
      return;
    }

    for (let i = 0; i < prompts.length; i++) {
      if (isStopped) {
        sendProgress('stopped', {});
        isRunning = false;
        return;
      }

      while (isPaused) {
        await sleep(500);
        if (isStopped) {
          sendProgress('stopped', {});
          isRunning = false;
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
        return;
      }

      if (isStopped) {
        sendProgress('stopped', {});
        isRunning = false;
        return;
      }

      // Small buffer after Gemini finishes before next prompt
      if (i < prompts.length - 1) {
        await sleepWithPauseCheck(POST_COMPLETION_DELAY);
        if (isStopped) {
          sendProgress('stopped', {});
          isRunning = false;
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
    const intervalMs = 200;
    let waited = 0;
    while (waited < totalMs) {
      if (isStopped) return;
      while (isPaused) {
        await sleep(200);
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

      startExecution(message.systemPrompt, message.prompts);
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