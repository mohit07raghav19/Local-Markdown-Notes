/**
 * DOM Utility Functions
 * Helper functions for DOM manipulation
 */
const DOMUtils = (() => {
  /**
   * Creates an element with specified attributes and content
   * @param {string} tagName - The tag name of the element to create
   * @param {Object} attributes - Object containing attribute key-value pairs
   * @param {string|Node|Array} content - Content to append (string, Node, or array of Nodes)
   * @returns {HTMLElement} The created element
   */
  function createElement(tagName, attributes = {}, content = null) {
    const element = document.createElement(tagName);

    // Set attributes
    for (const [key, value] of Object.entries(attributes)) {
      if (key === "className") {
        element.className = value;
      } else if (key === "style" && typeof value === "object") {
        Object.assign(element.style, value);
      } else {
        element.setAttribute(key, value);
      }
    }

    // Add content if provided
    if (content !== null) {
      if (Array.isArray(content)) {
        content.forEach((item) => {
          if (typeof item === "string") {
            element.appendChild(document.createTextNode(item));
          } else if (item instanceof Node) {
            element.appendChild(item);
          }
        });
      } else if (typeof content === "string") {
        element.textContent = content;
      } else if (content instanceof Node) {
        element.appendChild(content);
      }
    }

    return element;
  }

  /**
   * Updates the status text with an optional timeout to clear
   * @param {string} message - The status message to display
   * @param {number} timeout - Optional timeout to clear the message (in ms)
   */
  function updateStatus(message, timeout = 0) {
    const statusElement = document.getElementById("statusText");
    if (statusElement) {
      statusElement.textContent = message;

      if (timeout > 0) {
        setTimeout(() => {
          statusElement.textContent = "Ready";
        }, timeout);
      }
    }
  }

  /**
   * Shows or hides an element by toggling the 'hidden' class
   * @param {HTMLElement|string} element - The element or element ID to toggle
   * @param {boolean} show - Whether to show (true) or hide (false) the element
   */
  function toggleVisibility(element, show) {
    const el =
      typeof element === "string" ? document.getElementById(element) : element;
    if (el) {
      if (show) {
        el.classList.remove("hidden");
      } else {
        el.classList.add("hidden");
      }
    }
  }

  // Public API
  return {
    createElement,
    updateStatus,
    toggleVisibility,
  };
})();
