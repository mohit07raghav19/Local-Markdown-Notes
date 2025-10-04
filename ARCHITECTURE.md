# Architecture Documentation

## Overview

Local Markdown Notes follows a modular architecture pattern optimized for Chrome Extension Manifest V3, emphasizing privacy, performance, and maintainability.

## Core Principles

### 1. Privacy by Design

- **Zero Data Collection**: No analytics, tracking, or telemetry
- **Local-First**: All data stored in browser's local storage
- **No External Dependencies**: No CDNs or external API calls
- **Offline Capable**: Full functionality without internet connection

### 2. Performance Optimization

- **Lazy Loading**: Modules loaded on-demand
- **Rate Limiting**: Prevents Chrome API quota exhaustion
- **Memory Management**: Efficient cleanup and garbage collection
- **Caching Strategy**: Smart caching for frequently accessed data

### 3. Maintainable Code Structure

- **Modular Design**: Clear separation of concerns
- **Event-Driven Architecture**: Loose coupling between components
- **Error Boundaries**: Graceful degradation on failures
- **Extensible Framework**: Easy to add new features

## System Architecture

### Component Interaction Diagram

```file
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Content Script │    │Background Worker│    │   Side Panel    │
│  (content.js)   │    │(background.js)  │    │ (sidepanel.html)│
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │ ┌─Message Passing────┼─Message Passing──────┤
          │ │                    │                      │
          ▼ ▼                    ▼                      ▼
    ┌──────────────────────────────────────────────────────────┐
    │                Chrome Extension APIs                     │
    │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐ │
    │  │  Tabs   │ │ Runtime │ │ Storage │ │   Side Panel    │ │
    │  │   API   │ │   API   │ │   API   │ │      API        │ │
    │  └─────────┘ └─────────┘ └─────────┘ └─────────────────┘ │
    └──────────────────────────────────────────────────────────┘
```

### Data Flow Architecture

```file
┌─────────────┐
│ User Action │
└─────┬───────┘
      │
      ▼
┌─────────────────┐    ┌──────────────────┐
│ Event Capture   │    │ State Management │
│ (UI/Keyboard)   │────▶ (Storage Layer)  │
└─────────────────┘    └─────────┬────────┘
      │                          │
      ▼                          ▼
┌─────────────────┐    ┌──────────────────┐
│ Action Dispatch │    │ Data Persistence │
│ (Message Bus)   │────▶ (Browser Storage)│
└─────────────────┘    └──────────────────┘
      │
      ▼
┌─────────────────┐
│ UI Update       │
│ (DOM Rendering) │
└─────────────────┘
```

## Module Breakdown

### Background Service Worker

**File**: `background.js`
**Role**: Central coordinator and Chrome API gateway

#### Key Responsibilities

- **Command Processing**: Handle keyboard shortcuts (`Alt+O`)
- **Screenshot Orchestration**: Coordinate capture between tabs and content scripts
- **Rate Limiting**: Prevent API quota exhaustion with intelligent queuing
- **Cross-Tab Communication**: Message routing between content scripts and side panel

#### API Surface

```javascript
// Rate limiting configuration
const SCREENSHOT_COOLDOWN_MS = 1000;
let screenshotQueue = [];

// Core functions
async function init()
async function handleScreenshotCommand()
async function captureScreenshot()
async function processScreenshotQueue()
```

#### Message Handling

```javascript
// Incoming message types
MESSAGE_TYPES = {
  CAPTURE_SCREENSHOT: "captureScreenshot",
  GET_TIMESTAMP_AND_CAPTURE: "getTimestampAndCapture",
  COMMAND_SCREENSHOT: "commandScreenshot",
  OPEN_SIDE_PANEL: "openSidePanel",
};
```

### Content Script Layer

**File**: `content.js`
**Role**: Web page interaction and YouTube integration

#### YouTube-Specific Features

- **Video Element Detection**: Locate and interact with video players
- **Timestamp Extraction**: Get current playback time
- **Video Frame Capture**: Direct canvas-based video capture
- **Quality Optimization**: Adaptive capture based on video resolution

#### Content Script API

```javascript
// Message listener for background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTimestampAndCapture') {
    // Handle YouTube video capture
  }
});

// Video capture function
async function captureVideoElement(videoElement)
```

### Side Panel Application

**File**: `sidepanel.html` + JavaScript modules
**Role**: Main user interface and note management

#### Module Structure

```file
js/
├── app.js                 # Application bootstrap
├── modules/
│   ├── screenshots.js     # Screenshot handling
│   ├── storage.js         # Data persistence
│   ├── editor.js          # Markdown editing
│   ├── imageManager.js    # Image organization
│   ├── preview.js         # Markdown rendering
│   ├── fileHandler.js     # Import/export
│   └── slashPalette.js   # Command palette
└── utils/
    ├── dom.js            # DOM utilities
    └── markdown.js       # Markdown processing
```

#### Component Architecture

```javascript
// Module initialization pattern
const ModuleName = (() => {
  function init() {
    setupEventListeners();
    setupMessageListeners(); // For background communication
  }

  function setupEventListeners() {
    // DOM event handling
  }

  function setupMessageListeners() {
    // Chrome extension message handling
  }

  return {
    init,
    // public API
  };
})();
```

## State Management

### Storage Strategy

#### Local Storage Schema

```javascript
{
  // Note content
  "notes": "# Markdown content...",
  "filename": "notes",

  // Image data
  "images": {
    "image_id_1": {
      "dataUrl": "data:image/png;base64,...",
      "filename": "screenshot_123.png",
      "timestamp": 1234567890,
      "metadata": {
        "source": "youtube",
        "videoTime": 125.5,
        "title": "Video Title"
      }
    }
  },

  // Application state
  "ui_state": {
    "preview_visible": false,
    "images_expanded": false,
    "last_cursor_position": 150
  }
}
```

#### Storage Operations

```javascript
// Debounced save to prevent excessive writes
const saveNotes = debounce(() => {
  chrome.storage.local.set({
    notes: editor.value,
    filename: filenameInput.value,
    images: imageStore,
    ui_state: getUIState(),
  });
}, 500);
```

### Message Bus Architecture

#### Inter-Component Communication -

```javascript
// Event-driven communication
document.addEventListener("imageCapture", (event) => {
  const { dataUrl, title, url, timestamp } = event.detail;
  ImageManager.addImage(dataUrl, generateFilename());
  Editor.insertImageReference(filename);
});

// Chrome extension message passing
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "commandScreenshot":
      handleBackgroundScreenshot(message);
      break;
  }
});
```

## Error Handling Strategy

### Graceful Degradation

#### Connection Error Handling

```javascript
async function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        const errorMessage = chrome.runtime.lastError.message;
        if (errorMessage.includes("Could not establish connection")) {
          logger.warn("Side panel not available", { action: message.action });
          resolve(null); // Graceful degradation
        } else {
          reject(new Error(errorMessage));
        }
      } else {
        resolve(response);
      }
    });
  });
}
```

#### Rate Limiting Protection

```javascript
async function handleScreenshotCommand() {
  const now = Date.now();
  const timeSinceLastCapture = now - lastScreenshotTime;

  if (timeSinceLastCapture < SCREENSHOT_COOLDOWN_MS) {
    // Queue instead of failing
    return new Promise((resolve, reject) => {
      screenshotQueue.push({ resolve, reject, timestamp: now });
      processScreenshotQueue();
    });
  }

  // Proceed with capture
}
```

### Error Boundaries

#### Module-Level Error Isolation

```javascript
const SafeModule = (() => {
  function init() {
    try {
      // Module initialization
    } catch (error) {
      console.error("Module initialization failed:", error);
      // Fallback behavior
    }
  }

  function safeOperation() {
    try {
      // Risky operation
    } catch (error) {
      logger.error("Operation failed", error);
      showUserFriendlyError();
    }
  }
})();
```

## Performance Optimizations

### Image Handling

#### Compression Strategy

```javascript
function compressImage(dataUrl, quality = 0.8) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const img = new Image();

  return new Promise((resolve) => {
    img.onload = () => {
      // Calculate optimal dimensions
      const maxWidth = 1200;
      const scale = Math.min(1, maxWidth / img.width);

      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}
```

#### Lazy Loading -

```javascript
function loadImagePreview(imageId) {
  return new Promise((resolve) => {
    // Load compressed thumbnail first
    const thumbnail = generateThumbnail(imageId);
    resolve(thumbnail);

    // Load full image in background
    setTimeout(() => {
      loadFullImage(imageId);
    }, 100);
  });
}
```

### Memory Management

#### Cleanup Strategy -

```javascript
// Service worker cleanup
self.addEventListener("beforeunload", () => {
  // Clear large objects
  screenshotQueue = [];

  // Cancel pending operations
  clearTimeout(queueProcessingTimer);
});

// Image cache management
const imageCache = new Map();
const MAX_CACHE_SIZE = 50;

function addToCache(id, data) {
  if (imageCache.size >= MAX_CACHE_SIZE) {
    const firstKey = imageCache.keys().next().value;
    imageCache.delete(firstKey);
  }
  imageCache.set(id, data);
}
```

## Security Considerations

### Content Security Policy

#### Current CSP -

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self';"
  }
}
```

#### Security Measures -

- **No eval()**: Strict CSP prevents code injection
- **Local Resources Only**: No external script loading
- **Sanitized Inputs**: All user inputs are sanitized before storage
- **Secure Image Handling**: Data URLs validated before processing

### Privacy Protection

#### Data Isolation -

```javascript
// No external network requests
const BLOCKED_DOMAINS = ["analytics.google.com", "facebook.com"];

// Content script isolation
if (
  BLOCKED_DOMAINS.some((domain) => window.location.hostname.includes(domain))
) {
  // Disable certain features on tracking domains
}
```

## Testing Strategy

### Unit Testing Framework

```javascript
// Module testing pattern
describe("Screenshots Module", () => {
  beforeEach(() => {
    // Setup test environment
    setupMockChrome();
  });

  test("should handle rate limiting", async () => {
    // Test rate limiting behavior
  });

  test("should gracefully handle connection errors", async () => {
    // Test error handling
  });
});
```

### Integration Testing

```javascript
// End-to-end testing
describe("Extension Flow", () => {
  test("should capture YouTube screenshot with timestamp", async () => {
    // Navigate to YouTube
    // Trigger screenshot
    // Verify timestamp extraction
    // Verify note insertion
  });
});
```

## Development Workflow

### Local Development Setup

```bash
# Clone repository
git clone https://github.com/mohit07raghav19/Local-Markdown-Notes.git

# Load in Chrome
# 1. chrome://extensions/
# 2. Enable Developer Mode
# 3. Load Unpacked Extension

# Development with hot reload
npm run dev:watch
```

### Build Process

```bash
# Production build
npm run build

# Linting and formatting
npm run lint
npm run format

# Testing
npm run test
npm run test:e2e
```

### Code Style Guidelines

#### Module Pattern -

```javascript
const ModuleName = (() => {
  // Private variables
  let privateState = {};

  // Private functions
  function privateFunction() {}

  // Public API
  function publicFunction() {}

  // Initialization
  function init() {
    setupEventListeners();
    setupMessageListeners();
  }

  return {
    init,
    publicFunction,
  };
})();
```

#### Error Handling Pattern -

```javascript
async function safeAsyncOperation() {
  try {
    const result = await riskyOperation();
    return { success: true, data: result };
  } catch (error) {
    logger.error("Operation failed", error);
    return { success: false, error: error.message };
  }
}
```

## Deployment & Distribution

### Chrome Web Store Package

```bash
# Create distribution package
npm run build:production

# Generate extension package
npm run package

# Upload to Chrome Web Store
# Manual process via Chrome Developer Dashboard
```

### Version Management

```javascript
// Semantic versioning
{
  "version": "1.0.0",
  "version_name": "1.0.0 - Initial Release"
}

// Automated version bumping
npm run version:patch  # 1.0.0 -> 1.0.1
npm run version:minor  # 1.0.0 -> 1.1.0
npm run version:major  # 1.0.0 -> 2.0.0
```

## Future Technical Improvements

### 1. TypeScript Migration

- Gradual migration to TypeScript for better type safety
- Improved developer experience with IntelliSense
- Better error catching at compile time

### 2. Advanced State Management

- Implement Redux-like state management for complex state
- Better state persistence and restoration
- Undo/redo functionality

### 3. Performance Monitoring

- Add performance metrics collection (local only)
- Memory usage tracking
- Load time optimization

### 4. Advanced Testing

- Automated visual regression testing
- Performance benchmarking
- Cross-browser compatibility testing

This architecture document serves as a guide for current contributors and future development. The modular design ensures that new features can be added without disrupting existing functionality, while the privacy-first approach maintains user trust.
