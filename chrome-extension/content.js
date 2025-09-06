let extractCount = 0;

async function scrapeAndSend() {
  const vids = [...document.querySelectorAll("video")];
  const ps = [...document.querySelectorAll("p")];
  const prompt = (ps.find(p => (p.textContent||"").length > 50)?.textContent || "").trim();

  const payload = {
    top: vids[0]?.currentSrc || vids[0]?.src || "",
    bottom: vids[1]?.currentSrc || vids[1]?.src || "",
    prompt,
    timestamp: Date.now()
  };

  console.log('🎬 Arena Helper: Scraped data', payload);

  // Store in extension storage for popup
  chrome.storage.local.set({ 
    lastVideoData: payload,
    extractCount: ++extractCount 
  });

  try {
    await fetch("http://localhost:7777/update", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    console.log('✅ Data sent to backend');
  } catch (e) {
    console.warn("❌ POST failed:", e);
  }
}

// Listen for preference commands from backend
window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  
  if (event.data.type === 'SELECT_PREFERENCE') {
    const preference = event.data.preference; // 'top' or 'bottom'
    console.log(`🎯 Selecting ${preference} preference`);
    
    // Look for preference buttons
    const buttons = document.querySelectorAll('button');
    for (const button of buttons) {
      const text = button.textContent?.toLowerCase() || '';
      const hasLeftArrow = text.includes('←') || button.innerHTML.includes('←');
      const hasRightArrow = text.includes('→') || button.innerHTML.includes('→');
      
      if (preference === 'top' && (hasLeftArrow || text.includes('left') || text.includes('first'))) {
        button.click();
        console.log('✅ Clicked top/left preference');
        return;
      } else if (preference === 'bottom' && (hasRightArrow || text.includes('right') || text.includes('second'))) {
        button.click();
        console.log('✅ Clicked bottom/right preference');
        return;
      }
    }
    console.log('⚠️ Preference buttons not found');
  }
});

// Set up monitoring
new MutationObserver(() => scrapeAndSend())
  .observe(document.documentElement, { subtree:true, childList:true });

window.addEventListener("load", scrapeAndSend);
setInterval(scrapeAndSend, 3000);

// Poll for commands from backend
async function pollForCommands() {
  try {
    const response = await fetch("http://localhost:7777/get-commands");
    const data = await response.json();
    
    if (data.commands && data.commands.length > 0) {
      console.log('📥 Received commands from backend:', data.commands);
      
      data.commands.forEach(command => {
        switch (command.type) {
          case 'select_preference':
            selectPreference(command.data.preference);
            break;
          case 'play_videos':
            playVideos();
            break;
          case 'pause_videos':
            pauseVideos();
            break;
          default:
            console.log('❓ Unknown command type:', command.type);
        }
      });
    }
  } catch (e) {
    // Silently fail - backend might not be running
  }
}

// Poll every 2 seconds for commands
setInterval(pollForCommands, 2000);

// TEST: Auto-click right preference every 20 seconds
setInterval(() => {
  console.log('🧪 Testing auto-click right preference...');
  
  const buttons = document.querySelectorAll('button');
  for (const button of buttons) {
    const text = button.textContent?.toLowerCase() || '';
    const hasRightArrow = text.includes('→') || button.innerHTML.includes('→');
    
    if (hasRightArrow || text.includes('right') || text.includes('second')) {
      console.log('🧪 Auto-clicking right preference button for testing');
      button.click();
      break;
    }
  }
}, 20000);

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Content script received:', request);
  
  switch (request.action) {
    case 'extract_videos':
      scrapeAndSend();
      sendResponse({ success: true });
      break;
      
    case 'select_preference':
      selectPreference(request.preference);
      sendResponse({ success: true });
      break;
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
  
  return true; // Keep message channel open
});

function selectPreference(preference) {
  console.log(`🎯 Selecting ${preference} preference...`);
  
  // Look for preference buttons
  const buttons = document.querySelectorAll('button');
  for (const button of buttons) {
    const text = button.textContent?.toLowerCase() || '';
    const hasLeftArrow = text.includes('←') || button.innerHTML.includes('←');
    const hasRightArrow = text.includes('→') || button.innerHTML.includes('→');
    
    if (preference === 'top' && (hasLeftArrow || text.includes('left') || text.includes('first'))) {
      button.click();
      console.log('✅ Clicked top/left preference');
      return;
    } else if (preference === 'bottom' && (hasRightArrow || text.includes('right') || text.includes('second'))) {
      button.click();
      console.log('✅ Clicked bottom/right preference');
      return;
    }
  }
  console.log('⚠️ Preference buttons not found');
}

function playVideos() {
  console.log('▶️ Playing videos...');
  const videos = document.querySelectorAll('video');
  videos.forEach((video, index) => {
    video.play().then(() => {
      console.log(`▶️ Playing video ${index + 1}`);
    }).catch(console.error);
  });
}

function pauseVideos() {
  console.log('⏸️ Pausing videos...');
  const videos = document.querySelectorAll('video');
  videos.forEach((video, index) => {
    video.pause();
    console.log(`⏸️ Paused video ${index + 1}`);
  });
}

console.log('🚀 Arena Helper content script loaded');