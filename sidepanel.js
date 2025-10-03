const editor = document.getElementById("editor");
const preview = document.getElementById("preview");
const screenshotBtn = document.getElementById("screenshotBtn");
const toggleViewBtn = document.getElementById("toggleView");
const clearBtn = document.getElementById("clearBtn");
const exportBtn = document.getElementById("exportBtn");
const filenameInput = document.getElementById("filename");
const statusText = document.getElementById("statusText");
const editorContainer = document.querySelector(".editor-container");

let images = {}; // Store images with unique IDs
let imageCounter = 0;
let isPreviewMode = false;

// Load saved content
chrome.storage.local.get(
  ["noteContent", "noteImages", "filename"],
  (result) => {
    if (result.noteContent) {
      editor.value = result.noteContent;
    }
    if (result.noteImages) {
      images = result.noteImages;
      imageCounter = Object.keys(images).length;
    }
    if (result.filename) {
      filenameInput.value = result.filename;
    }
  }
);

// Auto-save content
editor.addEventListener("input", () => {
  chrome.storage.local.set({
    noteContent: editor.value,
    filename: filenameInput.value,
  });
  updateStatus("Saved");
});

filenameInput.addEventListener("input", () => {
  chrome.storage.local.set({ filename: filenameInput.value });
});

// Screenshot functionality - extracted to reusable function so shortcuts can call it
async function captureScreenshot() {
  try {
    updateStatus("Capturing screenshot...");
    console.debug("captureScreenshot: start");

    // Get active tab (wrap callback API to be safe)
    const tabs = await new Promise((resolve, reject) => {
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(tabs);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
    const tab = tabs && tabs.length ? tabs[0] : null;
    if (!tab) throw new Error("No active tab found");

    // Get YouTube timestamp and video element position if on YouTube
    let timestamp = null;
    let videoUrl = tab.url;
    let dataUrl = null;

    if (tab.url && tab.url.includes("youtube.com/watch")) {
      // Wrap sendMessage in a promise and tolerate failures (content script may not be injected)
      const result = await new Promise((resolve) => {
        try {
          chrome.tabs.sendMessage(
            tab.id,
            { action: "getTimestampAndCapture" },
            (resp) => {
              if (chrome.runtime.lastError) {
                console.warn(
                  "sendMessage warning:",
                  chrome.runtime.lastError.message
                );
                resolve(null);
              } else {
                resolve(resp);
              }
            }
          );
        } catch (err) {
          console.warn("sendMessage exception:", err);
          resolve(null);
        }
      });
      timestamp = result?.timestamp;

      if (timestamp) {
        const url = new URL(tab.url);
        url.searchParams.set("t", Math.floor(timestamp) + "s");
        videoUrl = url.toString();
      }

      // Use the cropped video screenshot if available
      if (result?.videoScreenshot) {
        dataUrl = result.videoScreenshot;
      }
    }

    // Fallback to full page screenshot if not YouTube or cropping failed
    if (!dataUrl) {
      // captureVisibleTab uses a callback-style API; wrap it
      dataUrl = await new Promise((resolve, reject) => {
        try {
          chrome.tabs.captureVisibleTab(null, { format: "png" }, (img) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(img);
            }
          });
        } catch (err) {
          reject(err);
        }
      });
    }

    // Store image with proper filename
    const imageId = `screenshot_${imageCounter}`;
    const imageName = `${imageId}.png`;
    imageCounter++;

    images[imageId] = {
      dataUrl: dataUrl,
      filename: imageName,
    };
    chrome.storage.local.set({ noteImages: images });

    // Insert markdown with relative path to images folder
    const timestamp_str = timestamp ? formatTimestamp(timestamp) : "";
    const link_text = timestamp ? ` at ${timestamp_str}` : "";

    let markdown = `\n\n![Screenshot](images/${imageName})`;
    if (videoUrl) {
      markdown += `\n**Source:** [${tab.title}${link_text}](${videoUrl})`;
    }
    markdown += `\n\n`;

    // Insert at cursor position
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const text = editor.value;
    editor.value = text.substring(0, start) + markdown + text.substring(end);
    editor.focus();
    editor.selectionStart = editor.selectionEnd = start + markdown.length;

    // Save
    chrome.storage.local.set({ noteContent: editor.value });

    updateStatus(`Screenshot captured${timestamp ? " with timestamp" : ""}!`);
  } catch (error) {
    console.error("Screenshot error:", error);
    updateStatus("Error capturing screenshot");
  }
}

// Hook screenshot button to the function
screenshotBtn.addEventListener("click", captureScreenshot);

// Keyboard shortcut: Option(Alt) + O triggers screenshot
document.addEventListener("keydown", (e) => {
  // Avoid triggering while modifier keys other than Alt are used with text fields like input combos
  const isMacOption = e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
  if (isMacOption && e.key && e.key.toLowerCase() === "o") {
    // Prevent default so Option+O doesn't type special char in editor
    e.preventDefault();
    captureScreenshot();
  }
});

// Paste handler: if clipboard contains image(s), store them and insert markdown references
editor.addEventListener("paste", (event) => {
  try {
    const items = (event.clipboardData || window.clipboardData).items;
    if (!items) return;

    const imageItems = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && item.type && item.type.indexOf("image") !== -1) {
        imageItems.push(item);
      }
    }

    if (imageItems.length === 0) return; // let default paste happen for non-image content

    // Prevent default paste of image as unsupported text
    event.preventDefault();

    // Process each image in clipboard
    for (let i = 0; i < imageItems.length; i++) {
      const item = imageItems[i];
      const file = item.getAsFile();
      if (!file) continue;

      const reader = new FileReader();
      reader.onload = function (e) {
        const dataUrl = e.target.result;

        // Store image
        const imageId = `pasted_${imageCounter}`;
        const imageName = `${imageId}.png`;
        imageCounter++;
        images[imageId] = {
          dataUrl: dataUrl,
          filename: imageName,
        };
        chrome.storage.local.set({ noteImages: images });

        // Insert markdown at cursor
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const text = editor.value;
        const markdown = `\n\n![Pasted Image](images/${imageName})\n\n`;
        editor.value =
          text.substring(0, start) + markdown + text.substring(end);
        editor.focus();
        editor.selectionStart = editor.selectionEnd = start + markdown.length;
        chrome.storage.local.set({ noteContent: editor.value });
        updateStatus("Pasted image saved to notes");
      };
      reader.readAsDataURL(file);
    }
  } catch (err) {
    console.error("Paste handler error:", err);
  }
});

// Handle screenshots sent from background (keyboard command)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "commandScreenshot") {
    try {
      const dataUrl = request.dataUrl;
      if (!dataUrl) return;

      const imageId = `cmd_${imageCounter}`;
      const imageName = `${imageId}.png`;
      imageCounter++;
      images[imageId] = { dataUrl: dataUrl, filename: imageName };
      chrome.storage.local.set({ noteImages: images });

      // Insert markdown with optional timestamp/url info
      let markdown = `\n\n![Screenshot](images/${imageName})`;
      if (request.timestamp) {
        const ts = formatTimestamp(request.timestamp);
        const urlObj = new URL(request.url);
        urlObj.searchParams.set("t", Math.floor(request.timestamp) + "s");
        markdown += `\n**Source:** [${
          request.title
        } at ${ts}](${urlObj.toString()})`;
      } else if (request.url) {
        markdown += `\n**Source:** [${request.title}](${request.url})`;
      }
      markdown += `\n\n`;

      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      const text = editor.value;
      editor.value = text.substring(0, start) + markdown + text.substring(end);
      editor.focus();
      editor.selectionStart = editor.selectionEnd = start + markdown.length;
      chrome.storage.local.set({ noteContent: editor.value });
      updateStatus("Screenshot inserted (keyboard)");
    } catch (err) {
      console.error("commandScreenshot handler error:", err);
    }
  }
});

// Toggle preview
toggleViewBtn.addEventListener("click", () => {
  isPreviewMode = !isPreviewMode;

  if (isPreviewMode) {
    renderPreview();
    editorContainer.classList.add("hidden");
    preview.classList.remove("hidden");
    toggleViewBtn.textContent = "✏️ Edit";
  } else {
    preview.classList.add("hidden");
    editorContainer.classList.remove("hidden");
    toggleViewBtn.textContent = "👁️ Preview";
  }
});

// Render markdown preview
function renderPreview() {
  let html = editor.value;
  // Replace image references with actual data URLs for preview (handle alt text and multiple occurrences)
  Object.entries(images).forEach(([imageId, imageData]) => {
    const imageName = imageData.filename.replace(
      /[-\\^$*+?.()|[\]{}]/g,
      "\\$&"
    );
    const imgRegex = new RegExp(
      "!\\[([^]]*)\\]\\(images/" + imageName + "\\)",
      "g"
    );
    html = html.replace(imgRegex, (_match, alt) => {
      const safeAlt = alt || "Screenshot";
      return `<img src="${imageData.dataUrl}" alt="${safeAlt}">`;
    });
  });

  // Basic markdown to HTML (simplified)
  // Very small markdown -> HTML transformations
  html = html
    .replace(/^### (.*$)/gm, "<h3>$1</h3>")
    .replace(/^## (.*$)/gm, "<h2>$1</h2>")
    .replace(/^# (.*$)/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(
      /\[(.+?)\]\((.+?)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    )
    .replace(/`(.+?)`/g, "<code>$1</code>");

  // Paragraph handling: split on empty lines
  const paragraphs = html.split(/\n\s*\n/).map((p) => p.replace(/\n/g, "<br>"));
  preview.innerHTML = paragraphs.map((p) => `<p>${p}</p>`).join("");
}

// Clear notes
clearBtn.addEventListener("click", () => {
  if (confirm("Clear all notes and images? This cannot be undone.")) {
    editor.value = "";
    images = {};
    imageCounter = 0;
    chrome.storage.local.set({
      noteContent: "",
      noteImages: {},
      filename: "notes",
    });
    filenameInput.value = "notes";
    updateStatus("Cleared");
  }
});

// Export as ZIP with markdown and images folder
exportBtn.addEventListener("click", async () => {
  try {
    updateStatus("Creating ZIP file...");

    const filename = filenameInput.value || "notes";
    const content = editor.value;

    // JSZip is provided locally via lib/jszip.min.js
    if (typeof JSZip === "undefined") throw new Error("JSZip is not available");
    const zip = new JSZip();

    // Add markdown file (content already has relative paths to images/)
    zip.file(`${filename}.md`, content);

    // Add images folder
    const imagesFolder = zip.folder("images");

    // Add all images to the images folder (use base64 to avoid binary conversions)
    for (const [imageId, imageData] of Object.entries(images)) {
      if (!imageData?.dataUrl) continue;
      const parts = imageData.dataUrl.split(",");
      const base64Data = parts.length > 1 ? parts[1] : parts[0];
      imagesFolder.file(imageData.filename, base64Data, { base64: true });
    }

    // Generate ZIP file
    updateStatus("Generating ZIP file...");
    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    // Download ZIP
    const url = URL.createObjectURL(zipBlob);
    try {
      if (chrome && chrome.downloads && chrome.downloads.download) {
        // Use the downloads API when available (requires permission in manifest)
        chrome.downloads.download(
          { url: url, filename: `${filename}.zip`, saveAs: true },
          (downloadId) => {
            if (chrome.runtime.lastError) {
              console.error(
                "chrome.downloads.download error:",
                chrome.runtime.lastError
              );
              // Fallback to anchor
              const a = document.createElement("a");
              document.body.appendChild(a);
              a.style.display = "none";
              a.href = url;
              a.download = `${filename}.zip`;
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              updateStatus(
                `Exported ${filename}.zip with ${
                  Object.keys(images).length
                } images (fallback)`
              );
              return;
            }
            updateStatus(`Export started: ${filename}.zip`);
            // Revoke object URL after a delay to allow download to start
            setTimeout(() => URL.revokeObjectURL(url), 2000);
          }
        );
      } else {
        const a = document.createElement("a");
        document.body.appendChild(a);
        a.style.display = "none";
        a.href = url;
        a.download = `${filename}.zip`;
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        updateStatus(
          `Exported ${filename}.zip with ${Object.keys(images).length} images`
        );
      }
    } catch (err) {
      console.error("Download error:", err);
      updateStatus("Error downloading ZIP file");
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error("Export error:", error);
    updateStatus("Error creating ZIP file");
  }
});

// Format timestamp as MM:SS
function formatTimestamp(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Update status message
function updateStatus(message) {
  statusText.textContent = message;
  setTimeout(() => {
    statusText.textContent = "Ready";
  }, 3000);
}
