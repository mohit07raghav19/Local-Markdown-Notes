/**
 * UI Module
 * Handles UI state management and common UI operations
 */
const UI = (() => {
  /**
   * Initialize the UI module
   */
  function init() {
    setupEventListeners();
  }

  /**
   * Setup event listeners for UI interactions
   */
  function setupEventListeners() {
    // Listen for image capture events
    document.addEventListener("imageCapture", (event) => {
      if (event.detail) {
        ImageManager.addImage(
          event.detail.dataUrl,
          event.detail.title,
          event.detail.url,
          event.detail.timestamp
        );
      }
    });
  }

  /**
   * Update the status text with an optional timeout to clear
   * @param {string} message - The status message to display
   * @param {number} timeout - Optional timeout to clear the message (in ms)
   */
  function updateStatus(message, timeout = 0) {
    DOMUtils.updateStatus(message, timeout);
  }

  /**
   * Show or hide an element by toggling the 'hidden' class
   * @param {HTMLElement|string} element - The element or element ID to toggle
   * @param {boolean} show - Whether to show (true) or hide (false) the element
   */
  function toggleVisibility(element, show) {
    DOMUtils.toggleVisibility(element, show);
  }

  // Public API
  return {
    init,
    updateStatus,
    toggleVisibility,
  };
})();
