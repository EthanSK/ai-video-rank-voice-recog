// Background script (service worker)
console.log('🚀 AI Video Ranking Extension background script loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('📦 Extension installed/updated');
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Background received message:', request);
  
  switch (request.action) {
    case 'get_status':
      sendResponse({ 
        status: 'active',
        timestamp: Date.now()
      });
      break;
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
  
  return true; // Keep message channel open
});