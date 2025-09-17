/**
 * High-Performance Tab Switching Module
 *
 * Provides instant tab switching with <100ms performance requirement
 * Features: click/keyboard navigation, URL hash updates, accessibility,
 * module integration, lazy loading, and error handling
 */

class TabManager {
    constructor(options = {}) {
        this.options = {
            tabSelector: '[data-tab-trigger]',
            contentSelector: '[data-tab-content]',
            activeClass: 'active',
            hiddenClass: 'hidden',
            loadingClass: 'loading',
            errorClass: 'error',
            debounceDelay: 50, // Debounce to ensure <100ms performance
            enableKeyboardNav: true,
            enableHashUpdates: true,
            enableLazyLoading: true,
            enableModuleIntegration: true,
            announceChanges: true,
            cacheTimeout: 300000, // 5 minutes cache
            ...options
        };

        this.activeTab = null;
        this.tabs = new Map();
        this.contentCache = new Map();
        this.loadingStates = new Map();
        this.switchTimeout = null;
        this.performanceStartTime = null;

        // Performance monitoring
        this.metrics = {
            switchCount: 0,
            totalSwitchTime: 0,
            averageSwitchTime: 0,
            maxSwitchTime: 0
        };

        this.init();
    }

    /**
     * Initialize the tab manager
     */
    init() {
        this.setupTabElements();
        this.bindEvents();
        this.setupKeyboardNavigation();
        this.setupHashNavigation();
        this.setupAccessibility();
        this.loadInitialTab();

        console.log('TabManager initialized with', this.tabs.size, 'tabs');
    }

    /**
     * Setup tab elements and content mapping
     */
    setupTabElements() {
        const tabTriggers = document.querySelectorAll(this.options.tabSelector);
        const tabContents = document.querySelectorAll(this.options.contentSelector);

        // Map tabs to their content
        tabTriggers.forEach(trigger => {
            const tabId = trigger.dataset.tabTrigger;
            const content = document.querySelector(`[data-tab-content="${tabId}"]`);

            if (content) {
                this.tabs.set(tabId, {
                    trigger,
                    content,
                    loaded: false,
                    enabled: !trigger.hasAttribute('disabled'),
                    moduleId: trigger.dataset.moduleId || null,
                    loadUrl: trigger.dataset.loadUrl || null
                });

                // Set up initial ARIA attributes
                trigger.setAttribute('role', 'tab');
                trigger.setAttribute('aria-controls', `content-${tabId}`);
                trigger.setAttribute('aria-selected', 'false');
                trigger.setAttribute('tabindex', '-1');

                content.setAttribute('role', 'tabpanel');
                content.setAttribute('aria-labelledby', trigger.id || `tab-${tabId}`);
                content.setAttribute('id', `content-${tabId}`);
                content.classList.add(this.options.hiddenClass);
            }
        });

        // Set up tab container role
        const tabContainer = document.querySelector('[role="tablist"]') ||
                           document.querySelector('.tabs-container') ||
                           tabTriggers[0]?.parentElement;

        if (tabContainer && !tabContainer.hasAttribute('role')) {
            tabContainer.setAttribute('role', 'tablist');
        }
    }

    /**
     * Bind click events with performance optimization
     */
    bindEvents() {
        // Use event delegation for better performance
        document.addEventListener('click', (e) => {
            const trigger = e.target.closest(this.options.tabSelector);
            if (trigger && this.tabs.has(trigger.dataset.tabTrigger)) {
                e.preventDefault();
                this.switchTab(trigger.dataset.tabTrigger, 'click');
            }
        });

        // Handle browser back/forward navigation
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.tabId) {
                this.switchTab(e.state.tabId, 'history', false);
            } else if (this.options.enableHashUpdates) {
                this.handleHashChange();
            }
        });

        // Handle hash changes
        if (this.options.enableHashUpdates) {
            window.addEventListener('hashchange', () => this.handleHashChange());
        }

        // Performance monitoring
        if (performance && performance.mark) {
            document.addEventListener('tabSwitch', (e) => {
                this.recordPerformanceMetric(e.detail.switchTime);
            });
        }
    }

    /**
     * Setup keyboard navigation
     */
    setupKeyboardNavigation() {
        if (!this.options.enableKeyboardNav) return;

        document.addEventListener('keydown', (e) => {
            const trigger = e.target.closest(this.options.tabSelector);
            if (!trigger || !this.tabs.has(trigger.dataset.tabTrigger)) return;

            const tabArray = Array.from(this.tabs.keys()).filter(id =>
                this.tabs.get(id).enabled
            );
            const currentIndex = tabArray.indexOf(trigger.dataset.tabTrigger);

            let targetIndex = currentIndex;

            switch (e.key) {
                case 'ArrowLeft':
                case 'ArrowUp':
                    e.preventDefault();
                    targetIndex = currentIndex > 0 ? currentIndex - 1 : tabArray.length - 1;
                    break;
                case 'ArrowRight':
                case 'ArrowDown':
                    e.preventDefault();
                    targetIndex = currentIndex < tabArray.length - 1 ? currentIndex + 1 : 0;
                    break;
                case 'Home':
                    e.preventDefault();
                    targetIndex = 0;
                    break;
                case 'End':
                    e.preventDefault();
                    targetIndex = tabArray.length - 1;
                    break;
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    this.switchTab(trigger.dataset.tabTrigger, 'keyboard');
                    return;
                default:
                    return;
            }

            if (targetIndex !== currentIndex) {
                const targetTab = this.tabs.get(tabArray[targetIndex]);
                if (targetTab) {
                    targetTab.trigger.focus();
                }
            }
        });
    }

    /**
     * Setup URL hash navigation
     */
    setupHashNavigation() {
        if (!this.options.enableHashUpdates) return;

        this.handleHashChange = this.debounce(() => {
            const hash = window.location.hash.slice(1);
            if (hash && this.tabs.has(hash)) {
                this.switchTab(hash, 'hash', false);
            }
        }, this.options.debounceDelay);
    }

    /**
     * Setup accessibility features
     */
    setupAccessibility() {
        // Create live region for announcements
        if (this.options.announceChanges && !document.getElementById('tab-announcer')) {
            const announcer = document.createElement('div');
            announcer.id = 'tab-announcer';
            announcer.setAttribute('aria-live', 'polite');
            announcer.setAttribute('aria-atomic', 'true');
            announcer.className = 'sr-only';
            announcer.style.cssText = `
                position: absolute !important;
                width: 1px !important;
                height: 1px !important;
                padding: 0 !important;
                margin: -1px !important;
                overflow: hidden !important;
                clip: rect(0, 0, 0, 0) !important;
                white-space: nowrap !important;
                border: 0 !important;
            `;
            document.body.appendChild(announcer);
        }
    }

    /**
     * Load initial tab based on hash or first enabled tab
     */
    loadInitialTab() {
        let initialTab = null;

        // Check hash first
        if (this.options.enableHashUpdates) {
            const hash = window.location.hash.slice(1);
            if (hash && this.tabs.has(hash) && this.tabs.get(hash).enabled) {
                initialTab = hash;
            }
        }

        // Fall back to first enabled tab
        if (!initialTab) {
            for (const [tabId, tab] of this.tabs) {
                if (tab.enabled) {
                    initialTab = tabId;
                    break;
                }
            }
        }

        if (initialTab) {
            this.switchTab(initialTab, 'init', false);
        }
    }

    /**
     * High-performance tab switching with <100ms requirement
     */
    async switchTab(tabId, trigger = 'api', updateHistory = true) {
        // Performance monitoring start
        this.performanceStartTime = performance.now();

        // Debounce rapid switches
        if (this.switchTimeout) {
            clearTimeout(this.switchTimeout);
        }

        this.switchTimeout = setTimeout(async () => {
            await this.performTabSwitch(tabId, trigger, updateHistory);
        }, trigger === 'keyboard' ? 0 : this.options.debounceDelay);
    }

    /**
     * Perform the actual tab switch
     */
    async performTabSwitch(tabId, trigger, updateHistory) {
        const tab = this.tabs.get(tabId);

        if (!tab || !tab.enabled || tabId === this.activeTab) {
            return;
        }

        try {
            // Hide current tab instantly
            if (this.activeTab) {
                this.hideTab(this.activeTab);
            }

            // Show loading state for new tab
            this.showLoadingState(tabId);

            // Load content if needed
            if (this.options.enableLazyLoading && !tab.loaded) {
                await this.loadTabContent(tabId);
            }

            // Show new tab content
            this.showTab(tabId);

            // Update URL hash
            if (this.options.enableHashUpdates && updateHistory) {
                this.updateHash(tabId, trigger);
            }

            // Update accessibility
            this.updateAccessibility(tabId);

            // Announce change to screen readers
            if (this.options.announceChanges) {
                this.announceTabChange(tabId);
            }

            // Record performance
            const switchTime = performance.now() - this.performanceStartTime;
            this.dispatchTabSwitchEvent(tabId, trigger, switchTime);

            // Warn if performance requirement not met
            if (switchTime > 100) {
                console.warn(`Tab switch took ${switchTime.toFixed(2)}ms, exceeding 100ms requirement`);
            }

            this.activeTab = tabId;

        } catch (error) {
            console.error('Error switching tab:', error);
            this.showError(tabId, error.message);
        }
    }

    /**
     * Hide tab content instantly
     */
    hideTab(tabId) {
        const tab = this.tabs.get(tabId);
        if (tab) {
            tab.trigger.classList.remove(this.options.activeClass);
            tab.trigger.setAttribute('aria-selected', 'false');
            tab.trigger.setAttribute('tabindex', '-1');
            tab.content.classList.add(this.options.hiddenClass);
            tab.content.classList.remove(this.options.loadingClass, this.options.errorClass);
        }
    }

    /**
     * Show tab content instantly
     */
    showTab(tabId) {
        const tab = this.tabs.get(tabId);
        if (tab) {
            tab.trigger.classList.add(this.options.activeClass);
            tab.trigger.setAttribute('aria-selected', 'true');
            tab.trigger.setAttribute('tabindex', '0');
            tab.content.classList.remove(this.options.hiddenClass, this.options.loadingClass, this.options.errorClass);
        }
    }

    /**
     * Show loading state for tab
     */
    showLoadingState(tabId) {
        const tab = this.tabs.get(tabId);
        if (tab && !tab.loaded) {
            tab.content.classList.add(this.options.loadingClass);
            tab.content.classList.remove(this.options.hiddenClass, this.options.errorClass);
        }
    }

    /**
     * Show error state for tab
     */
    showError(tabId, message) {
        const tab = this.tabs.get(tabId);
        if (tab) {
            tab.content.classList.add(this.options.errorClass);
            tab.content.classList.remove(this.options.hiddenClass, this.options.loadingClass);

            // Show error message
            tab.content.innerHTML = `
                <div class="tab-error-message" role="alert">
                    <h3>Error Loading Content</h3>
                    <p>${this.escapeHtml(message)}</p>
                    <button class="btn btn-secondary" onclick="window.tabManager.retryLoadTab('${tabId}')">
                        Retry
                    </button>
                </div>
            `;
        }
    }

    /**
     * Load tab content dynamically
     */
    async loadTabContent(tabId) {
        const tab = this.tabs.get(tabId);
        if (!tab || tab.loaded) return;

        // Check cache first
        const cachedContent = this.contentCache.get(tabId);
        if (cachedContent && Date.now() - cachedContent.timestamp < this.options.cacheTimeout) {
            tab.content.innerHTML = cachedContent.content;
            tab.loaded = true;
            return;
        }

        // Load from URL or module
        if (tab.loadUrl) {
            await this.loadFromUrl(tabId, tab.loadUrl);
        } else if (this.options.enableModuleIntegration && tab.moduleId) {
            await this.loadFromModule(tabId, tab.moduleId);
        } else {
            // Content already in DOM
            tab.loaded = true;
        }
    }

    /**
     * Load content from URL
     */
    async loadFromUrl(tabId, url) {
        const tab = this.tabs.get(tabId);
        if (!tab) return;

        try {
            const response = await fetch(url, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const content = await response.text();
            tab.content.innerHTML = content;

            // Cache the content
            this.contentCache.set(tabId, {
                content,
                timestamp: Date.now()
            });

            tab.loaded = true;

        } catch (error) {
            throw new Error(`Failed to load content from ${url}: ${error.message}`);
        }
    }

    /**
     * Load content from module system
     */
    async loadFromModule(tabId, moduleId) {
        const tab = this.tabs.get(tabId);
        if (!tab) return;

        try {
            // Check if module is enabled
            const moduleStatus = await this.checkModuleStatus(moduleId);
            if (!moduleStatus.enabled) {
                throw new Error(`Module ${moduleId} is not enabled`);
            }

            // Load module content
            const response = await fetch(`/api/modules/${moduleId}/content`, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to load module content: ${response.statusText}`);
            }

            const result = await response.json();
            tab.content.innerHTML = result.content || '<p>No content available</p>';

            // Cache the content
            this.contentCache.set(tabId, {
                content: result.content,
                timestamp: Date.now()
            });

            tab.loaded = true;

        } catch (error) {
            throw new Error(`Failed to load module ${moduleId}: ${error.message}`);
        }
    }

    /**
     * Check module status
     */
    async checkModuleStatus(moduleId) {
        try {
            const response = await fetch(`/api/modules/${moduleId}/status`);
            if (response.ok) {
                return await response.json();
            }
            return { enabled: false };
        } catch (error) {
            console.warn('Could not check module status:', error);
            return { enabled: true }; // Assume enabled if we can't check
        }
    }

    /**
     * Retry loading a tab
     */
    async retryLoadTab(tabId) {
        const tab = this.tabs.get(tabId);
        if (tab) {
            tab.loaded = false;
            this.contentCache.delete(tabId);
            await this.switchTab(tabId, 'retry');
        }
    }

    /**
     * Update URL hash
     */
    updateHash(tabId, trigger) {
        const newHash = `#${tabId}`;

        if (window.location.hash !== newHash) {
            if (trigger !== 'hash' && window.history && window.history.pushState) {
                window.history.pushState(
                    { tabId, timestamp: Date.now() },
                    '',
                    newHash
                );
            } else {
                window.location.hash = newHash;
            }
        }
    }

    /**
     * Update accessibility attributes
     */
    updateAccessibility(tabId) {
        // Update all tabs
        for (const [id, tab] of this.tabs) {
            const isActive = id === tabId;
            tab.trigger.setAttribute('aria-selected', isActive ? 'true' : 'false');
            tab.trigger.setAttribute('tabindex', isActive ? '0' : '-1');
        }
    }

    /**
     * Announce tab change to screen readers
     */
    announceTabChange(tabId) {
        const tab = this.tabs.get(tabId);
        if (tab) {
            const announcer = document.getElementById('tab-announcer');
            if (announcer) {
                const tabText = tab.trigger.textContent || tab.trigger.innerText || tabId;
                announcer.textContent = `Switched to ${tabText} tab`;
            }
        }
    }

    /**
     * Dispatch tab switch event
     */
    dispatchTabSwitchEvent(tabId, trigger, switchTime) {
        const event = new CustomEvent('tabSwitch', {
            detail: {
                tabId,
                trigger,
                switchTime,
                performance: {
                    meets100msRequirement: switchTime <= 100
                }
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * Record performance metrics
     */
    recordPerformanceMetric(switchTime) {
        this.metrics.switchCount++;
        this.metrics.totalSwitchTime += switchTime;
        this.metrics.averageSwitchTime = this.metrics.totalSwitchTime / this.metrics.switchCount;
        this.metrics.maxSwitchTime = Math.max(this.metrics.maxSwitchTime, switchTime);
    }

    /**
     * Enable/disable a tab
     */
    setTabEnabled(tabId, enabled) {
        const tab = this.tabs.get(tabId);
        if (tab) {
            tab.enabled = enabled;

            if (enabled) {
                tab.trigger.removeAttribute('disabled');
                tab.trigger.setAttribute('tabindex', tab.trigger === this.activeTab ? '0' : '-1');
            } else {
                tab.trigger.setAttribute('disabled', '');
                tab.trigger.setAttribute('tabindex', '-1');

                // Switch to another tab if this was active
                if (tabId === this.activeTab) {
                    const firstEnabled = Array.from(this.tabs.entries())
                        .find(([id, t]) => t.enabled && id !== tabId);
                    if (firstEnabled) {
                        this.switchTab(firstEnabled[0], 'auto');
                    }
                }
            }
        }
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return { ...this.metrics };
    }

    /**
     * Clear content cache
     */
    clearCache() {
        this.contentCache.clear();
        // Mark all tabs as not loaded except the active one
        for (const [tabId, tab] of this.tabs) {
            if (tabId !== this.activeTab) {
                tab.loaded = false;
            }
        }
    }

    /**
     * Utility: Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Utility: Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Destroy the tab manager
     */
    destroy() {
        // Clear timeouts
        if (this.switchTimeout) {
            clearTimeout(this.switchTimeout);
        }

        // Remove event listeners
        // Note: Since we use document-level delegation,
        // we don't need to remove individual listeners

        // Clear caches
        this.contentCache.clear();
        this.tabs.clear();

        // Remove announcer
        const announcer = document.getElementById('tab-announcer');
        if (announcer) {
            announcer.remove();
        }

        console.log('TabManager destroyed');
    }
}

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if tabs are present
    if (document.querySelector('[data-tab-trigger]')) {
        window.tabManager = new TabManager();
        console.log('TabManager auto-initialized');
    }
});

// Export for module environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TabManager;
}

// Global utility functions for backwards compatibility
window.switchTab = function(tabId) {
    if (window.tabManager) {
        window.tabManager.switchTab(tabId, 'api');
    }
};

window.getTabPerformance = function() {
    return window.tabManager ? window.tabManager.getPerformanceMetrics() : null;
};