/**
 * Preview Module
 * Handles markdown preview rendering
 */
const Preview = (() => {
  // Private variables
  let isPreviewMode = false;

  /**
   * Initialize the preview module
   */
  function init() {
    setupEventListeners();
  }

  /**
   * Setup event listeners for preview functionality
   */
  function setupEventListeners() {
    const toggleViewBtn = document.getElementById("toggleView");

    // Toggle preview button click
    toggleViewBtn && toggleViewBtn.addEventListener("click", togglePreview);

    // Listen for content updates to refresh preview
    document.addEventListener("contentLoaded", (event) => {
      if (isPreviewMode && event.detail.content) {
        renderPreview(event.detail.content);
      }
    });

    document.addEventListener("editorContentChanged", (event) => {
      if (isPreviewMode && event.detail.content) {
        renderPreview(event.detail.content);
      }
    });
  }

  /**
   * Toggle between edit and preview modes
   */
  function togglePreview() {
    const editor = document.getElementById("editor");
    const preview = document.getElementById("preview");
    const editorContainer = document.querySelector(".editor-container");

    isPreviewMode = !isPreviewMode;

    if (isPreviewMode) {
      // Show preview
      renderPreview(editor.value);
      preview.classList.remove("hidden");
      editorContainer.classList.add("hidden");
    } else {
      // Show editor
      preview.classList.add("hidden");
      editorContainer.classList.remove("hidden");
    }

    // Update button text
    const toggleViewBtn = document.getElementById("toggleView");
    if (toggleViewBtn) {
      toggleViewBtn.innerHTML = isPreviewMode
        ? 'Edit <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>'
        : 'Preview <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.2"></circle></svg>';
    }
  }

  /**
   * Render markdown preview
   * @param {string} markdown - The markdown content to render
   */
  function renderPreview(markdown) {
    const preview = document.getElementById("preview");
    if (!preview) return;

    // Convert markdown to HTML using MarkdownUtils
    const html = MarkdownUtils.markdownToHTML(markdown);
    preview.innerHTML = html;

    // Process any images with relative paths
    processImagePaths();
  }

  /**
   * Process image paths in the preview
   * Converts relative paths to data URLs using images from storage
   */
  function processImagePaths() {
    // Request images from ImageManager
    document.dispatchEvent(
      new CustomEvent("requestImages", {
        detail: {
          callback: (images) => {
            const preview = document.getElementById("preview");
            const imgElements = preview.querySelectorAll("img");

            imgElements.forEach((img) => {
              const src = img.getAttribute("src");
              // If src is a relative path that could match an image id
              if (src && !src.startsWith("data:") && !src.startsWith("http")) {
                // Look for matching image by filename
                for (const [id, image] of Object.entries(images)) {
                  if (src.endsWith(image.filename)) {
                    img.src = image.dataUrl;
                    break;
                  }
                }
              }
            });
          },
        },
      })
    );
  }

  // Public API
  return {
    init,
    togglePreview,
    renderPreview,
  };
})();
