/**
 * Slash Palette Module
 * Handles slash command functionality
 */
const SlashPalette = (() => {
  // Private variables
  let slashPalette = null;

  // Snippet templates for slash commands
  const snippets = {
    h1: "# ${1:Heading 1}\n",
    h2: "## ${1:Heading 2}\n",
    h3: "### ${1:Heading 3}\n",
    bullet: "- ${1:Item 1}", // Renamed from 'list' to 'bullet' for clarity
    num: "1. ${1:Item 1}", // Added numbered list
    checkbox: "- [ ] ${1:Task 1}",
    code: "```${1:language}\n${2:// your code here}\n```\n",
    table:
      "| ${1:Header 1} | Header 2 | Header 3 |\n| --- | --- | --- |\n| Row 1, Col 1 | Row 1, Col 2 | Row 1, Col 3 |\n| Row 2, Col 1 | Row 2, Col 2 | Row 2, Col 3 |\n",
    link: "[${1:Link text}](${2:url})",
    image: "![${1:Alt text}](${2:image-url})",
    quote: "> ${1:Quote text}\n",
    hr: "---\n",
    bold: "**${1:Bold text}**",
    italic: "*${1:Italic text}*",
    strike: "~~${1:Strikethrough text}~~",
    datetime: () => {
      const now = new Date();
      return now.toISOString().slice(0, 19).replace("T", " ");
    },
  };

  /**
   * Initialize the slash palette module
   */
  function init() {
    slashPalette = document.getElementById("slashPalette");
    setupEventListeners();
  }

  /**
   * Setup event listeners for slash palette
   */
  function setupEventListeners() {
    // Listen for slash command events - used for both initial showing and filtering
    document.addEventListener("slashCommand", (event) => {
      if (event.detail && event.detail.position) {
        // Show palette with filter if provided
        showPalette(event.detail.position, event.detail.filter || "");
      }
    });

    // Listen for hide palette events
    document.addEventListener("hideSlashPalette", () => {
      hidePalette();
    });

    // Listen for clicks outside the palette to close it
    document.addEventListener("click", (event) => {
      if (slashPalette && !slashPalette.classList.contains("hidden") && !slashPalette.contains(event.target)) {
        hidePalette();
      }
    });

    // Listen for keyboard navigation globally (not just when palette is focused)
    document.addEventListener("keydown", (event) => {
      // Only handle if palette is visible
      if (!slashPalette || slashPalette.classList.contains("hidden")) return;

      switch (event.key) {
        case "Escape":
          event.preventDefault();
          hidePalette();
          // Return focus to editor
          const editor = document.getElementById("editor");
          if (editor) editor.focus();
          break;
        case "ArrowDown":
          event.preventDefault();
          navigateSlashPalette("next");
          break;
        case "ArrowUp":
          event.preventDefault();
          navigateSlashPalette("prev");
          break;
        case "Enter":
          event.preventDefault();
          selectCurrentSlashItem();
          break;
      }
    });
  }
  /**
   * Show the slash palette
   * @param {DOMRect} position - The position to show the palette
   * @param {string} filter - Optional filter string
   */
  function showPalette(position, filter = "") {
    if (!slashPalette) return;

    // Position the palette
    slashPalette.style.top = `${position.top + 24}px`;

    // Create menu items with filter
    populatePaletteItems(filter);

    // Only show if we actually have items
    const hasItems = slashPalette.children.length > 0;
    if (hasItems) {
      // Show the palette
      slashPalette.classList.remove("hidden");
      slashPalette.setAttribute("aria-hidden", "false");

      // DON'T take focus - keep it on the editor so input events continue
      // slashPalette.tabIndex = -1;
      // slashPalette.focus();

      // Select first item by default
      navigateSlashPalette("first");
    } else {
      // No items to show, hide palette
      hidePalette();
    }
  }

  /**
   * Hide the slash palette
   */
  function hidePalette() {
    if (!slashPalette) return;

    slashPalette.classList.add("hidden");
    slashPalette.setAttribute("aria-hidden", "true");

    // Make sure editor gets focus back
    const editor = document.getElementById("editor");
    if (editor && document.activeElement !== editor) {
      setTimeout(() => editor.focus(), 0);
    }
  }

  /**
   * Filter palette items based on user input
   * @param {string} filter - The filter text (without slash)
   */
  function filterPalette(filter) {
    if (!slashPalette || !filter) return;

    // Update items with filter
    populatePaletteItems(filter);

    // If no items left after filtering, hide palette
    if (slashPalette.children.length === 0) {
      hidePalette();
      return;
    }

    // Select first item
    navigateSlashPalette("first");
  }

  /**
   * Populate the palette with snippet items
   * @param {string} filter - Optional filter to limit shown items
   */
  function populatePaletteItems(filter = "") {
    if (!slashPalette) return;

    // Clear current items
    slashPalette.innerHTML = "";

    // Normalize filter for comparison
    const normalizedFilter = filter.toLowerCase().trim();

    // Track if we added any items
    let itemsAdded = 0;

    // Create an item for each matching snippet
    for (const [id, template] of Object.entries(snippets)) {
      // If no filter, show all items
      // If filter exists, only show items that start with the filter
      const shouldShow =
        !normalizedFilter || id.toLowerCase().startsWith(normalizedFilter);

      if (shouldShow) {
        const item = createSnippetItem(id, template);
        slashPalette.appendChild(item);
        itemsAdded++;
      }
    }

    // Only hide palette if we have a filter and no matches
    if (itemsAdded === 0 && normalizedFilter) {
      hidePalette();
      return;
    }

    // Don't auto-show here - let showPalette handle visibility
    // The palette visibility will be controlled by showPalette based on item count
  }
  /**
   * Create a snippet item for the palette
   * @param {string} id - The snippet identifier
   * @param {string|Function} template - The snippet template or function
   * @returns {HTMLElement} The snippet item element
   */
  function createSnippetItem(id, template) {
    // Format ID for display
    const displayName = id.charAt(0).toUpperCase() + id.slice(1);

    // Create the item container
    const item = DOMUtils.createElement("div", {
      className: "slash-item",
      tabIndex: 0,
      role: "option",
      "aria-selected": "false",
      "data-command": id,
    });

    // Add prefix element (command name)
    const prefix = DOMUtils.createElement(
      "span",
      {
        className: "slash-prefix",
      },
      `/${id}`
    );
    item.appendChild(prefix);

    // Add description element if we can determine it
    let description = "";
    switch (id) {
      case "h1":
        description = "Heading 1";
        break;
      case "h2":
        description = "Heading 2";
        break;
      case "h3":
        description = "Heading 3";
        break;
      case "bullet":
        description = "Bullet list";
        break;
      case "num":
        description = "Numbered list";
        break;
      case "checkbox":
        description = "Task checkbox";
        break;
      case "code":
        description = "Code block";
        break;
      case "table":
        description = "Table";
        break;
      case "link":
        description = "Link";
        break;
      case "image":
        description = "Image";
        break;
      case "quote":
        description = "Blockquote";
        break;
      case "hr":
        description = "Horizontal rule";
        break;
      case "bold":
        description = "Bold text";
        break;
      case "italic":
        description = "Italic text";
        break;
      case "strike":
        description = "Strikethrough";
        break;
      case "datetime":
        description = "Current date/time";
        break;
      default:
        description = id;
    }

    const desc = DOMUtils.createElement(
      "span",
      {
        className: "slash-description",
      },
      description
    );
    item.appendChild(desc);

    // Add click and keyboard handling
    item.addEventListener("click", (event) => {
      event.preventDefault();
      applySnippet(template);
      hidePalette();
    });

    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        applySnippet(template);
        hidePalette();
      }
    });

    return item;
  }

  /**
   * Navigate through slash palette items
   * @param {string} direction - Direction to navigate ('next', 'prev', or 'first')
   */
  function navigateSlashPalette(direction) {
    if (!slashPalette) return;

    const items = slashPalette.querySelectorAll(".slash-item");
    if (!items.length) return; // No items to navigate

    // Find currently selected item
    let selectedIndex = -1;
    for (let i = 0; i < items.length; i++) {
      if (items[i].classList.contains("selected")) {
        selectedIndex = i;
        break;
      }
    }

    // Calculate next index based on direction
    let nextIndex;
    if (direction === "first") {
      // Select the first item
      nextIndex = 0;
    } else if (direction === "next") {
      nextIndex = selectedIndex === -1 ? 0 : (selectedIndex + 1) % items.length;
    } else {
      nextIndex =
        selectedIndex === -1
          ? items.length - 1
          : (selectedIndex - 1 + items.length) % items.length;
    }

    // Update selection
    for (let i = 0; i < items.length; i++) {
      if (i === nextIndex) {
        items[i].classList.add("selected");
        items[i].setAttribute("aria-selected", "true");
        // Ensure item is visible in the palette
        items[i].scrollIntoView({ block: "nearest" });
      } else {
        items[i].classList.remove("selected");
        items[i].setAttribute("aria-selected", "false");
      }
    }
  }

  /**
   * Select the currently highlighted slash item
   */
  function selectCurrentSlashItem() {
    if (!slashPalette) return;

    const selectedItem = slashPalette.querySelector(".slash-item.selected");
    if (selectedItem) {
      // Trigger a click on the selected item
      selectedItem.click();
    }
  }

  /**
   * Apply the selected snippet to the editor
   * @param {string|Function} template - The snippet template or function
   */
  function applySnippet(template) {
    const editor = document.getElementById("editor");
    if (!editor) return;

    // Get template content (handle function templates)
    let content = typeof template === "function" ? template() : template;

    // Find and remove the slash command text before applying template
    const pos = editor.selectionStart;
    const textBeforeCursor = editor.value.substring(0, pos);
    const lineStart = Math.max(0, textBeforeCursor.lastIndexOf("\n") + 1);
    const currentLine = textBeforeCursor.substring(lineStart);

    // Find the slash position and remove the slash command
    const slashMatch = currentLine.match(/\/(\w*)$/);
    if (slashMatch) {
      const slashStart = lineStart + currentLine.lastIndexOf("/");
      const beforeSlash = editor.value.substring(0, slashStart);
      const afterCursor = editor.value.substring(pos);

      // Replace the content without the slash command
      editor.value = beforeSlash + afterCursor;
      editor.selectionStart = editor.selectionEnd = slashStart;
    }

    // Insert template at cursor position and process placeholders
    MarkdownUtils.applySnippet(editor, content);

    // Ensure editor stays focused
    editor.focus();

    // Trigger change event after snippet is applied
    document.dispatchEvent(
      new CustomEvent("editorContentChanged", {
        detail: { content: editor.value },
      })
    );
  }

  // Public API
  return {
    init,
  };
})();
