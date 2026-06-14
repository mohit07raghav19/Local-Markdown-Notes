# Local Markdown Notes

![Version](https://img.shields.io/badge/version-1.0-blue.svg)
![Manifest V3](https://img.shields.io/badge/manifest-v3-orange.svg)
![Privacy](https://img.shields.io/badge/privacy-focused-green.svg)
![Offline](https://img.shields.io/badge/offline--first-yes-orange.svg)
![AI-Assisted](https://img.shields.io/badge/ai--assisted-yes-blueviolet.svg)

A lightweight browser extension for taking markdown notes with screenshots and YouTube timestamps—all stored locally on your device. Perfect for privacy-conscious learners and researchers.

**Supported Browsers**: Chrome, Brave, Edge, and other Chromium-based browsers with sidebar support.

## ✨ Features

- **📝 Markdown Editor** – Edit markdown with live preview
- **📸 Screenshot Capture** – One-click screenshots with `Alt+O` shortcut
- **🎥 YouTube Timestamps** – Auto-capture video time when taking screenshots
- **💾 Private & Local** – All notes stored locally on your device, no cloud sync
- **🖼️ Image Management** – Drag-and-drop image support
- **📥 Export Notes** – Export as ZIP with embedded images
- **🎨 Dark/Light Theme** – Adapts to your system preferences
- **⚡ Works Offline** – Full functionality without internet connection

## 🚀 Quick Start

### 📦 Installation Options

#### Option 1: ZIP Download (Easiest for Users)

1. Download the latest **`local-markdown-notes.zip`** from the [Releases](../../releases) page.
2. **Extract** the ZIP file to a convenient location on your device.
3. Open your browser and navigate to **`chrome://extensions/`**.
4. Enable **"Developer mode"** in the top right corner.
5. Click **"Load unpacked"** and select the extracted folder.

#### Option 2: Clone for Developers

1. **Clone** this repository to your local machine.
2. Follow steps 3-5 from Option 1, selecting the repository folder.

### ⚙️ Final Setup

Go to **`chrome://extensions/shortcuts`** to set your preferred screenshot shortcut (default: `Alt+O`).

## 📖 How to Use

1. **Open the panel** – Click the extension icon in your toolbar
2. **Write notes** – Use the markdown editor on the left
3. **Take screenshots** – Press `Alt+O` (or your custom shortcut)
   - **YouTube videos**: Auto-captures the current timestamp
   - **Any webpage**: Capture the full page or a specific region
4. **Organize images** – Manage your captured images in the sidebar
5. **Export & backup** – Click the export button to download your notes as a ZIP file

## 🏗️ Project Structure

```
├── manifest.json          # Extension configuration
├── background.js          # Service worker handling shortcuts
├── content.js             # Page interaction for timestamps
├── sidepanel.html         # Main user interface
├── js/
│   ├── app.js            # App entry point
│   ├── modules/          # Feature modules (editor, storage, etc.)
│   └── utils/            # Utility functions
├── css/
│   └── styles.css        # Styling & themes
└── lib/
    └── jszip.min.js      # ZIP export functionality
```

## 💡 Key Highlights

- **Modular Architecture**: Clean separation of concerns for easy maintenance
- **Zero External Dependencies**: No tracking, analytics, or cloud sync
- **Manifest V3**: Modern, secure extension format
- **Cross-Browser Support**: Works on Chrome, Brave, Edge, and similar browsers

## 📄 License

MIT License - Feel free to fork, modify, and share

---

Built with ❤️ for privacy-conscious note-takers
