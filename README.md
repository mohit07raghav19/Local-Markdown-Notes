# Local Markdown Notes

![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)
![Manifest V3](https://img.shields.io/badge/manifest-v3-orange.svg)
![Privacy](https://img.shields.io/badge/privacy-focused-green.svg)
![Offline](https://img.shields.io/badge/offline--first-yes-orange.svg)
![AI-Assisted](https://img.shields.io/badge/ai--assisted-yes-blueviolet.svg)

A lightweight browser extension for taking markdown notes with screenshots and YouTube timestamps—all stored locally on your device. Perfect for privacy-conscious learners and researchers.

**Supported Browsers**: Chrome, Brave, Edge, and other Chromium-based browsers with sidebar support.

## 🎥 Demo

Here is a quick walkthrough showing how to use the extension:

https://github.com/user-attachments/assets/62fdc31e-19c1-4cab-94f6-df78b15ea8ab


## ✨ Features

### 📝 Markdown Editor & Preview
- **Live Preview Toggle**: Instantly switch between the code editor view and the rendered preview to visualize your formatted notes.
- **Slash Commands (`/`)**: Type `/` inside the editor to trigger a snippet palette for quick insertions (headings, bullet points, numbered lists, tables, checklists, code blocks, or current date-time).
- **Vim Mode Integration**: Keyboard-centric, distraction-free editing with full support for Vim keybindings. A mode badge at the bottom of the editor keeps track of your current mode (`INSERT`, `NORMAL`, `VISUAL`).

### 📸 Smart Screenshot Capture
- **One-Click Snapshots**: Instantly capture screenshots using the **`Opt+O`** (macOS) / **`Alt+O`** (Windows/Linux) shortcut or the camera button in the sidepanel.
- **Auto-Reference Images**: Screenshots are saved locally in the browser's persistent storage and are instantly appended into your Markdown notes.
- **Drag-and-Drop / Clipboard support**: Drag and drop external images or paste them directly from your clipboard right into the editor.

### 🎥 YouTube Smart Timestamps
- **Context-Aware Timestamps**: Taking a screenshot while a YouTube video is open in the active tab automatically captures the exact video playback timestamp.
- **Interactive Video Anchors**: Click on any captured timestamp link in your notes (e.g., `[02:45]`) to immediately jump back to that exact second in the active YouTube video.
- **Keyboard Playback Controls**: Control the active YouTube video directly from the editor without switching windows:
  - `Alt+K` – Play / Pause
  - `Alt+J` – Rewind 10 seconds
  - `Alt+L` – Fast-Forward 10 seconds

### 🖼️ Local Image Management
- **Media Hub**: Expand the **Images** panel at the bottom to browse, preview, and manage all captured screenshots.
- **Easy Cleanups**: Delete unused screenshots or copy local image reference paths with a single click.

### 💾 Local-First & Private
- **Zero Cloud Tracking**: All notes and image data are stored 100% locally on your machine using Chrome's persistent storage APIs. No cloud, no analytics, no external servers.
- **Full Offline Capability**: Take notes, format markdown, and manage images without needing an internet connection.
- **ZIP Export**: Download all your notes and referenced images packed together in a clean `.zip` archive for easy local backups.

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

## 💡 Key Highlights

- **Modular Architecture**: Clean separation of concerns for easy maintenance
- **Zero External Dependencies**: No tracking, analytics, or cloud sync
- **Manifest V3**: Modern, secure extension format
- **Cross-Browser Support**: Works on Chrome, Brave, Edge, and similar browsers

## 📄 License

MIT License - Feel free to fork, modify, and share

---

Built with ❤️ for privacy-conscious note-takers
