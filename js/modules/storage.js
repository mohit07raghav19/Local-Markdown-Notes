/**
 * Storage Module
 * Handles all Chrome storage operations
 */
const Storage = (() => {
  // Private variables
  let autoSaveTimeout = null;
  const AUTO_SAVE_DELAY = 300; // ms

  /**
   * Initialize the storage module
   */
  function init() {
    loadSavedContent();
    setupEventListeners();
  }

  /**
   * Load saved content from Chrome storage
   */
  function loadSavedContent() {
    chrome.storage.local.get(
      ["noteContent", "noteImages", "filename"],
      (result) => {
        const editor = document.getElementById("editor");
        const filenameInput = document.getElementById("filename");

        if (result.noteContent) {
          editor.value = result.noteContent;
        }

        if (result.filename) {
          filenameInput.value = result.filename;
        }

        if (result.noteImages) {
          // Dispatch event for ImageManager to handle
          document.dispatchEvent(
            new CustomEvent("imagesLoaded", {
              detail: { images: result.noteImages },
            })
          );
        }

        DOMUtils.updateStatus("Notes loaded");

        // If preview mode is active, update preview
        document.dispatchEvent(
          new CustomEvent("contentLoaded", {
            detail: { content: editor.value },
          })
        );
      }
    );
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    const editor = document.getElementById("editor");
    const filenameInput = document.getElementById("filename");

    // Auto-save when editor content changes
    editor.addEventListener("input", () => {
      clearTimeout(autoSaveTimeout);
      autoSaveTimeout = setTimeout(() => {
        saveContent(editor.value);
      }, AUTO_SAVE_DELAY);
    });

    // Save filename when it changes
    filenameInput.addEventListener("input", () => {
      saveFilename(filenameInput.value);
    });

    // Listen for save requests from other modules
    document.addEventListener("saveImages", (event) => {
      saveImages(event.detail.images);
    });
  }

  /**
   * Save content to Chrome storage
   * @param {string} content - The content to save
   */
  function saveContent(content) {
    chrome.storage.local.set({ noteContent: content }, () => {
      DOMUtils.updateStatus("Saved", 1000);
    });
  }

  /**
   * Save filename to Chrome storage
   * @param {string} filename - The filename to save
   */
  function saveFilename(filename) {
    chrome.storage.local.set({ filename: filename });
  }

  /**
   * Save images to Chrome storage
   * @param {Object} images - The images object to save
   */
  function saveImages(images) {
    chrome.storage.local.set({ noteImages: images }, () => {
      DOMUtils.updateStatus("Images saved", 1000);
    });
  }

  /**
   * Clear all stored content
   */
  function clearStorage() {
    chrome.storage.local.set(
      {
        noteContent: "",
        noteImages: {},
        filename: "notes",
      },
      () => {
        DOMUtils.updateStatus("Storage cleared", 1000);
      }
    );
  }

  // Public API
  return {
    init,
    saveContent,
    saveFilename,
    saveImages,
    clearStorage,
  };
})();
