/**
 * File Handler Module
 * Handles file operations (open, export)
 */
const FileHandler = (() => {
  /**
   * Initialize the file handler module
   */
  function init() {
    setupEventListeners();
  }

  /**
   * Setup event listeners for file operations
   */
  function setupEventListeners() {
    const openFileBtn = document.getElementById("openFileBtn");
    const fileInput = document.getElementById("fileInput");
    const exportBtn = document.getElementById("exportBtn");

    // Open file button click
    openFileBtn &&
      openFileBtn.addEventListener("click", () => {
        fileInput.click();
      });

    // File input change
    fileInput && fileInput.addEventListener("change", handleFileOpen);

    // Export button click
    exportBtn && exportBtn.addEventListener("click", handleExport);
  }

  /**
   * Handle file open event
   * @param {Event} event - The file input change event
   */
  function handleFileOpen(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (e) {
      const content = e.target.result;

      // Update filename (without extension)
      const fileName = file.name.replace(/\.(md|markdown)$/i, "");
      const filenameInput = document.getElementById("filename");
      filenameInput.value = fileName;

      // Update editor with file content
      document.dispatchEvent(
        new CustomEvent("updateEditorContent", {
          detail: { content: content },
        })
      );

      // Save to storage
      Storage.saveContent(content);
      Storage.saveFilename(fileName);

      DOMUtils.updateStatus(`Opened file: ${file.name}`);
    };

    reader.onerror = function () {
      DOMUtils.updateStatus("Error reading file");
    };

    reader.readAsText(file);

    // Reset the input to allow opening the same file again
    event.target.value = "";
  }

  /**
   * Handle export button click
   */
  async function handleExport() {
    try {
      // Load JSZip
      if (typeof JSZip === "undefined") {
        DOMUtils.updateStatus("JSZip library not loaded");
        return;
      }

      const zip = new JSZip();
      const editor = document.getElementById("editor");
      const filenameInput = document.getElementById("filename");
      const filename = (filenameInput.value || "notes").trim();

      // Add markdown file to zip
      zip.file(`${filename}.md`, editor.value);

      // Request images from ImageManager
      document.dispatchEvent(
        new CustomEvent("requestImages", {
          detail: {
            callback: (images) => addImagesToZip(zip, images, filename),
          },
        })
      );
    } catch (err) {
      console.error("Export error:", err);
      DOMUtils.updateStatus("Export failed");
    }
  }

  /**
   * Add images to zip file and generate download
   * @param {JSZip} zip - The JSZip instance
   * @param {Object} images - The images object
   * @param {string} filename - The base filename
   */
  async function addImagesToZip(zip, images, filename) {
    try {
      DOMUtils.updateStatus("Adding images to ZIP...");

      // Create images folder in zip
      const imgFolder = zip.folder("images");

      // Process all images
      const imagePromises = [];

      for (const [id, image] of Object.entries(images)) {
        // Skip if no dataUrl
        if (!image.dataUrl) continue;

        // Convert data URL to blob properly by handling the base64 part
        const promise = (async () => {
          try {
            // For data URLs
            if (image.dataUrl.startsWith("data:")) {
              // Extract mime type and base64 data from dataURL
              const matches = image.dataUrl.match(
                /^data:([A-Za-z-+\/]+);base64,(.+)$/
              );

              if (matches && matches.length === 3) {
                const base64Data = matches[2];
                // Add to zip directly as base64 - JSZip handles this well
                imgFolder.file(image.filename, base64Data, { base64: true });
              } else {
                console.error(
                  `Image ${image.filename} has invalid data URL format`
                );
              }
            }
            // For blob URLs or other URLs
            else {
              try {
                const response = await fetch(image.dataUrl);
                const blob = await response.blob();
                imgFolder.file(image.filename, blob, { binary: true });
              } catch (e) {
                console.error(
                  `Failed to fetch image URL for ${image.filename}:`,
                  e
                );
              }
            }
          } catch (e) {
            console.error(`Error processing image ${image.filename}:`, e);
            // Continue with other images even if one fails
          }
        })();

        imagePromises.push(promise);
      }

      // Wait for all image processing to complete
      await Promise.all(imagePromises);

      DOMUtils.updateStatus("Generating ZIP file...");

      // Generate the zip file with proper compression options for binary data
      const content = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      // Create download link
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.zip`;
      document.body.appendChild(a);
      a.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);

      DOMUtils.updateStatus("Export complete");
    } catch (err) {
      console.error("Zip creation error:", err);
      DOMUtils.updateStatus("Export failed");
    }
  }

  // Public API
  return {
    init,
  };
})();
