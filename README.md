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

1. **Clone or download** this repository
2. Open **`chrome://extensions/`** in your browser
3. Enable **"Developer mode"** (top right corner)
4. Click **"Load unpacked"** and select this folder
5. Go to **`chrome://extensions/shortcuts`** to set your screenshot shortcut (default: `Alt+O`)

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
