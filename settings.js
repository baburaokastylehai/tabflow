document.addEventListener('DOMContentLoaded', function() {
  var suspendTimeInput = document.getElementById('suspend-time');
  var excludedDomainsInput = document.getElementById('excluded-domains');
  var saveButton = document.getElementById('save-settings');
  var statusMessage = document.getElementById('status-message');

  // Load saved settings
  chrome.storage.sync.get(['suspendTime', 'excludedDomains'], function(data) {
    if (data.suspendTime) {
      suspendTimeInput.value = data.suspendTime;
    }
    if (data.excludedDomains) {
      excludedDomainsInput.value = data.excludedDomains.join(', ');
    }
  });

  // Save settings
  saveButton.addEventListener('click', function() {
    var suspendTime = parseInt(suspendTimeInput.value);
    var excludedDomains = excludedDomainsInput.value
      .split(',')
      .map(function(domain) { return domain.trim(); })
      .filter(function(domain) { return domain.length > 0; });

    // Default to 24 hours if invalid
    if (isNaN(suspendTime) || suspendTime < 1) {
      suspendTime = 24;
    }

    chrome.storage.sync.set({
      suspendTime: suspendTime,
      excludedDomains: excludedDomains
    }, function() {
      statusMessage.classList.add('show');
      setTimeout(function() {
        statusMessage.classList.remove('show');
      }, 2000);
    });
  });
});
