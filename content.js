// Content script to get YouTube video timestamp and capture video element
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTimestampAndCapture') {
    // Check if we're on YouTube
    if (window.location.hostname.includes('youtube.com')) {
      // Try to get the video element
      const video = document.querySelector('video');
      if (video) {
        const timestamp = video.currentTime;
        
        // Capture just the video element
        captureVideoElement(video).then(videoScreenshot => {
          sendResponse({ 
            timestamp: timestamp,
            videoScreenshot: videoScreenshot
          });
        }).catch(error => {
          console.error('Video capture error:', error);
          sendResponse({ 
            timestamp: timestamp,
            videoScreenshot: null
          });
        });
      } else {
        sendResponse({ timestamp: null, videoScreenshot: null });
      }
    } else {
      sendResponse({ timestamp: null, videoScreenshot: null });
    }
    return true; // Keep message channel open for async response
  }
});

// Function to capture only the video element
async function captureVideoElement(videoElement) {
  try {
    // Get video dimensions and position
    const rect = videoElement.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    
    // Create a canvas to draw the video
    const canvas = document.createElement('canvas');
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    
    // Draw the video frame onto the canvas
    ctx.drawImage(videoElement, 0, 0, rect.width, rect.height);
    
    // Convert canvas to data URL
    const dataUrl = canvas.toDataURL('image/png');
    
    return dataUrl;
  } catch (error) {
    console.error('Failed to capture video element:', error);
    return null;
  }
}