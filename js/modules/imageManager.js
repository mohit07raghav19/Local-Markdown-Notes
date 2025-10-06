/**
 * Image Manager Module
 * Handles image-related functionality (storing, rendering, etc.)
 */
const ImageManager = (() => {
  // Private variables
  let images = {};
  // imageCounter removed in favor of deterministic unique ids based on source/timestamp

  // Recent event dedupe: avoid processing the same capture twice (e.g., runtime message + document event)
  const recentEventKeys = {};
  const RECENT_EVENT_TTL = 2000; // ms

  function cleanupRecentEventKeys() {
    const now = Date.now();
    for (const k of Object.keys(recentEventKeys)) {
      if (now - recentEventKeys[k] > RECENT_EVENT_TTL)
        delete recentEventKeys[k];
    }
  }

  function isRecentEvent(key) {
    cleanupRecentEventKeys();
    return !!recentEventKeys[key];
  }

  function markEventKey(key) {
    recentEventKeys[key] = Date.now();
  }

  // Recent inserted ids guard (avoid double inserting the same image reference)
  const recentInserts = {};
  function cleanupRecentInserts() {
    const now = Date.now();
    for (const id of Object.keys(recentInserts)) {
      if (now - recentInserts[id] > RECENT_EVENT_TTL) delete recentInserts[id];
    }
  }

  function wasRecentlyInserted(id) {
    cleanupRecentInserts();
    return !!recentInserts[id];
  }

  function markRecentlyInserted(id) {
    recentInserts[id] = Date.now();
  }

  function makeEventKey(dataUrl, sourceUrl, timestamp) {
    if (dataUrl) {
      // Use a prefix of dataUrl to keep the key short but reasonably unique
      return `d:${dataUrl.slice(0, 200)}:${dataUrl.length}`;
    }
    return `s:${sanitizeForId(sourceUrl || "")}:${timestamp || "0"}`;
  }

  /**
   * Sanitize a string to be safe for use in an id/filename
   * Replaces unsafe characters with underscores and trims repeated underscores
   */
  function sanitizeForId(str) {
    return String(str)
      .toLowerCase()
      .replace(/https?:\/\//, "")
      .replace(/[^a-z0-9-_\.]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  /**
   * Try to extract a YouTube video id from a URL object or string.
   * Supports: youtube.com/watch?v=ID and youtu.be/ID
   */
  function getYouTubeId(url) {
    try {
      const u = typeof url === "string" ? new URL(url) : url;
      const host = (u.hostname || "").toLowerCase();
      if (host.includes("youtube.com") || host.includes("www.youtube.com")) {
        const v = u.searchParams.get("v");
        if (v) return v;
      }
      if (host === "youtu.be" || host.endsWith(".youtu.be")) {
        const p = (u.pathname || "").replace(/^\//, "");
        if (p) return p.split("/")[0];
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  /**
   * Ensure the generated id is unique within the images object.
   * If a collision occurs, append a numeric suffix.
   */
  function ensureUniqueId(baseId) {
    let id = baseId;
    let counter = 1;
    while (images[id]) {
      id = `${baseId}_${counter}`;
      counter++;
    }
    return id;
  }

  /**
   * Try to find an existing image matching the given parameters.
   * We consider it a match if the dataUrl is identical, or if both sourceUrl
   * and formatted timestamp match. Returns the existing id or null.
   */
  function findExistingImage(dataUrl, sourceUrl, formattedTime) {
    for (const [id, img] of Object.entries(images)) {
      if (dataUrl && img.dataUrl === dataUrl) return id;
      if (
        sourceUrl &&
        img.sourceUrl === sourceUrl &&
        formattedTime &&
        img.timestamp === formattedTime
      ) {
        return id;
      }
    }
    return null;
  }

  /**
   * Find an existing image whose id/filename base matches baseId.
   * This catches cases where a base id and a suffixed id (_1) may exist.
   */
  function findExistingByBase(baseId) {
    for (const id of Object.keys(images)) {
      if (id === baseId) return id;
      if (id.startsWith(baseId + "_")) return id;
    }
    return null;
  }

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
        // Use the loaded images as-is. Filename/ID scheme now encodes source/timestamps
        renderImageList();
      }
    });

    // Listen for clear events
    document.addEventListener("clearEditor", () => {
      images = {};
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
      console.debug("[ImageManager] runtime.onMessage received:", message);
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
      console.debug(
        "[ImageManager] document.imageCapture event:",
        event && event.detail
      );
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
    console.debug("[ImageManager] addImage called", {
      dataUrlLength: dataUrl && dataUrl.length,
      title,
      sourceUrl,
      timestamp,
      time: Date.now(),
    });
    // event dedupe: ignore near-duplicate events
    const eventKey = makeEventKey(dataUrl, sourceUrl, timestamp);
    if (isRecentEvent(eventKey)) {
      console.debug("[ImageManager] Ignoring recent duplicate event", eventKey);
      return;
    }
    const date = new Date().toISOString();
    // Format timestamp if provided (for YouTube videos)
    let formattedTime = "";
    if (timestamp) {
      const minutes = Math.floor(timestamp / 60);
      const seconds = Math.floor(timestamp % 60);
      formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }

    // Build a base name for the image id using sourceUrl and/or timestamp.
    let baseId = "img";
    if (sourceUrl) {
      try {
        const url = new URL(sourceUrl);
        // If it's a YouTube link, use the video id which is compact and unique
        const ytId = getYouTubeId(url);
        const timePart = timestamp ? String(timestamp) : String(Date.now());
        if (ytId) {
          baseId = `img_${ytId}_${timePart}`;
        } else {
          // Use hostname and pathname as part of the id for non-YouTube URLs
          const host = sanitizeForId(url.hostname);
          const path = sanitizeForId(url.pathname || "");
          baseId = `img_${host}${path ? "_" + path : ""}_${timePart}`;
        }
      } catch (e) {
        // If URL parsing fails, fallback to sanitized sourceUrl
        baseId = `img_${sanitizeForId(sourceUrl)}_${timestamp || Date.now()}`;
      }
    } else {
      // For pasted images or images without a source, use 'pasted' and current timestamp
      baseId = `img_pasted_${Date.now()}`;
    }

    // If this image already exists (same dataUrl, same source+timestamp, or same base id), reuse it
    let existingId = findExistingImage(dataUrl, sourceUrl, formattedTime);
    if (!existingId) existingId = findExistingByBase(baseId);

    if (existingId) {
      const existing = images[existingId];
      // Update metadata if missing details (e.g., attach timestamp if we now have it)
      let updated = false;
      if (!existing.dataUrl && dataUrl) {
        existing.dataUrl = dataUrl;
        updated = true;
      }
      if ((!existing.timestamp || existing.timestamp === "") && formattedTime) {
        existing.timestamp = formattedTime;
        updated = true;
      }
      if ((!existing.sourceUrl || existing.sourceUrl === null) && sourceUrl) {
        existing.sourceUrl = sourceUrl;
        updated = true;
      }
      if (updated) {
        document.dispatchEvent(
          new CustomEvent("saveImages", { detail: { images: images } })
        );
        renderImageList();
      }

      // Insert a reference to the existing image and avoid creating a duplicate
      if (!wasRecentlyInserted(existing.id)) {
        insertImageReference(existing.id, existing.filename);
        markRecentlyInserted(existing.id);
        DOMUtils.updateStatus(
          `Image reference inserted: ${existing.filename}`,
          1500
        );
      } else {
        DOMUtils.updateStatus(
          `Image already inserted recently: ${existing.filename}`,
          900
        );
      }
      // mark the event so near-duplicates are ignored
      markEventKey(eventKey);
      return;
    }

    const id = ensureUniqueId(baseId);
    const filename = `${id}.png`;

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

    // Insert image reference in editor (guard against rapid duplicate insertions)
    if (!wasRecentlyInserted(id)) {
      insertImageReference(id, filename);
      markRecentlyInserted(id);
      DOMUtils.updateStatus(`Image added: ${filename}`);
    } else {
      DOMUtils.updateStatus(`Image added previously: ${filename}`, 900);
    }
    // mark the event so near-duplicates are ignored
    markEventKey(eventKey);
  }

  /**
   * Insert image reference in editor
   * @param {string} id - The image ID
   * @param {string} filename - The image filename
   */
  function insertImageReference(id, filename) {
    console.debug("[ImageManager] insertImageReference called", {
      id,
      filename,
      time: Date.now(),
      stack: new Error().stack,
    });
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
