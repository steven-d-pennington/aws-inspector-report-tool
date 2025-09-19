// Settings page JavaScript functionality
// Handles database backup, clear operations, and system information

// Global state management
let currentOperationId = null;
let currentDownloadUrl = null;
let pollingInterval = null;

// Page initialization
document.addEventListener('DOMContentLoaded', function() {
    loadSystemInfo();
    checkOperationStatus();
});

// ============================================================================
// SYSTEM INFORMATION
// ============================================================================

async function loadSystemInfo() {
    try {
        const response = await fetch('/api/settings/system-info');
        if (response.ok) {
            const info = await response.json();
            document.getElementById('nodeVersion').textContent = info.nodeVersion || 'Unknown';
            document.getElementById('systemUptime').textContent = formatUptime(info.uptime || 0);
        }
    } catch (error) {
        console.error('Failed to load system info:', error);
        document.getElementById('nodeVersion').textContent = 'Error';
        document.getElementById('systemUptime').textContent = 'Error';
    }
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

// ============================================================================
// DATABASE BACKUP FUNCTIONALITY
// ============================================================================

async function createBackup() {
    const createBtn = document.getElementById('createBackupBtn');
    const progressSection = document.getElementById('backupProgress');
    const downloadSection = document.getElementById('downloadSection');

    // Reset UI state
    createBtn.disabled = true;
    createBtn.textContent = 'Creating...';
    progressSection.style.display = 'block';
    downloadSection.style.display = 'none';
    updateBackupStatus('Creating backup...');

    try {
        // Start backup operation
        const response = await fetch('/api/settings/backup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        currentOperationId = result.operationId;

        // Start polling for progress
        startProgressPolling('backup');

    } catch (error) {
        console.error('Backup creation failed:', error);
        showError('Failed to create backup', error.message);
        resetBackupUI();
    }
}

function updateBackupProgress(data) {
    const progressBar = document.getElementById('backupProgressBar');
    const percentage = document.getElementById('backupPercentage');
    const details = document.getElementById('backupDetails');

    progressBar.style.width = `${data.progress}%`;
    percentage.textContent = `${data.progress}%`;

    if (data.metadata && data.metadata.currentStep) {
        details.textContent = data.metadata.currentStep;
    }

    if (data.status === 'completed') {
        stopProgressPolling();
        showBackupComplete(data.downloadUrl);
    } else if (data.status === 'failed') {
        stopProgressPolling();
        showError('Backup failed', data.errorMessage || 'Unknown error occurred');
        resetBackupUI();
    }
}

function showBackupComplete(downloadUrl) {
    const progressSection = document.getElementById('backupProgress');
    const downloadSection = document.getElementById('downloadSection');

    progressSection.style.display = 'none';
    downloadSection.style.display = 'block';
    currentDownloadUrl = downloadUrl;

    updateBackupStatus('Backup completed');
    updateLastBackupTime();
    resetBackupUI();
}

function downloadBackup() {
    if (!currentDownloadUrl) {
        showError('Download Error', 'No backup file available for download');
        return;
    }

    // Create temporary link to trigger download
    const link = document.createElement('a');
    link.href = currentDownloadUrl;
    link.download = ''; // Let server determine filename
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function resetBackupUI() {
    const createBtn = document.getElementById('createBackupBtn');
    createBtn.disabled = false;
    createBtn.textContent = 'Create Backup';
}

function updateBackupStatus(status) {
    document.getElementById('backupStatus').textContent = status;
}

function updateLastBackupTime() {
    const now = new Date();
    document.getElementById('lastBackupTime').textContent = now.toLocaleString();
}

// ============================================================================
// DATABASE CLEAR FUNCTIONALITY
// ============================================================================

function showClearConfirmation() {
    document.getElementById('clearConfirmationModal').style.display = 'flex';
    goToStep1();
}

function hideClearConfirmation() {
    document.getElementById('clearConfirmationModal').style.display = 'none';
    resetConfirmationForm();
}

function goToStep1() {
    document.getElementById('step1').classList.add('active');
    document.getElementById('step2').classList.remove('active');
    document.getElementById('understandRisk').checked = false;
    validateStep1();
}

function goToStep2() {
    document.getElementById('step1').classList.remove('active');
    document.getElementById('step2').classList.add('active');
    document.getElementById('confirmationText').value = '';
    document.getElementById('confirmationText').focus();
    validateStep2();
}

function validateStep1() {
    const checkbox = document.getElementById('understandRisk');
    const nextBtn = document.getElementById('step1NextBtn');
    nextBtn.disabled = !checkbox.checked;
}

function validateStep2() {
    const input = document.getElementById('confirmationText');
    const validation = document.getElementById('confirmationValidation');
    const confirmBtn = document.getElementById('confirmClearBtn');

    const value = input.value.trim();
    const isValid = value === 'CONFIRM';

    if (value === '') {
        validation.textContent = '';
        validation.className = 'input-validation';
    } else if (isValid) {
        validation.textContent = '✓ Confirmation text is correct';
        validation.className = 'input-validation valid';
    } else {
        validation.textContent = '✗ Please type exactly "CONFIRM"';
        validation.className = 'input-validation invalid';
    }

    confirmBtn.disabled = !isValid;
}

async function performClear() {
    const confirmBtn = document.getElementById('confirmClearBtn');
    const progressSection = document.getElementById('clearProgress');

    // Disable button and show progress
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Clearing...';
    hideClearConfirmation();
    progressSection.style.display = 'block';

    try {
        // Start clear operation
        const response = await fetch('/api/settings/clear', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                confirmationText: 'CONFIRM'
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        currentOperationId = result.operationId;

        // Start polling for progress
        startProgressPolling('clear');

    } catch (error) {
        console.error('Clear operation failed:', error);
        showError('Failed to clear database', error.message);
        resetClearUI();
    }
}

function updateClearProgress(data) {
    const progressBar = document.getElementById('clearProgressBar');
    const percentage = document.getElementById('clearPercentage');
    const details = document.getElementById('clearDetails');

    progressBar.style.width = `${data.progress}%`;
    percentage.textContent = `${data.progress}%`;

    if (data.metadata && data.metadata.currentStep) {
        details.textContent = data.metadata.currentStep;
    }

    if (data.status === 'completed') {
        stopProgressPolling();
        showClearComplete(data.metadata);
    } else if (data.status === 'failed') {
        stopProgressPolling();
        showError('Clear operation failed', data.errorMessage || 'Unknown error occurred');
        resetClearUI();
    }
}

function showClearComplete(metadata) {
    const progressSection = document.getElementById('clearProgress');
    const successSection = document.getElementById('clearSuccess');

    progressSection.style.display = 'none';
    successSection.style.display = 'block';

    resetClearUI();
}

function resetClearUI() {
    const clearBtn = document.getElementById('clearDatabaseBtn');
    clearBtn.disabled = false;
    clearBtn.textContent = 'Clear Database';
    resetConfirmationForm();
}

function resetConfirmationForm() {
    document.getElementById('understandRisk').checked = false;
    document.getElementById('confirmationText').value = '';
    document.getElementById('confirmationValidation').textContent = '';
    document.getElementById('confirmationValidation').className = 'input-validation';
    validateStep1();
    validateStep2();
}

// ============================================================================
// PROGRESS POLLING
// ============================================================================

function startProgressPolling(operationType) {
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }

    pollingInterval = setInterval(async () => {
        if (!currentOperationId) {
            stopProgressPolling();
            return;
        }

        try {
            const endpoint = operationType === 'backup'
                ? `/api/settings/backup/status/${currentOperationId}`
                : `/api/settings/clear/status/${currentOperationId}`;

            const response = await fetch(endpoint);

            if (response.ok) {
                const data = await response.json();

                if (operationType === 'backup') {
                    updateBackupProgress(data);
                } else {
                    updateClearProgress(data);
                }

                // Stop polling if operation is complete or failed
                if (data.status === 'completed' || data.status === 'failed') {
                    stopProgressPolling();
                }
            } else {
                console.error('Failed to get operation status:', response.statusText);
                stopProgressPolling();
                showError('Status Check Failed', 'Unable to check operation status');
            }
        } catch (error) {
            console.error('Error polling operation status:', error);
            stopProgressPolling();
            showError('Status Check Error', error.message);
        }
    }, 1000); // Poll every second
}

function stopProgressPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    currentOperationId = null;
}

function checkOperationStatus() {
    // Check if there's an ongoing operation from a previous session
    // This would be implemented if we stored operation state in localStorage
    // For now, we'll start fresh each time
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

function showError(title, message, details = null) {
    document.getElementById('errorMessage').textContent = message;

    const errorDetails = document.getElementById('errorDetails');
    if (details) {
        errorDetails.textContent = details;
        errorDetails.style.display = 'block';
    } else {
        errorDetails.style.display = 'none';
    }

    document.getElementById('errorModal').style.display = 'flex';
}

function hideErrorModal() {
    document.getElementById('errorModal').style.display = 'none';
}

// ============================================================================
// MODAL MANAGEMENT
// ============================================================================

// Close modals when clicking outside
window.addEventListener('click', function(event) {
    const clearModal = document.getElementById('clearConfirmationModal');
    const errorModal = document.getElementById('errorModal');

    if (event.target === clearModal) {
        hideClearConfirmation();
    } else if (event.target === errorModal) {
        hideErrorModal();
    }
});

// Handle escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        hideClearConfirmation();
        hideErrorModal();
    }
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(seconds) {
    if (seconds < 60) {
        return `${seconds}s`;
    } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }
}