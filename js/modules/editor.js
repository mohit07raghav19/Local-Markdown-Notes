/**
 * Editor Module
 * Handles the main markdown editor functionality
 */
const Editor = (() => {
  // Private variables
  let editor = null;

  /**
   * Initialize the editor module
   */
  function init() {
    editor = document.getElementById("editor");
    setupEventListeners();
    setupKeyboardShortcuts();
  }

  /**
   * Setup event listeners for editor
   */
  function setupEventListeners() {
    // Enable tab key in textarea
    editor.addEventListener("keydown", handleKeyDown);

    // Add input event listener for slash command filtering
    editor.addEventListener("input", handleInput);

    // Clear button event
    const clearBtn = document.getElementById("clearBtn");
    clearBtn && clearBtn.addEventListener("click", handleClear);

    // Listen for content update requests
    document.addEventListener("updateEditorContent", (event) => {
      if (event.detail && event.detail.content) {
        editor.value = event.detail.content;
        // Trigger storage update
        document.dispatchEvent(
          new CustomEvent("editorContentChanged", {
            detail: { content: editor.value },
          })
        );
      }
    });
  }

  /**
   * Handle input events for slash command filtering
   * @param {InputEvent} e - The input event
   */
  function handleInput(e) {
    const pos = editor.selectionStart;
    const textBeforeCursor = editor.value.substring(0, pos);

    // Check if we're in the middle of a slash command at line start
    const lineStart = Math.max(0, textBeforeCursor.lastIndexOf("\n") + 1);
    const currentLine = textBeforeCursor.substring(lineStart);

    // If line starts with / or has only whitespace before /
    const trimmed = currentLine.trim();
    if (trimmed.startsWith("/")) {
      // Get everything after the slash
      const afterSlash = trimmed.substring(1);

      // Show the palette with filter
      document.dispatchEvent(
        new CustomEvent("slashCommand", {
          detail: {
            position: editor.getBoundingClientRect(),
            filter: afterSlash,
          },
        })
      );
    } else {
      // Hide palette if we're not in a slash command context
      document.dispatchEvent(new CustomEvent("hideSlashPalette"));
    }

    // Trigger content changed event for storage
    document.dispatchEvent(
      new CustomEvent("editorContentChanged", {
        detail: { content: editor.value },
      })
    );
  }

  /**
   * Setup keyboard shortcuts
   */
  function setupKeyboardShortcuts() {
    // Keyboard shortcuts for formatting
    document.addEventListener("keydown", (event) => {
      // Only process if editor is focused
      if (document.activeElement !== editor) return;

      // Check if slash palette is visible - if so, let it handle navigation keys
      const slashPalette = document.getElementById("slashPalette");
      const paletteVisible =
        slashPalette && !slashPalette.classList.contains("hidden");

      // Don't handle arrow keys if palette is visible (let slash palette handle them)
      if (
        paletteVisible &&
        (event.key === "ArrowUp" ||
          event.key === "ArrowDown" ||
          event.key === "Enter" ||
          event.key === "Escape")
      ) {
        return; // Let the slash palette handle these
      }

      // Ctrl+B for bold
      if (event.ctrlKey && event.key === "b") {
        event.preventDefault();
        applyFormatting("**", "**");
      }

      // Ctrl+I for italic
      if (event.ctrlKey && event.key === "i") {
        event.preventDefault();
        applyFormatting("*", "*");
      }

      // Ctrl+K for link
      if (event.ctrlKey && event.key === "k") {
        event.preventDefault();
        insertLink();
      }
    });
  }

  /**
   * Handle keydown events in the editor
   * @param {KeyboardEvent} e - The keyboard event
   */
  function handleKeyDown(e) {
    // Handle tab key for indentation
    if (e.key === "Tab") {
      e.preventDefault();

      const start = editor.selectionStart;
      const end = editor.selectionEnd;

      // Insert tab at cursor
      editor.value =
        editor.value.substring(0, start) + "  " + editor.value.substring(end);

      // Put cursor after the tab
      editor.selectionStart = editor.selectionEnd = start + 2;
    }

    // Handle list continuation on Enter
    if (e.key === "Enter") {
      // Continue lists on Enter: bullets, numbered lists, and todos
      const val = editor.value;
      const selStart = editor.selectionStart;

      // Find current line boundaries
      const lineStart = val.lastIndexOf("\n", selStart - 1) + 1;
      let lineEnd = val.indexOf("\n", selStart);
      if (lineEnd === -1) lineEnd = val.length;

      const fullLine = val.slice(lineStart, lineEnd);

      // Matches for different list types
      const ordered = fullLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
      const checkbox = fullLine.match(/^(\s*[-+*]\s+\[[ xX]\]\s+)(.*)$/);
      const unordered = fullLine.match(/^(\s*[-+*]\s+)(.*)$/);

      if (ordered || checkbox || unordered) {
        e.preventDefault();

        // If the line contains only the marker (nothing after it), break the list
        const marker = ordered
          ? ordered[0].match(/^\s*\d+\.\s+/)[0]
          : checkbox
          ? checkbox[1]
          : unordered
          ? unordered[1]
          : "";

        const content = ordered
          ? ordered[3]
          : checkbox
          ? checkbox[2]
          : unordered
          ? unordered[2]
          : "";

        if (content.trim().length === 0) {
          // Break the list - insert a newline without the marker
          const before = val.slice(0, selStart);
          const after = val.slice(editor.selectionEnd || selStart);
          editor.value = before + "\n" + after;
          const newCaret = before.length + 1;
          editor.selectionStart = editor.selectionEnd = newCaret;

          // Trigger content changed event
          document.dispatchEvent(
            new CustomEvent("editorContentChanged", {
              detail: { content: editor.value },
            })
          );
          return;
        }

        // Otherwise, continue the list
        let insert = "\n";

        if (ordered) {
          // For ordered list, increment the number
          const spaces = ordered[1];
          const num = parseInt(ordered[2], 10) + 1;
          insert += `${spaces}${num}. `;
        } else if (checkbox) {
          // For checkboxes, keep the same format but unchecked
          insert += checkbox[1].replace(/\[x\]/i, "[ ]");
        } else if (unordered) {
          // For unordered list, keep the same bullet style
          insert += unordered[1];
        }

        // Insert and set caret
        const before = val.slice(0, selStart);
        const after = val.slice(editor.selectionEnd || selStart);
        editor.value = before + insert + after;
        const newCaret = before.length + insert.length;
        editor.selectionStart = editor.selectionEnd = newCaret;

        // Trigger content changed event
        document.dispatchEvent(
          new CustomEvent("editorContentChanged", {
            detail: { content: editor.value },
          })
        );
      }
    }

    // Handle slash command
    if (e.key === "/") {
      const pos = editor.selectionStart;
      const textBeforeCursor = editor.value.substring(0, pos);
      const lastNewlinePos = textBeforeCursor.lastIndexOf("\n");
      const lineStart = lastNewlinePos === -1 ? 0 : lastNewlinePos + 1;
      const currentLine = textBeforeCursor.substring(lineStart);

      // If this is at the start of a line or after whitespace only
      if (currentLine.trim() === "") {
        // Dispatch event for SlashPalette to handle
        document.dispatchEvent(
          new CustomEvent("slashCommand", {
            detail: {
              position: editor.getBoundingClientRect(),
              filter: "", // Empty filter for initial display
            },
          })
        );
      }
    }
  }

  /**
   * Handle clear button click
   */
  function handleClear() {
    if (!confirm("Clear all notes and images? This cannot be undone.")) return;

    editor.value = "";

    // Dispatch events to clear other modules
    document.dispatchEvent(new CustomEvent("clearEditor", { detail: {} }));

    // Update storage
    Storage.clearStorage();

    DOMUtils.updateStatus("Cleared");
  }

  /**
   * Apply formatting to selected text
   * @param {string} prefix - The formatting prefix
   * @param {string} suffix - The formatting suffix
   */
  function applyFormatting(prefix, suffix) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selectedText = editor.value.substring(start, end);

    // Apply formatting to selected text
    const newText = prefix + selectedText + suffix;
    editor.value =
      editor.value.substring(0, start) + newText + editor.value.substring(end);

    // Adjust selection to be inside the formatting if empty
    if (start === end) {
      editor.selectionStart = start + prefix.length;
      editor.selectionEnd = start + prefix.length;
    } else {
      editor.selectionStart = start;
      editor.selectionEnd = start + newText.length;
    }

    editor.focus();
  }

  /**
   * Insert link at cursor position
   */
  function insertLink() {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selectedText = editor.value.substring(start, end);

    // Create link with selected text as text or placeholder
    const linkText = selectedText || "link text";
    const link = `[${linkText}](url)`;

    editor.value =
      editor.value.substring(0, start) + link + editor.value.substring(end);

    // Set cursor position to url for easy editing
    const cursorPos = start + link.indexOf("url");
    editor.selectionStart = cursorPos;
    editor.selectionEnd = cursorPos + 3; // select "url"

    editor.focus();
  }

  /**
   * Get the current content of the editor
   * @returns {string} The editor content
   */
  function getContent() {
    return editor ? editor.value : "";
  }

  /**
   * Set the content of the editor
   * @param {string} content - The content to set
   */
  function setContent(content) {
    if (editor) {
      editor.value = content;
    }
  }

  // Public API
  return {
    init,
    getContent,
    setContent,
    applyFormatting,
  };
})();
