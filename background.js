// Update badge with current tab count
function updateBadge() {
  chrome.tabs.query({}, function(tabs) {
    var count = tabs.length;
    chrome.action.setBadgeText({ text: String(count) });
    chrome.action.setBadgeBackgroundColor({ color: '#C17C4E' });
  });
}

// Listen for tab events
chrome.tabs.onCreated.addListener(updateBadge);
chrome.tabs.onRemoved.addListener(updateBadge);
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo) {
  if (changeInfo.status === 'complete') updateBadge();
});

// Run on startup
chrome.runtime.onInstalled.addListener(updateBadge);
chrome.runtime.onStartup.addListener(updateBadge);
updateBadge();
