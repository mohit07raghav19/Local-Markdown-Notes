/**
 * Vim Mode Module
 * Initializes vim.js library, updates status bar mode badge,
 * and handles Option+I toggling focus between editor and active tab video.
 */
const VimMode = (() => {
  let editor = null;
  let badge = null;
  let vimInstance = null;

  /**
   * Initialize the Vim Mode module
   */
  function init() {
    editor = document.getElementById("editor");
    badge = document.getElementById("vimModeBadge");

    if (!editor) {
      console.error("VimMode: Editor element not found");
      return;
    }

    try {
      // Initialize vim.js on all selected elements (restricted to #editor in lib/vim.js)
      vimInstance = vim.open({
        debug: false,
        showMsg: (msg) => {
          console.log("Vim.js:", msg);
        }
      });

      setupEventListeners();
      console.log("Vim.js initialized successfully");
    } catch (e) {
      console.error("Failed to initialize Vim.js:", e);
    }
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Listen for Vim mode changes
    window.document.addEventListener("vimModeChanged", (event) => {
      const mode = event.detail.mode;
      updateVimBadge(mode);
      scrollCursorIntoView();
    });

    // Auto-focus editor when clicking strictly inside the editor container
    document.addEventListener("click", (e) => {
      if (e.target.closest(".editor-container")) {
        if (editor && document.activeElement !== editor) {
          editor.focus();
        }
      }
    });


    // Auto-scroll on movements to keep cursor in view
    editor.addEventListener("keyup", scrollCursorIntoView);
    editor.addEventListener("click", scrollCursorIntoView);

    // Document-wide selection change listener to ensure precise scrolling on Vim movement
    document.addEventListener("selectionchange", () => {
      if (document.activeElement === editor) {
        scrollCursorIntoView();
      }
    });

    // Capture Option+K, Option+J, Option+L in the capture phase to control active tab video
    editor.addEventListener("keydown", (e) => {
      if (e.altKey) {
        let action = null;
        const code = e.code;

        if (code === "KeyK") {
          action = "togglePlayPause";
        } else if (code === "KeyJ") {
          action = "rewindVideo";
        } else if (code === "KeyL") {
          action = "forwardVideo";
        }

        if (action) {
          e.preventDefault();
          e.stopPropagation();
          try {
            controlActiveTabVideo(action);
          } catch (err) {
            console.error("VimMode: failed to control video", err);
          }
        }
      }
    }, true); // Use capture phase to intercept before vim.js or editor input
  }

  /**
   * Send control actions directly to the active tab's content script
   */
  function controlActiveTabVideo(action) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs && tabs[0];
      if (!activeTab) return;
      chrome.tabs.sendMessage(activeTab.id, { action: action }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("controlActiveTabVideo failed:", chrome.runtime.lastError.message);
        }
      });
    });
  }

  /**
   * Keep the active line visible in the editor during VIM navigation
   */
  function scrollCursorIntoView() {
    if (!editor) return;
    const text = editor.value;

    // Determine active cursor position (supporting Visual mode selection end)
    let activePos = editor.selectionStart;
    if (vimInstance && vimInstance.vim && vimInstance.vim.isMode("visual_mode")) {
      if (vimInstance.vim.visualCursor !== undefined) {
        activePos = vimInstance.vim.visualCursor;
      }
    }

    // Count newlines before the selection start to get current line index
    const subText = text.substring(0, activePos);
    const lineIndex = subText.split("\n").length - 1;

    // Line height is 14px * 1.6 = 22.4px. Padding is 16px.
    const lineHeight = 22.4;
    const paddingOffset = 16;
    const cursorTop = paddingOffset + lineIndex * lineHeight;
    const cursorBottom = cursorTop + lineHeight;

    const scrollTop = editor.scrollTop;
    const clientHeight = editor.clientHeight;
    const margin = lineHeight * 2; // 44.8px margin (2 lines)

    if (cursorTop < scrollTop + margin) {
      editor.scrollTop = Math.max(0, cursorTop - margin);
    } else if (cursorBottom > scrollTop + clientHeight - margin) {
      editor.scrollTop = Math.max(0, cursorBottom - clientHeight + margin);
    }
  }

  /**
   * Update the VIM mode badge UI
   * @param {string} mode - The active vim mode name
   */
  function updateVimBadge(mode) {
    if (!badge || !editor) return;

    // Reset styles
    badge.className = "vim-badge";
    editor.classList.remove("vim-normal-mode");

    switch (mode) {
      case "edit_mode":
        badge.innerText = "-- INSERT --";
        badge.classList.add("badge-insert");
        break;
      case "general_mode":
        badge.innerText = "-- NORMAL --";
        badge.classList.add("badge-normal");
        editor.classList.add("vim-normal-mode");
        break;
      case "visual_mode":
        badge.innerText = "-- VISUAL --";
        badge.classList.add("badge-visual");
        break;
      case "command_mode":
        badge.innerText = "-- COMMAND --";
        badge.classList.add("badge-insert");
        break;
      default:
        badge.innerText = `-- ${mode.toUpperCase()} --`;
        badge.classList.add("badge-insert");
    }
  }

  // Public API
  return {
    init
  };
})();
