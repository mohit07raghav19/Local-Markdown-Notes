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
        const trySend = () =>
          new Promise((resolve) => {
            try {
              chrome.tabs.sendMessage(
                tab.id,
                { action: "getTimestampAndCapture" },
                (resp) => {
                  if (chrome.runtime.lastError)
                    resolve({ error: chrome.runtime.lastError });
                  else resolve({ resp });
                }
              );
            } catch (e) {
              resolve({ error: e });
            }
          });

        let out = await trySend();
        if (out && out.error) {
          // attempt to inject content script and retry
          if (chrome.scripting && chrome.scripting.executeScript) {
            try {
              await new Promise((res, rej) => {
                chrome.scripting.executeScript(
                  { target: { tabId: tab.id }, files: ["content.js"] },
                  () => {
                    if (chrome.runtime.lastError) rej(chrome.runtime.lastError);
                    else res();
                  }
                );
              });
              out = await trySend();
            } catch (e) {
              console.warn("scripting.executeScript failed:", e);
              out = { error: e };
            }
          }
        }

        if (out && out.resp && out.resp.videoScreenshot) {
          chrome.runtime.sendMessage({
            action: "commandScreenshot",
            dataUrl: out.resp.videoScreenshot,
            title: tab.title,
            url: tab.url,
            timestamp: out.resp.timestamp,
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
      } catch (err) {
        console.warn("background capture error:", err);
      }
    });
  } catch (err) {
    console.error("commands handler error:", err);
  }
});
