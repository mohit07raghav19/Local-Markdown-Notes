// Content script to capture any video element on any page
// Injected stylesheet for HUD overlay
const extStyle = document.createElement("style");
extStyle.textContent = `
  .ext-video-hud {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8);
    color: #ffffff;
    padding: 12px 20px;
    border-radius: 20px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 15px;
    font-weight: 600;
    z-index: 2147483647;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    opacity: 1;
    transition: opacity 0.2s ease-out, transform 0.2s ease-out;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
  }
  .ext-video-hud svg {
    width: 20px;
    height: 20px;
  }
`;
document.head.appendChild(extStyle);

function showHUDNotification(text, svgIcon) {
  const video = findVideoElement();
  if (!video) return;

  const container = document.fullscreenElement || video.closest('.html5-video-player') || video.parentElement || document.body;

  const existing = container.querySelector(".ext-video-hud");
  if (existing) {
    existing.remove();
  }

  const hud = document.createElement("div");
  hud.className = "ext-video-hud";
  hud.innerHTML = `${svgIcon} <span>${text}</span>`;

  const containerStyle = window.getComputedStyle(container);
  const originalPosition = containerStyle.position;
  if (originalPosition === "static" && container !== document.body) {
    container.style.position = "relative";
  }

  container.appendChild(hud);

  setTimeout(() => {
    hud.style.opacity = "0";
    hud.style.transform = "translate(-50%, -60%)";
    setTimeout(() => {
      hud.remove();
      if (originalPosition === "static" && container !== document.body) {
        container.style.position = originalPosition;
      }
    }, 200);
  }, 600);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "togglePlayPause") {
    const video = findVideoElement();
    if (video) {
      if (video.paused) {
        video.play();
        showHUDNotification("Play", `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`);
      } else {
        video.pause();
        showHUDNotification("Pause", `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`);
      }
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "No video found" });
    }
    return false;
  }

  if (request.action === "rewindVideo") {
    const video = findVideoElement();
    if (video) {
      video.currentTime = Math.max(0, video.currentTime - 5);
      showHUDNotification("-5s", `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"/></svg>`);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "No video found" });
    }
    return false;
  }

  if (request.action === "forwardVideo") {
    const video = findVideoElement();
    if (video) {
      video.currentTime = Math.min(video.duration || video.currentTime + 5, video.currentTime + 5);
      showHUDNotification("+5s", `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 17l5-5-5-5M6 17l5-5-5-5"/></svg>`);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "No video found" });
    }
    return false;
  }

  if (request.action === "getTimestampAndCapture") {
    // Try to find any video element on the page
    const video = findVideoElement();

    if (video) {
      // Get timestamp if available
      const timestamp = video.currentTime || null;

      // Capture the video element
      captureVideoElement(video)
        .then((videoScreenshot) => {
          sendResponse({
            timestamp: timestamp,
            videoScreenshot: videoScreenshot,
            hasVideo: true,
          });
        })
        .catch((error) => {
          console.error("Video capture error:", error);
          sendResponse({
            timestamp: timestamp,
            videoScreenshot: null,
            hasVideo: true,
          });
        });
    } else {
      // No video element found
      sendResponse({
        timestamp: null,
        videoScreenshot: null,
        hasVideo: false,
      });
    }
    return true; // Keep message channel open for async response
  }
});

// Function to find any video element on the page - completely generic
function findVideoElement() {
  // Find all video elements including those in shadow DOM
  const videos = [];

  // Regular video elements
  videos.push(...Array.from(document.querySelectorAll("video")));

  // Check for videos in shadow DOMs (some players use shadow DOM)
  const elementsWithShadow = document.querySelectorAll("*");
  elementsWithShadow.forEach((el) => {
    if (el.shadowRoot) {
      const shadowVideos = el.shadowRoot.querySelectorAll("video");
      videos.push(...Array.from(shadowVideos));
    }
  });

  if (videos.length === 0) return null;

  // Filter out hidden videos and sort by size (largest, most visible first)
  const visibleVideos = videos.filter((v) => {
    try {
      const rect = v.getBoundingClientRect();
      const style = window.getComputedStyle(v);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0"
      );
    } catch (e) {
      return false;
    }
  });

  if (visibleVideos.length === 0) {
    // No visible videos, return first video as fallback
    return videos[0];
  }

  // Sort by size (largest first) and visibility in viewport
  visibleVideos.sort((a, b) => {
    const aRect = a.getBoundingClientRect();
    const bRect = b.getBoundingClientRect();

    // Calculate visible area in viewport
    const aInViewport = isInViewport(aRect);
    const bInViewport = isInViewport(bRect);

    // Prioritize videos in viewport
    if (aInViewport && !bInViewport) return -1;
    if (!aInViewport && bInViewport) return 1;

    // Then sort by size
    const aSize = aRect.width * aRect.height;
    const bSize = bRect.width * bRect.height;
    return bSize - aSize;
  });

  return visibleVideos[0];
}

// Helper function to check if element is in viewport
function isInViewport(rect) {
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <=
      (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

// Function to capture only the video element
async function captureVideoElement(videoElement) {
  try {
    // Get video dimensions and position
    const rect = videoElement.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    // Create a canvas to draw the video
    const canvas = document.createElement("canvas");
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext("2d");

    // Draw the video frame onto the canvas
    ctx.drawImage(videoElement, 0, 0, rect.width, rect.height);

    // Convert canvas to data URL
    const dataUrl = canvas.toDataURL("image/png");

    return dataUrl;
  } catch (error) {
    console.error("Failed to capture video element:", error);
    return null;
  }
}


