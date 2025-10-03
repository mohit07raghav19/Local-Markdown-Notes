// Handle extension icon click - open side panel
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openSidePanel") {
    chrome.sidePanel.open({ windowId: sender.tab.windowId });
  }
  return true;
});

// Handle keyboard command to capture screenshot (defined in manifest.commands)
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "capture-screenshot") return;
  try {
    // Find active tab
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab) return;

      // Try content script capture (video element) first
      let dataUrl = null;
      try {
        chrome.tabs.sendMessage(
          tab.id,
          { action: "getTimestampAndCapture" },
          (resp) => {
            if (chrome.runtime.lastError) {
              console.warn(
                "background sendMessage error:",
                chrome.runtime.lastError.message
              );
              // fallback to full capture
              chrome.tabs.captureVisibleTab(
                tab.windowId,
                { format: "png" },
                (img) => {
                  if (!chrome.runtime.lastError) {
                    // send to all side panel clients
                    chrome.runtime.sendMessage({
                      action: "commandScreenshot",
                      dataUrl: img,
                      title: tab.title,
                      url: tab.url,
                    });
                  }
                }
              );
            } else if (resp && resp.videoScreenshot) {
              chrome.runtime.sendMessage({
                action: "commandScreenshot",
                dataUrl: resp.videoScreenshot,
                title: tab.title,
                url: tab.url,
                timestamp: resp.timestamp,
              });
            } else {
              // fallback to full capture
              chrome.tabs.captureVisibleTab(
                tab.windowId,
                { format: "png" },
                (img) => {
                  if (!chrome.runtime.lastError) {
                    chrome.runtime.sendMessage({
                      action: "commandScreenshot",
                      dataUrl: img,
                      title: tab.title,
                      url: tab.url,
                    });
                  }
                }
              );
            }
          }
        );
      } catch (err) {
        console.warn("background capture error:", err);
      }
    });
  } catch (err) {
    console.error("commands handler error:", err);
  }
});
