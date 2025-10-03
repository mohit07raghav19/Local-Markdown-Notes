const editor = document.getElementById("editor");
const preview = document.getElementById("preview");
const screenshotBtn = document.getElementById("screenshotBtn");
const toggleViewBtn = document.getElementById("toggleView");
const clearBtn = document.getElementById("clearBtn");
const exportBtn = document.getElementById("exportBtn");
const filenameInput = document.getElementById("filename");
const statusText = document.getElementById("statusText");
const editorContainer = document.querySelector(".editor-container");

let images = {};
let imageCounter = 0;
let isPreviewMode = false;

// --- Storage load ---
function loadState() {
  chrome.storage.local.get(
    ["noteContent", "noteImages", "filename"],
    (result) => {
      if (result.noteContent) editor.value = result.noteContent;
      if (result.noteImages) {
        images = result.noteImages;
        imageCounter = Object.keys(images).length;
      }
      if (result.filename) filenameInput.value = result.filename;
      renderImageList();
    }
  );
}
loadState();

// Auto-save
editor.addEventListener("input", () => {
  chrome.storage.local.set({
    noteContent: editor.value,
    filename: filenameInput.value,
  });
  updateStatus("Saved");
});
filenameInput.addEventListener("input", () =>
  chrome.storage.local.set({ filename: filenameInput.value })
);

// --- Screenshot logic ---
async function captureScreenshot() {
  try {
    updateStatus("Capturing screenshot...");
    // get active tab
    const tabs = await new Promise((res, rej) => {
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, (t) => {
          if (chrome.runtime.lastError) rej(chrome.runtime.lastError);
          else res(t);
        });
      } catch (e) {
        rej(e);
      }
    });
    const tab = tabs && tabs[0];
    if (!tab) throw new Error("No active tab");

    let dataUrl = null;
    let timestamp = null;
    let videoUrl = tab.url;

    // Try content script capture (YouTube video element)
    if (tab.url && tab.url.includes("youtube.com/watch")) {
      const trySend = () =>
        new Promise((resolve) => {
          try {
            chrome.tabs.sendMessage(
              tab.id,
              { action: "getTimestampAndCapture" },
              (resp) => {
                if (chrome.runtime.lastError)
                  resolve({ error: chrome.runtime.lastError });
                else resolve({ resp });
              }
            );
          } catch (err) {
            resolve({ error: err });
          }
        });

      let out = await trySend();
      if (out && out.error) {
        // inject content script then retry
        if (chrome.scripting && chrome.scripting.executeScript) {
          try {
            await new Promise((res, rej) => {
              chrome.scripting.executeScript(
                { target: { tabId: tab.id }, files: ["content.js"] },
                () => {
                  if (chrome.runtime.lastError) rej(chrome.runtime.lastError);
                  else res();
                }
              );
            });
            out = await trySend();
          } catch (e) {
            console.warn("inject failed", e);
            out = { error: e };
          }
        }
      }

      if (out && out.resp && out.resp.videoScreenshot) {
        dataUrl = out.resp.videoScreenshot;
        timestamp = out.resp.timestamp;
        if (timestamp) {
          const u = new URL(tab.url);
          u.searchParams.set("t", Math.floor(timestamp) + "s");
          videoUrl = u.toString();
        }
      }
    }

    // fallback to full-tab capture
    if (!dataUrl) {
      dataUrl = await new Promise((res, rej) => {
        try {
          chrome.tabs.captureVisibleTab(null, { format: "png" }, (img) => {
            if (chrome.runtime.lastError) rej(chrome.runtime.lastError);
            else res(img);
          });
        } catch (e) {
          rej(e);
        }
      });
    }

    // save image
    const imageId = `screenshot_${imageCounter}`;
    const imageName = `${imageId}.png`;
    imageCounter++;
    images[imageId] = { dataUrl, filename: imageName };
    chrome.storage.local.set({ noteImages: images }, () => renderImageList());

    // insert markdown
    const tsStr = timestamp ? formatTimestamp(timestamp) : "";
    const link_text = timestamp ? ` at ${tsStr}` : "";
    let markdown = `\n\n![Screenshot](images/${imageName})`;
    if (videoUrl)
      markdown += `\n**Source:** [${tab.title}${link_text}](${videoUrl})`;
    markdown += `\n\n`;
    const start = editor.selectionStart,
      end = editor.selectionEnd,
      text = editor.value;
    editor.value = text.substring(0, start) + markdown + text.substring(end);
    editor.focus();
    editor.selectionStart = editor.selectionEnd = start + markdown.length;
    chrome.storage.local.set({ noteContent: editor.value });
    updateStatus(`Screenshot captured${timestamp ? " with timestamp" : ""}!`);
  } catch (err) {
    console.error("captureScreenshot error", err);
    updateStatus("Error capturing screenshot");
  }
}

// hook screenshot button
screenshotBtn && screenshotBtn.addEventListener("click", captureScreenshot);

// keyboard shortcut (Alt/Option+O and Ctrl+Alt+O)
document.addEventListener("keydown", (e) => {
  const isAltOnly = e.altKey && !e.ctrlKey && !e.metaKey;
  const isCtrlAlt = e.ctrlKey && e.altKey && !e.metaKey;
  if ((isAltOnly || isCtrlAlt) && e.key && e.key.toLowerCase() === "o") {
    e.preventDefault();
    captureScreenshot();
  }
});

// --- Paste images ---
editor.addEventListener("paste", (event) => {
  try {
    const items = (event.clipboardData || window.clipboardData).items;
    if (!items) return;
    const imageItems = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it && it.type && it.type.indexOf("image") !== -1) imageItems.push(it);
    }
    if (imageItems.length === 0) return;
    event.preventDefault();
    imageItems.forEach((it) => {
      const file = it.getAsFile();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        const imageId = `pasted_${imageCounter}`;
        const imageName = `${imageId}.png`;
        imageCounter++;
        images[imageId] = { dataUrl, filename: imageName };
        chrome.storage.local.set({ noteImages: images }, () =>
          renderImageList()
        );
        const start = editor.selectionStart,
          end = editor.selectionEnd,
          text = editor.value;
        const markdown = `\n\n![Pasted Image](images/${imageName})\n\n`;
        editor.value =
          text.substring(0, start) + markdown + text.substring(end);
        editor.focus();
        editor.selectionStart = editor.selectionEnd = start + markdown.length;
        chrome.storage.local.set({ noteContent: editor.value });
        updateStatus("Pasted image saved to notes");
      };
      reader.readAsDataURL(file);
    });
  } catch (e) {
    console.error("paste error", e);
  }
});

// --- Images list rendering (small expandable and general list) ---
function renderImageList() {
  // update expandable list if present
  const expList = document.getElementById("imagesExpandableList");
  const headerCount = document.getElementById("imagesCountHeader");
  const headerCountExp = document.getElementById("imagesCountExpandable");
  const countVal = String(Object.keys(images).length);
  if (headerCount) headerCount.textContent = countVal;
  if (headerCountExp) headerCountExp.textContent = countVal;
  if (expList) {
    expList.innerHTML = "";
    Object.entries(images).forEach(([id, img]) => {
      const item = document.createElement("div");
      item.className = "images-expand-item";
      const thumb = document.createElement("img");
      thumb.src = img.dataUrl;
      thumb.alt = img.filename || id;
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = img.filename || id;
      const actions = document.createElement("div");
      actions.className = "actions";
      // Insert (+)
      const insertBtn = document.createElement("button");
      insertBtn.title = "Insert image";
      insertBtn.setAttribute("aria-label", "Insert image");
      insertBtn.innerHTML =
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14M5 12h14" stroke="#0c0c0cff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      insertBtn.addEventListener("click", () =>
        insertImageMarkdownAtCursor(img.filename || id, img.dataUrl)
      );
      // Delete (trash)
      const delBtn = document.createElement("button");
      delBtn.title = "Delete image";
      delBtn.setAttribute("aria-label", "Delete image");
      delBtn.innerHTML =
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18" stroke="#000000ff" stroke-width="1.2" stroke-linecap="round"/><path d="M8 6V4h8v2" stroke="#050505ff" stroke-width="1.2" stroke-linecap="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="#000000ff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      delBtn.addEventListener("click", () => {
        delete images[id];
        chrome.storage.local.set({ noteImages: images }, () => {
          renderImageList();
          updateStatus("Image removed");
        });
      });
      actions.appendChild(insertBtn);
      actions.appendChild(delBtn);
      item.appendChild(thumb);
      item.appendChild(meta);
      item.appendChild(actions);
      expList.appendChild(item);
    });
  }
}

function insertImageMarkdownAtCursor(filename, dataUrl) {
  const mdName = "images/" + filename;
  const md = `![${filename}](${mdName})`;
  const start = editor.selectionStart || 0,
    end = editor.selectionEnd || 0;
  const before = editor.value.slice(0, start),
    after = editor.value.slice(end);
  editor.value = before + md + "\n" + after;
  editor.focus();
  editor.selectionStart = editor.selectionEnd = before.length + md.length + 1;
  // ensure stored
  let found = false;
  for (const k in images)
    if ((images[k].filename || k) === filename) {
      found = true;
      break;
    }
  if (!found) {
    images[filename] = { filename, dataUrl };
    chrome.storage.local.set({ noteImages: images }, () => renderImageList());
  }
  chrome.storage.local.set({ noteContent: editor.value, noteImages: images });
  updateStatus("Inserted image link");
}

// images expandable toggle (moved control below status)
const imagesToggleBtn = document.getElementById("imagesToggleBtn");
const imagesExpandable = document.getElementById("imagesExpandable");
if (imagesToggleBtn)
  imagesToggleBtn.addEventListener("click", () => {
    if (!imagesExpandable) return;
    const isHidden = imagesExpandable.classList.contains("hidden");
    if (isHidden) {
      renderImageList();
      imagesExpandable.classList.remove("hidden");
      imagesToggleBtn.setAttribute("aria-expanded", "true");
      imagesToggleBtn.textContent = "Hide ▴";
    } else {
      imagesExpandable.classList.add("hidden");
      imagesToggleBtn.setAttribute("aria-expanded", "false");
      imagesToggleBtn.textContent = "Show ▾";
    }
  });

// --- Background command messages (keyboard capture) ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "commandScreenshot") {
    try {
      const dataUrl = request.dataUrl;
      if (!dataUrl) return;
      const imageId = `cmd_${imageCounter}`;
      const imageName = `${imageId}.png`;
      imageCounter++;
      images[imageId] = { dataUrl, filename: imageName };
      chrome.storage.local.set({ noteImages: images }, () => renderImageList());
      let markdown = `\n\n![Screenshot](images/${imageName})`;
      if (request.timestamp) {
        const ts = formatTimestamp(request.timestamp);
        const u = new URL(request.url);
        u.searchParams.set("t", Math.floor(request.timestamp) + "s");
        markdown += `\n**Source:** [${
          request.title
        } at ${ts}](${u.toString()})`;
      } else if (request.url)
        markdown += `\n**Source:** [${request.title}](${request.url})`;
      markdown += "\n\n";
      const start = editor.selectionStart || 0,
        end = editor.selectionEnd || 0,
        txt = editor.value;
      editor.value = txt.substring(0, start) + markdown + txt.substring(end);
      editor.focus();
      editor.selectionStart = editor.selectionEnd = start + markdown.length;
      chrome.storage.local.set({ noteContent: editor.value });
      updateStatus("Screenshot inserted (keyboard)");
    } catch (e) {
      console.error(e);
    }
  }
});

// --- Toggle preview ---
toggleViewBtn &&
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

// --- renderPreview (simple markdown) ---
function renderPreview() {
  let html = editor.value || "";
  Object.entries(images).forEach(([imageId, imageData]) => {
    const imageName = (imageData.filename || "").replace(
      /[-\\^$*+?.()|[\]{}]/g,
      "\\$&"
    );
    const imgRegex = new RegExp(
      "!\\[([^]]*)\\]\\(images/" + imageName + "\\)",
      "g"
    );
    html = html.replace(
      imgRegex,
      (_m, alt) =>
        `<img src="${imageData.dataUrl}" alt="${alt || "Screenshot"}">`
    );
  });
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
  const paragraphs = html.split(/\n\s*\n/).map((p) => p.replace(/\n/g, "<br>"));
  preview.innerHTML = paragraphs.map((p) => `<p>${p}</p>`).join("");
}

// --- Clear notes ---
clearBtn &&
  clearBtn.addEventListener("click", () => {
    if (!confirm("Clear all notes and images? This cannot be undone.")) return;
    editor.value = "";
    images = {};
    imageCounter = 0;
    chrome.storage.local.set({
      noteContent: "",
      noteImages: {},
      filename: "notes",
    });
    filenameInput.value = "notes";
    renderImageList();
    updateStatus("Cleared");
  });

// --- Export ZIP ---
exportBtn &&
  exportBtn.addEventListener("click", async () => {
    try {
      updateStatus("Creating ZIP file...");
      const filename = filenameInput.value || "notes";
      const content = editor.value || "";
      if (typeof JSZip === "undefined")
        throw new Error("JSZip is not available");
      const zip = new JSZip();
      zip.file(`${filename}.md`, content);
      const imagesFolder = zip.folder("images");

      function dataURLtoUint8Array(dataURL) {
        const parts = dataURL.split(",");
        if (parts.length < 2) throw new Error("Invalid dataURL");
        const b64 = parts[1];
        const bin = atob(b64);
        const len = bin.length;
        const arr = new Uint8Array(len);
        for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
        return arr;
      }

      for (const [id, img] of Object.entries(images)) {
        if (!img || !img.dataUrl) continue;
        try {
          const bytes = dataURLtoUint8Array(img.dataUrl);
          imagesFolder.file(img.filename, bytes);
        } catch (err) {
          console.warn("Skipping bad image", img && img.filename, err);
        }
      }

      updateStatus("Generating ZIP file...");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);

      if (chrome && chrome.downloads && chrome.downloads.download) {
        chrome.downloads.download(
          { url, filename: `${filename}.zip`, saveAs: true },
          (id) => {
            if (chrome.runtime.lastError) {
              console.error("download API error", chrome.runtime.lastError);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${filename}.zip`;
              a.click();
              URL.revokeObjectURL(url);
              updateStatus("Exported (fallback)");
            } else {
              updateStatus("Export started");
              setTimeout(() => URL.revokeObjectURL(url), 2000);
            }
          }
        );
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        updateStatus("Exported");
      }
    } catch (err) {
      console.error("Export error", err);
      updateStatus("Error creating ZIP file");
    }
  });

// --- Utils ---
function formatTimestamp(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
function updateStatus(message) {
  if (statusText) statusText.textContent = message;
  setTimeout(() => {
    if (statusText) statusText.textContent = "Ready";
  }, 3000);
}
