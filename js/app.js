/**
 * Main Application
 * Initializes all modules and handles extension startup
 */
document.addEventListener("DOMContentLoaded", () => {
  // Initialize all modules in the correct order
  // 1. First UI and utils (no dependencies)
  UI.init();

  // 2. Then core functionality
  Storage.init();
  Editor.init();

  // 3. Then features that depend on core
  FileHandler.init();
  Preview.init();
  ImageManager.init();
  Screenshots.init();
  SlashPalette.init();
  ShortcutHelper.init();

  console.log("Local Markdown Notes extension initialized");
});
