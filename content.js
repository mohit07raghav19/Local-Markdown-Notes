// Content script to capture any video element on any page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
