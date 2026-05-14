chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'progress' || message.type === 'complete' || message.type === 'error' ||
      message.type === 'prompt_done' || message.type === 'stopped' || message.type === 'waiting' ||
      message.type === 'typing' || message.type === 'paused' || message.type === 'resumed') {
    chrome.runtime.sendMessage(message).catch(() => {});
  }
  return true;
});