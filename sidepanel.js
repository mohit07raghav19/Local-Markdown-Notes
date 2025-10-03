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

// --- Snippet palette data (small subset from your vscode snippets file)
const SNIPPETS = [
  { prefix: "/h1", body: "# ${1:Title}", description: "Insert H1 heading" },
  { prefix: "/h2", body: "## ${1:Subtitle}", description: "Insert H2 heading" },
  {
    prefix: "/h3",
    body: "### ${1:Subheading}",
    description: "Insert H3 heading",
  },
  {
    prefix: "/bullet",
    body: "- ${1:item}",
    description: "Insert bullet list item",
  },
  {
    prefix: "/num",
    body: "1. ${1:item}",
    description: "Insert numbered list item",
  },
  {
    prefix: "/code",
    body: "``` ${1:language}\n${2:code}\n```",
    description: "Insert fenced code block",
  },
  {
    prefix: "/image",
    body: "![${1:alt text}](${2:path/to/image})",
    description: "Insert image",
  },
  {
    prefix: "/todo",
    body: "- [ ] ${1:Task}",
    description: "Insert task checkbox",
  },
  {
    prefix: "/table",
    body: "| ${1:Header 1} | ${2:Header 2} | ${3:Header 3} |\n|--------------|--------------|--------------|\n| ${4:Row 1 Col 1} | ${5:Row 1 Col 2} | ${6:Row 1 Col 3} |",
    description: "Insert table",
  },
];

// Palette DOM
const slashPalette = document.getElementById("slashPalette");
let paletteVisible = false;
let paletteItems = [];
let paletteIndex = -1;

function showPalette(filter) {
  if (!slashPalette) return;
  const q = (filter || "").toLowerCase();
  paletteItems = SNIPPETS.filter(
    (s) =>
      s.prefix.toLowerCase().startsWith(q) ||
      s.description.toLowerCase().indexOf(q) !== -1
  );
  if (paletteItems.length === 0) {
    hidePalette();
    return;
  }
  slashPalette.innerHTML = "";
  paletteItems.forEach((it, idx) => {
    const el = document.createElement("div");
    el.className = "slash-item";
    el.setAttribute("role", "option");
    el.dataset.index = String(idx);
    el.innerHTML = `<strong>${it.prefix}</strong> <span style="color:#9a9a9a; margin-left:8px">${it.description}</span>`;
    el.addEventListener("click", () => {
      applySnippet(it);
      hidePalette();
      editor.focus();
    });
    slashPalette.appendChild(el);
  });
  paletteIndex = 0;
  highlightPalette();
  slashPalette.classList.remove("hidden");
  slashPalette.setAttribute("aria-hidden", "false");
  paletteVisible = true;
}

function hidePalette() {
  if (!slashPalette) return;
  slashPalette.classList.add("hidden");
  slashPalette.setAttribute("aria-hidden", "true");
  slashPalette.innerHTML = "";
  paletteVisible = false;
  paletteIndex = -1;
}

function highlightPalette() {
  if (!slashPalette) return;
  const nodes = slashPalette.querySelectorAll(".slash-item");
  nodes.forEach(
    (n, i) =>
      (n.style.background = i === paletteIndex ? "rgba(255,255,255,0.04)" : "")
  );
}

function applySnippet(snippet) {
  // replace the last slash trigger in editor with the snippet body
  const cursor = editor.selectionStart || 0;
  const before = editor.value.substring(0, cursor);
  // find last slash token start
  const m = before.match(/(\/[^\s]*)$/);
  let replaceStart = cursor;
  if (m) replaceStart = cursor - m[0].length;
  const after = editor.value.substring(editor.selectionEnd || cursor);

  // Process placeholders like ${1:default}
  const body = snippet.body;
  const placeholderRegex = /\$\{(\d+):?([^}]*)\}/g;
  let out = "";
  let lastIndex = 0;
  const placeholders = []; // {num, start, end}
  let match;
  while ((match = placeholderRegex.exec(body)) !== null) {
    const idx = match.index;
    const num = parseInt(match[1], 10);
    const text = match[2] || "";
    out += body.slice(lastIndex, idx) + text;
    const startPos = out.length - text.length;
    const endPos = out.length;
    placeholders.push({ num, start: startPos, end: endPos });
    lastIndex = idx + match[0].length;
  }
  out += body.slice(lastIndex);

  // Insert the processed snippet
  editor.value = editor.value.substring(0, replaceStart) + out + after;

  // Focus and select first placeholder (num=1) if present, else place caret at end
  const first = placeholders.find((p) => p.num === 1) || placeholders[0];
  if (first) {
    const selStart = replaceStart + first.start;
    const selEnd = replaceStart + first.end;
    editor.focus();
    editor.selectionStart = selStart;
    editor.selectionEnd = selEnd;
  } else {
    const newPos = replaceStart + out.length;
    editor.focus();
    editor.selectionStart = editor.selectionEnd = newPos;
  }
  chrome.storage.local.set({ noteContent: editor.value });
}

// Continue lists on Enter: bullets, numbered lists, and todos
editor.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  // If palette is visible, let that handler manage Enter
  if (paletteVisible) return;
  try {
    const val = editor.value;
    const selStart = editor.selectionStart;
    // find current line boundaries
    const lineStart = val.lastIndexOf("\n", selStart - 1) + 1;
    let lineEnd = val.indexOf("\n", selStart);
    if (lineEnd === -1) lineEnd = val.length;
    const fullLine = val.slice(lineStart, lineEnd);

    // Matches
    const ordered = fullLine.match(/^(\s*)(\d+)\.\s+/);
    const checkbox = fullLine.match(/^(\s*[-+*]\s+\[[ xX]\]\s+)/);
    const unordered = fullLine.match(/^(\s*[-+*]\s+)/);

    if (ordered || checkbox || unordered) {
      e.preventDefault();
      // If the line contains only the marker (nothing after it), break the list
      const marker =
        (ordered && ordered[0]) ||
        (checkbox && checkbox[1]) ||
        (unordered && unordered[0]);
      const afterMarker = fullLine.slice(marker.length).trim();
      if (afterMarker.length === 0) {
        // remove the marker from this line and insert a newline (end list)
        const beforeLine = val.slice(0, lineStart);
        const afterLine = val.slice(lineEnd);
        // create a single newline (move to next empty line)
        editor.value = beforeLine + "\n" + afterLine;
        const newPos = beforeLine.length + 1;
        editor.selectionStart = editor.selectionEnd = newPos;
        chrome.storage.local.set({ noteContent: editor.value });
        return;
      }

      // Otherwise, continue the list
      let insert = "\n";
      if (ordered) {
        const indent = ordered[1] || "";
        const num = parseInt(ordered[2], 10);
        const next = num + 1;
        insert += `${indent}${next}. `;
      } else if (checkbox) {
        insert += checkbox[1];
      } else if (unordered) {
        insert += unordered[1];
      }

      // Insert and set caret
      const before = val.slice(0, selStart);
      const after = val.slice(editor.selectionEnd || selStart);
      editor.value = before + insert + after;
      const newCaret = before.length + insert.length;
      editor.selectionStart = editor.selectionEnd = newCaret;
      chrome.storage.local.set({ noteContent: editor.value });
    }
  } catch (err) {
    console.error("list continuation error", err);
  }
});

// editor key handling for slash palette
editor.addEventListener("input", (e) => {
  try {
    const cursor = editor.selectionStart || 0;
    const before = editor.value.substring(0, cursor);
    const m = before.match(/(\/[\w-]*)$/);
    if (m) {
      showPalette(m[0]);
    } else if (paletteVisible) hidePalette();
  } catch (err) {
    console.error(err);
  }
});

editor.addEventListener("keydown", (e) => {
  if (!paletteVisible) return;
  const nodes = slashPalette.querySelectorAll(".slash-item");
  if (e.key === "ArrowDown") {
    e.preventDefault();
    paletteIndex = Math.min(paletteIndex + 1, nodes.length - 1);
    highlightPalette();
    nodes[paletteIndex].scrollIntoView({ block: "nearest" });
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    paletteIndex = Math.max(paletteIndex - 1, 0);
    highlightPalette();
    nodes[paletteIndex].scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (paletteItems[paletteIndex]) {
      applySnippet(paletteItems[paletteIndex]);
      hidePalette();
    }
  } else if (e.key === "Escape") {
    e.preventDefault();
    hidePalette();
  }
});

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
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^\s*[-+*] (.+)/gm, "<ul><li>$1</li></ul>") // Unordered list
    .replace(/^\d+\.\s+(.+)/gm, "<ol><li>$1</li></ol>"); // Ordered list

  // Merge consecutive <ul> or <ol> tags
  html = html.replace(/<\/ul>\s*<ul>/g, "").replace(/<\/ol>\s*<ol>/g, "");
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
