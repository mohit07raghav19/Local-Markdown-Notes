/**
 * Image Manager Module
 * Handles image-related functionality (storing, rendering, etc.)
 */
const ImageManager = (() => {
  // Private variables
  let images = {};
  let imageCounter = 0;

  /**
   * Initialize the image manager module
   */
  function init() {
    setupEventListeners();
    setupPasteHandler();
  }

  /**
   * Setup event listeners for image management
   */
  function setupEventListeners() {
    const imagesToggleBtn = document.getElementById("imagesToggleBtn");

    // Images panel toggle button
    imagesToggleBtn &&
      imagesToggleBtn.addEventListener("click", toggleImagesPanel);

    // Listen for images loaded from storage
    document.addEventListener("imagesLoaded", (event) => {
      if (event.detail && event.detail.images) {
        images = event.detail.images;
        // Find highest image counter
        imageCounter = Object.keys(images).reduce((max, key) => {
          const num = parseInt(key.replace("img", ""));
          return num > max ? num : max;
        }, 0);

        renderImageList();
      }
    });

    // Listen for clear events
    document.addEventListener("clearEditor", () => {
      images = {};
      imageCounter = 0;
      renderImageList();
      document.dispatchEvent(
        new CustomEvent("saveImages", {
          detail: { images: images },
        })
      );
    });

    // Listen for image requests from other modules
    document.addEventListener("requestImages", (event) => {
      if (event.detail && typeof event.detail.callback === "function") {
        event.detail.callback(images);
      }
    });

    // Listen for screenshot captured event from background.js
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "commandScreenshot" && message.dataUrl) {
        addImage(
          message.dataUrl,
          message.title,
          message.url,
          message.timestamp
        );
      }
    });

    // Listen for image capture events from Screenshots module
    document.addEventListener("imageCapture", (event) => {
      if (event.detail && event.detail.dataUrl) {
        addImage(
          event.detail.dataUrl,
          event.detail.title || "Screenshot",
          event.detail.url,
          event.detail.timestamp
        );
      }
    });
  }

  /**
   * Setup paste handler for clipboard images
   */
  function setupPasteHandler() {
    const editor = document.getElementById("editor");

    editor &&
      editor.addEventListener("paste", (event) => {
        // Check if clipboard has images
        if (event.clipboardData && event.clipboardData.items) {
          const items = event.clipboardData.items;

          for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
              // We found an image in the clipboard
              const file = items[i].getAsFile();
              const reader = new FileReader();

              reader.onload = function (e) {
                const dataUrl = e.target.result;
                addImage(dataUrl, "Clipboard Image", null);
              };

              reader.readAsDataURL(file);
              event.preventDefault();
              return;
            }
          }
        }
      });
  }

  /**
   * Toggle the images panel visibility
   */
  function toggleImagesPanel() {
    const imagesExpandable = document.getElementById("imagesExpandable");
    const imagesToggleBtn = document.getElementById("imagesToggleBtn");

    if (!imagesExpandable || !imagesToggleBtn) return;

    const isVisible = !imagesExpandable.classList.contains("hidden");

    if (isVisible) {
      imagesExpandable.classList.add("hidden");
      imagesToggleBtn.textContent = "Show ▾";
      imagesToggleBtn.setAttribute("aria-expanded", "false");
    } else {
      imagesExpandable.classList.remove("hidden");
      imagesToggleBtn.textContent = "Hide ▴";
      imagesToggleBtn.setAttribute("aria-expanded", "true");
    }
  }

  /**
   * Add a new image to the collection
   * @param {string} dataUrl - The image data URL
   * @param {string} title - The image title
   * @param {string} sourceUrl - Optional source URL
   * @param {number} timestamp - Optional timestamp for videos
   */
  function addImage(dataUrl, title = "", sourceUrl = null, timestamp = null) {
    imageCounter++;
    const id = `img${imageCounter}`;
    const filename = `${id}.png`;
    const date = new Date().toISOString();

    // Format timestamp if provided (for YouTube videos)
    let formattedTime = "";
    if (timestamp) {
      const minutes = Math.floor(timestamp / 60);
      const seconds = Math.floor(timestamp % 60);
      formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }

    // Create image metadata
    images[id] = {
      id,
      dataUrl,
      filename,
      title: title || "Image",
      date,
      sourceUrl,
      timestamp: formattedTime,
    };

    // Update storage
    document.dispatchEvent(
      new CustomEvent("saveImages", {
        detail: { images: images },
      })
    );

    // Update image list in UI
    renderImageList();

    // Insert image reference in editor
    insertImageReference(id, filename);

    DOMUtils.updateStatus(`Image added: ${filename}`);
  }

  /**
   * Insert image reference in editor
   * @param {string} id - The image ID
   * @param {string} filename - The image filename
   */
  function insertImageReference(id, filename) {
    const editor = document.getElementById("editor");
    if (!editor) return;

    const cursorPos = editor.selectionStart;
    const textBefore = editor.value.substring(0, cursorPos);
    const textAfter = editor.value.substring(cursorPos);

    // Get the image data
    const image = images[id];

    // Create source link if URL exists (not as a comment but directly in markdown)
    let sourceLink = "";
    if (image && image.sourceUrl) {
      // Build the link text with timestamp if available
      const linkText = image.timestamp
        ? `${image.title || "Screenshot"} at ${image.timestamp}`
        : image.title || "Screenshot";

      // If we have a timestamp, add it to the URL for YouTube videos
      let finalUrl = image.sourceUrl;
      if (image.timestamp && image.sourceUrl.includes("youtube.com/watch")) {
        try {
          const url = new URL(image.sourceUrl);
          // Convert timestamp (MM:SS) to seconds for URL parameter
          const timeParts = image.timestamp.split(":");
          const totalSeconds =
            parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);
          url.searchParams.set("t", `${totalSeconds}s`);
          finalUrl = url.toString();
        } catch (e) {
          console.warn("Failed to parse URL for timestamp:", e);
          // Fall back to original URL
        }
      }

      sourceLink = `\n**Source:** [${linkText}](${finalUrl})`;
    }

    // Insert markdown image reference at cursor
    const imageMarkdown = `\n![Screenshot](images/${filename})${sourceLink}`;
    editor.value = textBefore + imageMarkdown + textAfter;

    // Move cursor after the inserted text
    const newCursorPos = cursorPos + imageMarkdown.length;
    editor.selectionStart = editor.selectionEnd = newCursorPos;

    editor.focus();

    // Trigger storage update
    document.dispatchEvent(
      new CustomEvent("editorContentChanged", {
        detail: { content: editor.value },
      })
    );
  }

  /**
   * Render the image list in the UI
   */
  function renderImageList() {
    const imagesExpandableList = document.getElementById(
      "imagesExpandableList"
    );
    const imagesCountHeader = document.getElementById("imagesCountHeader");

    if (!imagesExpandableList || !imagesCountHeader) return;

    // Update image count
    const imageCount = Object.keys(images).length;
    imagesCountHeader.textContent = `${imageCount}`;

    // Clear current list
    imagesExpandableList.innerHTML = "";

    // Add each image to the list
    for (const [id, image] of Object.entries(images)) {
      const imageEl = createImageElement(image);
      imagesExpandableList.appendChild(imageEl);
    }
  }

  /**
   * Create an image element for the image list
   * @param {Object} image - The image data
   * @returns {HTMLElement} The image element
   */
  function createImageElement(image) {
    const container = DOMUtils.createElement("div", {
      className: "images-expand-item",
    });

    // Image preview
    const img = DOMUtils.createElement("img", {
      src: image.dataUrl,
      alt: image.title,
      title: image.title,
    });

    // Metadata
    const meta = DOMUtils.createElement(
      "div",
      { className: "meta" },
      image.filename
    );

    // Actions container
    const actions = DOMUtils.createElement("div", { className: "actions" });

    // Insert button
    const insertBtn = DOMUtils.createElement(
      "button",
      {
        className: "btn btn-secondary",
        title: "Insert image at cursor",
      },
      "Insert"
    );

    insertBtn.addEventListener("click", () => {
      insertImageReference(image.id, image.filename);
      DOMUtils.updateStatus("Image reference inserted", 1500);
    });

    // Delete button
    const deleteBtn = DOMUtils.createElement(
      "button",
      {
        className: "btn btn-secondary",
        title: "Delete image",
      },
      "✕"
    );

    deleteBtn.addEventListener("click", () => {
      // Remove confirmation dialog
      delete images[image.id];
      renderImageList();
      document.dispatchEvent(
        new CustomEvent("saveImages", {
          detail: { images: images },
        })
      );
      DOMUtils.updateStatus(`Deleted: ${image.filename}`);
    });

    // Assemble the components
    actions.appendChild(insertBtn);
    actions.appendChild(deleteBtn);

    container.appendChild(img);
    container.appendChild(meta);
    container.appendChild(actions);

    return container;
  }

  // Public API
  return {
    init,
    addImage,
    renderImageList,
  };
})();
