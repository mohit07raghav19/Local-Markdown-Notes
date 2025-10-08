/**
 * Shortcut Helper Module
 * Helps users configure the Alt+O keyboard shortcut
 */
const ShortcutHelper = (() => {
  let notificationShown = false;

  /**
   * Initialize the shortcut helper
   */
  function init() {
    // Check if user has been notified before
    chrome.storage.local.get(["shortcutNotificationShown"], (result) => {
      if (!result.shortcutNotificationShown) {
        // Wait a bit before showing notification (don't interrupt user immediately)
        setTimeout(() => {
          showShortcutSetupGuide();
        }, 3000);
      }
    });
  }

  /**
   * Show a notification guiding users to set up the keyboard shortcut
   */
  function showShortcutSetupGuide() {
    if (notificationShown) return;
    notificationShown = true;

    const notification = document.createElement("div");
    notification.className = "shortcut-notification";
    notification.innerHTML = `
      <div class="shortcut-notification-content">
        <strong>⌨️ Setup Keyboard Shortcut</strong>
        <p>To use <kbd>Option+O</kbd> (Alt+O) for screenshots:</p>
        <ol style="margin: 8px 0; padding-left: 20px; font-size: 12px;">
          <li>Click the button below to open shortcuts settings</li>
          <li>Find "Capture screenshot of video or page"</li>
          <li>Click in the field and press <kbd>Option+O</kbd></li>
        </ol>
        <div style="display: flex; gap: 8px; margin-top: 12px;">
          <button id="openShortcutsBtn" class="btn btn-primary" style="flex: 1;">
            Open Shortcuts Settings
          </button>
          <button id="dismissShortcutBtn" class="btn btn-secondary">
            Dismiss
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(notification);

    // Add CSS if not already present
    if (!document.getElementById("shortcut-helper-styles")) {
      const style = document.createElement("style");
      style.id = "shortcut-helper-styles";
      style.textContent = `
        .shortcut-notification {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: #2a2a2a;
          border: 1px solid #444;
          border-radius: 8px;
          padding: 20px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
          z-index: 10000;
          animation: slideIn 0.3s ease-out;
        }

        .shortcut-notification-content {
          color: #e0e0e0;
        }

        .shortcut-notification-content strong {
          font-size: 16px;
          display: block;
          margin-bottom: 8px;
        }

        .shortcut-notification-content p {
          margin: 8px 0;
          font-size: 13px;
          color: #b0b0b0;
        }

        .shortcut-notification kbd {
          background: #444;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: monospace;
          font-size: 12px;
          border: 1px solid #555;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translate(-50%, -45%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
      `;
      document.head.appendChild(style);
    }

    // Handle open shortcuts button
    document
      .getElementById("openShortcutsBtn")
      ?.addEventListener("click", () => {
        chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
        closeNotification(notification);
      });

    // Handle dismiss button
    document
      .getElementById("dismissShortcutBtn")
      ?.addEventListener("click", () => {
        closeNotification(notification);
      });
  }

  /**
   * Close and remove the notification
   */
  function closeNotification(notification) {
    notification.style.animation = "slideOut 0.3s ease-in";
    notification.addEventListener("animationend", () => {
      notification.remove();
    });

    // Mark as shown so we don't show it again
    chrome.storage.local.set({ shortcutNotificationShown: true });

    // Add slide out animation
    const style = document.createElement("style");
    style.textContent = `
      @keyframes slideOut {
        from {
          opacity: 1;
          transform: translate(-50%, -50%);
        }
        to {
          opacity: 0;
          transform: translate(-50%, -55%);
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Reset the notification (for testing or if user wants to see it again)
   */
  function resetNotification() {
    chrome.storage.local.remove("shortcutNotificationShown");
    notificationShown = false;
  }

  // Public API
  return {
    init,
    showShortcutSetupGuide,
    resetNotification,
  };
})();
