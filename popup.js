document.addEventListener('DOMContentLoaded', function() {
    const tabsList = document.getElementById('tabs-list');
    const tabSummary = document.getElementById('tab-summary');
    const searchInput = document.getElementById('search-input');
    const focusModeToggle = document.getElementById('focus-mode-toggle');
    const saveSessionButton = document.getElementById('save-session');
    const restoreSessionButton = document.getElementById('restore-session');
    const settingsButton = document.getElementById('settings-button');

    let allTabs = [];
    let focusModeEnabled = false;
    let inactiveTabs = [];
    let originalSession = [];

    const domainGroups = {
        "Work": [
            "linkedin.com", "slack.com", "gmail.com", "zoom.us", "docs.google.com", "trello.com", 
            "notion.so", "microsoft.com", "github.com", "replit.com", "stackexchange.com", 
            "stackoverflow.com", "asana.com", "jira.com", "atlassian.com"
        ],
        "Development": [
            "github.com", "replit.com", "gitlab.com", "bitbucket.org", "stackexchange.com", 
            "stackoverflow.com", "developer.chrome.com", "npmjs.com"
        ],
        "Social": [
            "facebook.com", "twitter.com", "instagram.com", "reddit.com", "tiktok.com", 
            "discord.com", "snapchat.com", "whatsapp.com"
        ],
        "Entertainment": [
            "youtube.com", "netflix.com", "spotify.com", "primevideo.com", "twitch.tv", 
            "hulu.com", "disneyplus.com", "hbomax.com"
        ],
        "Research": [
            "scholar.google.com", "doi.org", "wikipedia.org", "arxiv.org", "researchgate.net"
        ],
        "Other": []
    };

    function getTabGroup(tab) {
        try {
            const domain = new URL(tab.url).hostname;
            for (const [group, domains] of Object.entries(domainGroups)) {
                if (domains.some(d => domain.includes(d))) {
                    return group;
                }
            }
        } catch (e) {
            // chrome:// pages or malformed URLs
        }
        return "Other";
    }

    function loadAndRenderTabs() {
        chrome.tabs.query({}, function(tabs) {
            allTabs = tabs;
            renderGroupedTabs(allTabs);
            updateTabSummary(allTabs.length);
        });
    }

    function renderGroupedTabs(tabs) {
        tabsList.innerHTML = '';
        const groupedTabs = {};

        tabs.forEach(function(tab) {
            const group = getTabGroup(tab);
            if (!groupedTabs[group]) {
                groupedTabs[group] = [];
            }
            groupedTabs[group].push(tab);
        });

        const sortedGroups = Object.keys(groupedTabs).sort((a, b) => (a === "Other" ? 1 : b === "Other" ? -1 : 0));

        sortedGroups.forEach(function(group) {
            if (groupedTabs[group].length > 0) {
                let groupContainer = document.createElement('div');
                groupContainer.classList.add('tab-group');

                let groupHeader = document.createElement('h2');
                groupHeader.textContent = `${group} (${groupedTabs[group].length})`;
                groupContainer.appendChild(groupHeader);

                groupedTabs[group].forEach(function(tab) {
                    let tabContainer = document.createElement('div');
                    tabContainer.classList.add('tab-container');

                    let tabInfo = document.createElement('div');
                    tabInfo.classList.add('tab-info');

                    let favicon = document.createElement('img');
                    favicon.classList.add('favicon');
                    if (tab.favIconUrl) {
                        favicon.src = tab.favIconUrl;
                        favicon.onerror = function() { this.style.display = 'none'; };
                    } else {
                        favicon.style.display = 'none';
                    }

                    let link = document.createElement('a');
                    link.href = tab.url;
                    link.textContent = tab.title;
                    link.title = `${tab.title} (${new URL(tab.url).hostname})`;
                    link.addEventListener('click', function(e) {
                        e.preventDefault();
                        chrome.tabs.update(tab.id, { active: true });
                        chrome.windows.update(tab.windowId, { focused: true });
                    });

                    tabInfo.appendChild(favicon);
                    tabInfo.appendChild(link);

                    let tabActions = document.createElement('div');
                    tabActions.classList.add('tab-actions');

                    let closeButton = document.createElement('button');
                    closeButton.textContent = "Close";
                    closeButton.onclick = function() {
                        chrome.tabs.remove(tab.id);
                        loadAndRenderTabs();
                    };

                    tabActions.appendChild(closeButton);
                    tabContainer.appendChild(tabInfo);
                    tabContainer.appendChild(tabActions);
                    groupContainer.appendChild(tabContainer);
                });

                tabsList.appendChild(groupContainer);
            }
        });
    }

    function updateTabSummary(count) {
        tabSummary.textContent = `Total Open Tabs: ${count}`;
    }

    searchInput.addEventListener('input', function() {
        const searchTerm = searchInput.value.toLowerCase();
        const filteredTabs = allTabs.filter(tab => 
            tab.title.toLowerCase().includes(searchTerm) || 
            tab.url.toLowerCase().includes(searchTerm)
        );
        renderGroupedTabs(filteredTabs);
        updateTabSummary(filteredTabs.length);
    });

    focusModeToggle.addEventListener('click', function() {
        focusModeEnabled = !focusModeEnabled;
        if (focusModeEnabled) {
            enableFocusMode();
        } else {
            disableFocusMode();
        }
    });

    function enableFocusMode() {
        chrome.tabs.query({}, function (tabs) {
            originalSession = tabs.map(tab => ({
                id: tab.id,
                url: tab.url,
                title: tab.title,
                lastAccessed: tab.lastAccessed,
                pinned: tab.pinned
            }));

            const activeTabsToKeep = Math.max(3, Math.ceil(tabs.length * 0.3));
            const sortedTabs = tabs.sort((a, b) => b.lastAccessed - a.lastAccessed);

            inactiveTabs = [];
            sortedTabs.forEach((tab, index) => {
                // Only discard if the tab is not pinned, not active, not playing audio
                if (index >= activeTabsToKeep && !tab.pinned && !tab.audible && !tab.active) {
                    try {
                        inactiveTabs.push(tab);
                        // Discard the tab safely, catch and log errors if discard fails
                        chrome.tabs.discard(tab.id).then(() => {
                            console.log(`Discarded tab with id: ${tab.id}`);
                        }).catch(err => {
                            console.error(`Cannot discard tab with id: ${tab.id}. Error: ${err}`);
                        });
                    } catch (error) {
                        console.error(`Error discarding tab with id: ${tab.id}`, error);
                    }
                }
            });

            // Store the inactive tabs in local storage for future restoration
            chrome.storage.local.set({ inactiveTabs: inactiveTabs, originalSession: originalSession }, function () {
                focusModeToggle.textContent = 'Disable Focus Mode';
                focusModeToggle.classList.add('focus-mode-enabled');
                console.log(`Focus Mode Enabled. ${inactiveTabs.length} tabs discarded.`);
                loadAndRenderTabs();
            });
        });
    }

    function disableFocusMode() {
        // Retrieve discarded tabs from storage and reload them
        chrome.storage.local.get(['inactiveTabs'], function (result) {
            if (result.inactiveTabs) {
                // Reload each discarded tab — they were suspended, not closed
                result.inactiveTabs.forEach(function (tab) {
                    try {
                        chrome.tabs.reload(tab.id).then(() => {
                            console.log(`Restored tab with id: ${tab.id}`);
                        }).catch(err => {
                            console.error(`Cannot reload tab with id: ${tab.id}. Error: ${err}`);
                        });
                    } catch (error) {
                        console.error(`Error reloading tab with id: ${tab.id}`, error);
                    }
                });
            }

            // Clean up storage
            chrome.storage.local.remove(['inactiveTabs', 'originalSession']);

            // Update UI and reset focus mode
            focusModeToggle.textContent = 'Enable Focus Mode';
            focusModeToggle.classList.remove('focus-mode-enabled');
            console.log("Focus Mode Disabled. Tabs restored.");
            loadAndRenderTabs();
        });
    }

    saveSessionButton.addEventListener('click', function() {
        chrome.tabs.query({}, function(tabs) {
            const sessionTabs = tabs.map(tab => ({ url: tab.url, title: tab.title }));
            chrome.storage.local.set({ savedSession: sessionTabs }, function() {
                saveSessionButton.textContent = 'Saved!';
                setTimeout(function() { saveSessionButton.textContent = 'Save Session'; }, 1500);
            });
        });
    });

    restoreSessionButton.addEventListener('click', function() {
        chrome.storage.local.get(['savedSession'], function(result) {
            if (result.savedSession) {
                var count = result.savedSession.length;
                if (confirm('Restore ' + count + ' tabs from your saved session?')) {
                    result.savedSession.forEach(function(tab) {
                        chrome.tabs.create({ url: tab.url });
                    });
                }
            } else {
                restoreSessionButton.textContent = 'No session';
                setTimeout(function() { restoreSessionButton.textContent = 'Restore Session'; }, 1500);
            }
        });
    });

    settingsButton.addEventListener('click', function() {
        chrome.runtime.openOptionsPage();
    });

    // Initialize
    loadAndRenderTabs();

    // Check and set initial Focus Mode state
    chrome.storage.local.get(['focusModeEnabled'], function(result) {
        focusModeEnabled = result.focusModeEnabled || false;
        if (focusModeEnabled) {
            focusModeToggle.textContent = 'Disable Focus Mode';
            focusModeToggle.classList.add('focus-mode-enabled');
        }
    });

    // Listen for tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete') {
            loadAndRenderTabs();
        }
    });

    // Listen for tab removals
    chrome.tabs.onRemoved.addListener(() => {
        loadAndRenderTabs();
    });
});