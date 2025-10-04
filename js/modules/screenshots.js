/**
 * Screenshots Module
 * Handles screenshot capture functionality
 */
const Screenshots = (() => {
  /**
   * Initialize the screenshots module
   */
  function init() {
    setupEventListeners();
  }

  /**
   * Setup event listeners for screenshot functionality
   */
  function setupEventListeners() {
    const screenshotBtn = document.getElementById("screenshotBtn");

    // Screenshot button click
    screenshotBtn && screenshotBtn.addEventListener("click", captureScreenshot);
  }

  /**
   * Capture screenshot of active tab
   */
  function captureScreenshot() {
    DOMUtils.updateStatus("Capturing screenshot...");

    // Request screenshot from background.js
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) {
        DOMUtils.updateStatus("No active tab found");
        return;
      }

      const activeTab = tabs[0];

      chrome.tabs.sendMessage(
        activeTab.id,
        { action: "getTimestampAndCapture" },
        (response) => {
          if (chrome.runtime.lastError) {
            // Try standard screenshot
            captureStandardScreenshot();
          } else if (
            response &&
            (response.videoScreenshot || response.timestamp !== null)
          ) {
            // We got a response from the content script
            if (response.videoScreenshot) {
              // Handle YouTube video screenshot
              document.dispatchEvent(
                new CustomEvent("imageCapture", {
                  detail: {
                    dataUrl: response.videoScreenshot,
                    title: activeTab.title,
                    url: activeTab.url,
                    timestamp: response.timestamp,
                  },
                })
              );
            } else {
              // Fall back to standard screenshot
              captureStandardScreenshot();
            }
          } else {
            // Fall back to standard screenshot
            captureStandardScreenshot();
          }
        }
      );
    });
  }

  /**
   * Capture standard screenshot of the active tab
   */
  function captureStandardScreenshot() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) {
        DOMUtils.updateStatus("No active tab found");
        return;
      }

      const activeTab = tabs[0];

      chrome.tabs.captureVisibleTab(
        activeTab.windowId,
        { format: "png" },
        (dataUrl) => {
          if (chrome.runtime.lastError) {
            DOMUtils.updateStatus("Screenshot failed");
            console.error("Screenshot error:", chrome.runtime.lastError);
            return;
          }

          document.dispatchEvent(
            new CustomEvent("imageCapture", {
              detail: {
                dataUrl: dataUrl,
                title: activeTab.title,
                url: activeTab.url,
              },
            })
          );
        }
      );
    });
  }

  // Public API
  return {
    init,
    captureScreenshot,
  };
})();
