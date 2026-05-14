chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'progress' || message.type === 'complete' || message.type === 'error' ||
      message.type === 'prompt_done' || message.type === 'stopped' || message.type === 'waiting' ||
      message.type === 'typing' || message.type === 'paused' || message.type === 'resumed') {
    // Forward to popup
    chrome.runtime.sendMessage(message).catch(() => {});
  }
  return true;
});

chrome.action.onClicked.addListener((tab) => {
  if (!tab.url?.includes('gemini.google.com')) {
    chrome.tabs.create({ url: 'https://gemini.google.com/app' });
  }
});