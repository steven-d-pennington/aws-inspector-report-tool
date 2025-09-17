// Settings management JavaScript
let currentSettings = {};
let currentModules = [];
let isLoading = false;
let autoSaveTimeout = null;
let hasUnsavedChanges = false;

// Debounce delay for auto-save (in milliseconds)
const AUTO_SAVE_DELAY = 2000;

// Initialize settings page when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    await loadSettings();
    await loadModules();
    initializeEventListeners();
    updateUnsavedChangesIndicator();
});

/**
 * Load application settings from the API
 */
async function loadSettings() {
    try {
        showLoadingIndicator('settingsContainer', 'Loading settings...');

        const response = await fetch('/api/settings');

        if (!response.ok) {
            throw new Error(`Failed to load settings: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        currentSettings = data.settings || {};

        renderSettings();
        hideLoadingIndicator('settingsContainer');

        console.log('Settings loaded successfully:', Object.keys(currentSettings).length, 'settings');
    } catch (error) {
        console.error('Error loading settings:', error);
        hideLoadingIndicator('settingsContainer');
        showError('Failed to load settings: ' + error.message);
    }
}

/**
 * Load modules from the API
 */
async function loadModules() {
    try {
        showLoadingIndicator('modulesContainer', 'Loading modules...');

        const response = await fetch('/api/modules');

        if (!response.ok) {
            throw new Error(`Failed to load modules: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        currentModules = data.modules || [];

        renderModules();
        hideLoadingIndicator('modulesContainer');

        console.log('Modules loaded successfully:', currentModules.length, 'modules');
    } catch (error) {
        console.error('Error loading modules:', error);
        hideLoadingIndicator('modulesContainer');
        showError('Failed to load modules: ' + error.message);
    }
}

/**
 * Render settings form
 */
function renderSettings() {
    const container = document.getElementById('settingsContainer');
    if (!container) return;

    if (Object.keys(currentSettings).length === 0) {
        container.innerHTML = '<p class="empty-state">No settings available.</p>';
        return;
    }

    let html = '<form id="settingsForm" class="settings-form">';

    Object.entries(currentSettings).forEach(([key, setting]) => {
        html += renderSettingField(key, setting);
    });

    html += `
        <div class="form-actions">
            <button type="button" id="saveSettingsBtn" class="btn btn-primary" disabled>
                Save Settings
            </button>
            <button type="button" id="resetSettingsBtn" class="btn btn-secondary">
                Reset Changes
            </button>
        </div>
    `;

    html += '</form>';
    container.innerHTML = html;
}

/**
 * Render individual setting field
 */
function renderSettingField(key, setting) {
    const { value, type, description } = setting;
    const fieldId = `setting_${key}`;

    let inputHtml = '';

    switch (type) {
        case 'boolean':
            inputHtml = `
                <div class="toggle-container">
                    <input type="checkbox" id="${fieldId}" class="toggle-input"
                           ${value ? 'checked' : ''} data-setting-key="${key}">
                    <label for="${fieldId}" class="toggle-label">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            `;
            break;

        case 'number':
            inputHtml = `
                <input type="number" id="${fieldId}" class="form-input"
                       value="${value}" data-setting-key="${key}"
                       aria-describedby="${fieldId}_help">
            `;
            break;

        case 'json':
            inputHtml = `
                <textarea id="${fieldId}" class="form-textarea" rows="4"
                          data-setting-key="${key}"
                          aria-describedby="${fieldId}_help">${JSON.stringify(value, null, 2)}</textarea>
            `;
            break;

        default: // string
            inputHtml = `
                <input type="text" id="${fieldId}" class="form-input"
                       value="${escapeHtml(value)}" data-setting-key="${key}"
                       aria-describedby="${fieldId}_help">
            `;
    }

    return `
        <div class="form-group">
            <label for="${fieldId}" class="form-label">
                ${formatSettingName(key)}
            </label>
            ${inputHtml}
            ${description ? `<div id="${fieldId}_help" class="form-help">${escapeHtml(description)}</div>` : ''}
            <div id="${fieldId}_error" class="form-error" role="alert" aria-live="polite"></div>
        </div>
    `;
}

/**
 * Render modules management
 */
function renderModules() {
    const container = document.getElementById('modulesContainer');
    if (!container) return;

    if (currentModules.length === 0) {
        container.innerHTML = '<p class="empty-state">No modules available.</p>';
        return;
    }

    let html = '<div class="modules-list">';

    // Sort modules by display order
    const sortedModules = [...currentModules].sort((a, b) => a.display_order - b.display_order);

    sortedModules.forEach(module => {
        html += renderModuleCard(module);
    });

    html += '</div>';
    container.innerHTML = html;
}

/**
 * Render individual module card
 */
function renderModuleCard(module) {
    const canDisable = !module.is_default || currentModules.filter(m => m.enabled).length > 1;

    return `
        <div class="module-card" data-module-id="${module.module_id}">
            <div class="module-header">
                <div class="module-info">
                    <h3 class="module-name">${escapeHtml(module.name)}</h3>
                    <p class="module-description">${escapeHtml(module.description || '')}</p>
                    ${module.is_default ? '<span class="module-badge">Default</span>' : ''}
                </div>
                <div class="module-toggle">
                    <input type="checkbox" id="module_${module.module_id}"
                           class="toggle-input module-toggle-input"
                           ${module.enabled ? 'checked' : ''}
                           ${!canDisable ? 'disabled' : ''}
                           data-module-id="${module.module_id}">
                    <label for="module_${module.module_id}" class="toggle-label">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
            <div class="module-details">
                <div class="module-meta">
                    <span>Order: ${module.display_order}</span>
                    <span>Route: ${escapeHtml(module.route || 'N/A')}</span>
                </div>
                ${!canDisable ? '<div class="module-constraint">Cannot disable: Required module</div>' : ''}
            </div>
        </div>
    `;
}

/**
 * Initialize event listeners
 */
function initializeEventListeners() {
    // Settings form listeners
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        // Listen for input changes
        settingsForm.addEventListener('input', handleSettingChange);
        settingsForm.addEventListener('change', handleSettingChange);

        // Save button
        const saveBtn = document.getElementById('saveSettingsBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', saveSettings);
        }

        // Reset button
        const resetBtn = document.getElementById('resetSettingsBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', resetSettings);
        }
    }

    // Module toggle listeners
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('module-toggle-input')) {
            handleModuleToggle(e.target);
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl+S or Cmd+S to save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (hasUnsavedChanges) {
                saveSettings();
            }
        }

        // Escape to reset
        if (e.key === 'Escape' && hasUnsavedChanges) {
            resetSettings();
        }
    });

    // Warn before leaving with unsaved changes
    window.addEventListener('beforeunload', function(e) {
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            return e.returnValue;
        }
    });
}

/**
 * Handle setting value changes
 */
function handleSettingChange(e) {
    const input = e.target;
    const settingKey = input.dataset.settingKey;

    if (!settingKey) return;

    // Clear any existing validation errors
    clearFieldError(input);

    // Get the current value based on input type
    let newValue;

    if (input.type === 'checkbox') {
        newValue = input.checked;
    } else if (input.type === 'number') {
        newValue = parseFloat(input.value);
        if (isNaN(newValue)) {
            showFieldError(input, 'Please enter a valid number');
            return;
        }
    } else if (input.classList.contains('form-textarea')) {
        // JSON textarea
        try {
            newValue = JSON.parse(input.value);
        } catch (error) {
            showFieldError(input, 'Invalid JSON format');
            return;
        }
    } else {
        newValue = input.value;
    }

    // Validate the setting value
    if (!validateSettingValue(settingKey, newValue, currentSettings[settingKey])) {
        return; // Validation error already shown
    }

    // Update the current settings
    if (currentSettings[settingKey]) {
        currentSettings[settingKey].value = newValue;
    }

    // Mark as having unsaved changes
    hasUnsavedChanges = true;
    updateUnsavedChangesIndicator();

    // Schedule auto-save
    scheduleAutoSave();

    console.log('Setting changed:', settingKey, '=', newValue);
}

/**
 * Handle module toggle
 */
async function handleModuleToggle(toggleInput) {
    const moduleId = toggleInput.dataset.moduleId;
    const enabled = toggleInput.checked;

    // Find the module
    const module = currentModules.find(m => m.module_id === moduleId);
    if (!module) {
        showError('Module not found');
        return;
    }

    // Check if we can disable this module
    if (!enabled && module.is_default) {
        const enabledCount = currentModules.filter(m => m.enabled).length;
        if (enabledCount <= 1) {
            showError('Cannot disable the last enabled module');
            toggleInput.checked = true; // Revert the change
            return;
        }
    }

    try {
        // Show loading state
        toggleInput.disabled = true;
        showLoadingMessage('Updating module...');

        // Make API call with optimistic UI update
        const originalEnabled = module.enabled;
        module.enabled = enabled; // Optimistic update

        const response = await fetch(`/api/modules/${moduleId}/toggle`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ enabled })
        });

        if (!response.ok) {
            // Revert optimistic update
            module.enabled = originalEnabled;
            toggleInput.checked = originalEnabled;

            const error = await response.json();
            throw new Error(error.error || 'Failed to toggle module');
        }

        const result = await response.json();

        // Update module data with server response
        Object.assign(module, result.module);

        showSuccess(`Module ${enabled ? 'enabled' : 'disabled'} successfully`);

        // Announce change to screen readers
        announceToScreenReader(`Module ${module.name} ${enabled ? 'enabled' : 'disabled'}`);

    } catch (error) {
        console.error('Error toggling module:', error);
        showError('Failed to toggle module: ' + error.message);

        // Revert the toggle
        toggleInput.checked = !enabled;

    } finally {
        toggleInput.disabled = false;
        hideLoadingMessage();
    }
}

/**
 * Save settings to the API
 */
async function saveSettings() {
    if (isLoading || !hasUnsavedChanges) return;

    try {
        isLoading = true;

        // Show loading state
        const saveBtn = document.getElementById('saveSettingsBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
        }

        showLoadingMessage('Saving settings...');

        // Prepare settings data for API
        const settingsToSave = {};
        Object.entries(currentSettings).forEach(([key, setting]) => {
            settingsToSave[key] = setting.value;
        });

        const response = await fetch('/api/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ settings: settingsToSave })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save settings');
        }

        const result = await response.json();

        // Mark as saved
        hasUnsavedChanges = false;
        updateUnsavedChangesIndicator();

        // Clear auto-save timeout
        if (autoSaveTimeout) {
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = null;
        }

        showSuccess(`Settings saved successfully! Updated: ${result.updated.join(', ')}`);

        // Announce to screen readers
        announceToScreenReader('Settings saved successfully');

    } catch (error) {
        console.error('Error saving settings:', error);
        showError('Failed to save settings: ' + error.message);

    } finally {
        isLoading = false;
        hideLoadingMessage();

        // Restore save button
        const saveBtn = document.getElementById('saveSettingsBtn');
        if (saveBtn) {
            saveBtn.disabled = !hasUnsavedChanges;
            saveBtn.textContent = 'Save Settings';
        }
    }
}

/**
 * Reset settings to original values
 */
async function resetSettings() {
    if (!hasUnsavedChanges) return;

    if (!confirm('Are you sure you want to discard all unsaved changes?')) {
        return;
    }

    try {
        showLoadingMessage('Resetting settings...');

        // Reload settings from server
        await loadSettings();

        hasUnsavedChanges = false;
        updateUnsavedChangesIndicator();

        // Clear auto-save timeout
        if (autoSaveTimeout) {
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = null;
        }

        showSuccess('Settings reset successfully');
        announceToScreenReader('Settings reset to saved values');

    } catch (error) {
        console.error('Error resetting settings:', error);
        showError('Failed to reset settings: ' + error.message);
    } finally {
        hideLoadingMessage();
    }
}

/**
 * Schedule auto-save with debouncing
 */
function scheduleAutoSave() {
    // Clear existing timeout
    if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
    }

    // Schedule new auto-save
    autoSaveTimeout = setTimeout(() => {
        if (hasUnsavedChanges && !isLoading) {
            console.log('Auto-saving settings...');
            saveSettings();
        }
    }, AUTO_SAVE_DELAY);
}

/**
 * Validate setting value
 */
function validateSettingValue(key, value, settingConfig) {
    const input = document.querySelector(`[data-setting-key="${key}"]`);

    if (!settingConfig) {
        showFieldError(input, 'Unknown setting');
        return false;
    }

    const { type } = settingConfig;

    // Type-specific validation
    switch (type) {
        case 'string':
            if (typeof value !== 'string') {
                showFieldError(input, 'Must be a text value');
                return false;
            }
            break;

        case 'number':
            if (typeof value !== 'number' || isNaN(value)) {
                showFieldError(input, 'Must be a valid number');
                return false;
            }
            break;

        case 'boolean':
            if (typeof value !== 'boolean') {
                showFieldError(input, 'Must be true or false');
                return false;
            }
            break;

        case 'json':
            if (typeof value !== 'object') {
                showFieldError(input, 'Must be valid JSON');
                return false;
            }
            break;
    }

    // Additional validation rules can be added here
    // For example, checking value ranges, patterns, etc.

    return true;
}

/**
 * Update unsaved changes indicator
 */
function updateUnsavedChangesIndicator() {
    const saveBtn = document.getElementById('saveSettingsBtn');
    if (saveBtn) {
        saveBtn.disabled = !hasUnsavedChanges || isLoading;
    }

    // Update page title if there are unsaved changes
    const title = document.title;
    if (hasUnsavedChanges && !title.startsWith('*')) {
        document.title = '* ' + title;
    } else if (!hasUnsavedChanges && title.startsWith('*')) {
        document.title = title.substring(2);
    }
}

/**
 * Utility Functions
 */

function showLoadingIndicator(containerId, message = 'Loading...') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="loading-indicator">
                <div class="loading-spinner"></div>
                <div class="loading-text">${escapeHtml(message)}</div>
            </div>
        `;
    }
}

function hideLoadingIndicator(containerId) {
    // This will be called after the content is rendered
}

function showLoadingMessage(message) {
    // Show a temporary loading message
    showMessage(message, 'info', 2000);
}

function hideLoadingMessage() {
    // Loading messages auto-hide
}

function showSuccess(message) {
    showMessage(message, 'success', 5000);
}

function showError(message) {
    showMessage(message, 'error', 10000);
}

function showMessage(message, type = 'info', duration = 5000) {
    // Create or update message container
    let messageContainer = document.getElementById('messageContainer');
    if (!messageContainer) {
        messageContainer = document.createElement('div');
        messageContainer.id = 'messageContainer';
        messageContainer.className = 'message-container';
        document.body.appendChild(messageContainer);
    }

    const messageId = 'msg_' + Date.now();
    const messageElement = document.createElement('div');
    messageElement.id = messageId;
    messageElement.className = `message message-${type}`;
    messageElement.setAttribute('role', type === 'error' ? 'alert' : 'status');
    messageElement.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

    messageElement.innerHTML = `
        <div class="message-content">
            <span class="message-text">${escapeHtml(message)}</span>
            <button class="message-close" onclick="closeMessage('${messageId}')" aria-label="Close message">×</button>
        </div>
    `;

    messageContainer.appendChild(messageElement);

    // Auto-hide after duration
    if (duration > 0) {
        setTimeout(() => {
            closeMessage(messageId);
        }, duration);
    }
}

function closeMessage(messageId) {
    const message = document.getElementById(messageId);
    if (message) {
        message.remove();
    }
}

function showFieldError(input, message) {
    const errorElement = document.getElementById(input.id + '_error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }

    input.classList.add('error');
    input.setAttribute('aria-invalid', 'true');
}

function clearFieldError(input) {
    const errorElement = document.getElementById(input.id + '_error');
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }

    input.classList.remove('error');
    input.removeAttribute('aria-invalid');
}

function announceToScreenReader(message) {
    // Create a temporary element for screen reader announcements
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => {
        document.body.removeChild(announcement);
    }, 1000);
}

function formatSettingName(key) {
    // Convert snake_case to Title Case
    return key
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Export functions for testing (if in a module environment)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadSettings,
        loadModules,
        saveSettings,
        resetSettings,
        handleSettingChange,
        handleModuleToggle,
        validateSettingValue,
        formatSettingName,
        escapeHtml
    };
}