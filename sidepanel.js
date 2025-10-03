const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const screenshotBtn = document.getElementById('screenshotBtn');
const toggleViewBtn = document.getElementById('toggleView');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const filenameInput = document.getElementById('filename');
const statusText = document.getElementById('statusText');
const editorContainer = document.querySelector('.editor-container');

let images = {}; // Store images with unique IDs
let imageCounter = 0;
let isPreviewMode = false;

// Load saved content
chrome.storage.local.get(['noteContent', 'noteImages', 'filename'], (result) => {
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
});

// Auto-save content
editor.addEventListener('input', () => {
  chrome.storage.local.set({ 
    noteContent: editor.value,
    filename: filenameInput.value 
  });
  updateStatus('Saved');
});

filenameInput.addEventListener('input', () => {
  chrome.storage.local.set({ filename: filenameInput.value });
});

// Screenshot functionality
screenshotBtn.addEventListener('click', async () => {
  try {
    updateStatus('Capturing screenshot...');
    
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Get YouTube timestamp and video element position if on YouTube
    let timestamp = null;
    let videoUrl = tab.url;
    let dataUrl = null;
    
    if (tab.url.includes('youtube.com/watch')) {
      const result = await chrome.tabs.sendMessage(tab.id, { action: 'getTimestampAndCapture' });
      timestamp = result?.timestamp;
      
      if (timestamp) {
        const url = new URL(tab.url);
        url.searchParams.set('t', Math.floor(timestamp) + 's');
        videoUrl = url.toString();
      }
      
      // Use the cropped video screenshot if available
      if (result?.videoScreenshot) {
        dataUrl = result.videoScreenshot;
      }
    }
    
    // Fallback to full page screenshot if not YouTube or cropping failed
    if (!dataUrl) {
      dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    }
    
    // Store image with proper filename
    const imageId = `screenshot_${imageCounter}`;
    const imageName = `${imageId}.png`;
    imageCounter++;
    
    images[imageId] = {
      dataUrl: dataUrl,
      filename: imageName
    };
    chrome.storage.local.set({ noteImages: images });
    
    // Insert markdown with relative path to images folder
    const timestamp_str = timestamp ? formatTimestamp(timestamp) : '';
    const link_text = timestamp ? ` at ${timestamp_str}` : '';
    
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
    
    updateStatus(`Screenshot captured${timestamp ? ' with timestamp' : ''}!`);
  } catch (error) {
    console.error('Screenshot error:', error);
    updateStatus('Error capturing screenshot');
  }
});

// Toggle preview
toggleViewBtn.addEventListener('click', () => {
  isPreviewMode = !isPreviewMode;
  
  if (isPreviewMode) {
    renderPreview();
    editorContainer.classList.add('hidden');
    preview.classList.remove('hidden');
    toggleViewBtn.textContent = '✏️ Edit';
  } else {
    preview.classList.add('hidden');
    editorContainer.classList.remove('hidden');
    toggleViewBtn.textContent = '👁️ Preview';
  }
});

// Render markdown preview
function renderPreview() {
  let html = editor.value;
  
  // Replace image references with actual data URLs for preview
  Object.entries(images).forEach(([imageId, imageData]) => {
    const imageName = imageData.filename;
    html = html.replace(`![Screenshot](images/${imageName})`, `<img src="${imageData.dataUrl}" alt="Screenshot">`);
  });
  
  // Basic markdown to HTML (simplified)
  html = html
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  
  preview.innerHTML = '<p>' + html + '</p>';
}

// Clear notes
clearBtn.addEventListener('click', () => {
  if (confirm('Clear all notes and images? This cannot be undone.')) {
    editor.value = '';
    images = {};
    imageCounter = 0;
    chrome.storage.local.set({ 
      noteContent: '', 
      noteImages: {},
      filename: 'notes'
    });
    filenameInput.value = 'notes';
    updateStatus('Cleared');
  }
});

// Export as ZIP with markdown and images folder
exportBtn.addEventListener('click', async () => {
  try {
    updateStatus('Creating ZIP file...');
    
    const filename = filenameInput.value || 'notes';
    const content = editor.value;
    
    // Import JSZip from CDN
    if (typeof JSZip === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      document.head.appendChild(script);
      
      await new Promise((resolve) => {
        script.onload = resolve;
      });
    }
    
    const zip = new JSZip();
    
    // Add markdown file (content already has relative paths to images/)
    zip.file(`${filename}.md`, content);
    
    // Add images folder
    const imagesFolder = zip.folder('images');
    
    // Add all images to the images folder
    for (const [imageId, imageData] of Object.entries(images)) {
      // Convert base64 data URL to binary
      const imageContent = atob(imageData.dataUrl.split(',')[1]);
      // Convert binary string to Uint8Array
      const imageArray = new Uint8Array(imageContent.length);
      for (let i = 0; i < imageContent.length; i++) {
        imageArray[i] = imageContent.charCodeAt(i);
      }
      imagesFolder.file(imageData.filename, imageArray);
      // Convert base64 data URL to blob
      const base64Data = imageData.dataUrl.split(',')[1];
      imagesFolder.file(imageData.filename, base64Data, { base64: true });
    }
    
    // Generate ZIP file
    updateStatus('Generating ZIP file...');
    const zipBlob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    
    // Download ZIP
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = url;
    a.download = `${filename}.zip`;
    
    try {
      a.click();
      updateStatus(`Exported ${filename}.zip with ${Object.keys(images).length} images`);
    } catch (err) {
      console.error('Download error:', err);
      updateStatus('Error downloading ZIP file');
    } finally {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Export error:', error);
    updateStatus('Error creating ZIP file');
  }
});

// Format timestamp as MM:SS
function formatTimestamp(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Update status message
function updateStatus(message) {
  statusText.textContent = message;
  setTimeout(() => {
    statusText.textContent = 'Ready';
  }, 3000);
}