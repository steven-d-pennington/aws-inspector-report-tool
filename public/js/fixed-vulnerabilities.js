/**
 * Fixed Vulnerabilities Page JavaScript
 * Handles filtering, pagination, and display of fixed vulnerabilities
 */

class FixedVulnerabilitiesManager {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 50;
        this.totalItems = 0;
        this.currentFilters = {};
        this.isLoading = false;

        this.initializeElements();
        this.bindEvents();
        this.loadFiltersFromStorage();
        this.loadData();
    }

    initializeElements() {
        // Form elements
        this.filtersForm = document.getElementById('fixedVulnerabilityFilters');
        this.severitySelect = document.getElementById('severity');
        this.fixedAfterInput = document.getElementById('fixedAfter');
        this.fixedBeforeInput = document.getElementById('fixedBefore');
        this.resourceTypeSelect = document.getElementById('resourceType');
        this.resourceIdInput = document.getElementById('resourceId');

        // Control elements
        this.clearFiltersBtn = document.getElementById('clearFilters');
        this.exportResultsBtn = document.getElementById('exportResults');
        this.retryLoadBtn = document.getElementById('retryLoad');

        // Display elements
        this.loadingState = document.getElementById('loadingState');
        this.errorState = document.getElementById('errorState');
        this.errorMessage = document.getElementById('errorMessage');
        this.summarySection = document.getElementById('summarySection');
        this.resultsSection = document.getElementById('resultsSection');
        this.emptyState = document.getElementById('emptyState');

        // Result elements
        this.cardsContainer = document.getElementById('fixedVulnerabilitiesList');
        this.resultsInfo = document.getElementById('resultsInfo');
        this.pageInfo = document.getElementById('pageInfo');
        this.prevPageBtn = document.getElementById('prevPage');
        this.nextPageBtn = document.getElementById('nextPage');
        this.expandAllBtn = document.getElementById('expandAllCards');
        this.collapseAllBtn = document.getElementById('collapseAllCards');

        // Summary elements
        this.totalFixedEl = document.getElementById('totalFixed');
        this.avgDaysActiveEl = document.getElementById('avgDaysActive');
        this.criticalFixedEl = document.getElementById('criticalFixed');
        this.highFixedEl = document.getElementById('highFixed');
        this.mediumFixedEl = document.getElementById('mediumFixed');
        this.lowFixedEl = document.getElementById('lowFixed');

        // Modal elements
        this.historyModal = document.getElementById('historyModal');
        this.closeHistoryModalBtn = document.getElementById('closeHistoryModal');
        this.historyContent = document.getElementById('historyContent');
    }

    bindEvents() {
        // Form submission
        this.filtersForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.applyFilters();
        });

        // Clear filters
        this.clearFiltersBtn.addEventListener('click', () => {
            this.clearFilters();
        });

        // Export results
        this.exportResultsBtn.addEventListener('click', () => {
            this.exportResults();
        });

        // Retry loading
        this.retryLoadBtn.addEventListener('click', () => {
            this.loadData();
        });

        // Pagination
        this.prevPageBtn.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.loadData();
            }
        });

        this.nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(this.totalItems / this.pageSize);
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.loadData();
            }
        });

        if (this.expandAllBtn) {
            this.expandAllBtn.addEventListener('click', () => this.expandAllCards());
        }

        if (this.collapseAllBtn) {
            this.collapseAllBtn.addEventListener('click', () => this.collapseAllCards());
        }

        // Modal close
        this.closeHistoryModalBtn.addEventListener('click', () => {
            this.closeHistoryModal();
        });

        // Close modal on outside click
        this.historyModal.addEventListener('click', (e) => {
            if (e.target === this.historyModal) {
                this.closeHistoryModal();
            }
        });

        // Auto-save filters
        ['severity', 'fixedAfter', 'fixedBefore', 'resourceType', 'resourceId'].forEach(filterId => {
            const element = document.getElementById(filterId);
            element.addEventListener('change', () => {
                this.saveFiltersToStorage();
            });
        });
    }

    applyFilters() {
        this.currentPage = 1;
        this.loadData();
        this.saveFiltersToStorage();
    }

    clearFilters() {
        this.severitySelect.value = '';
        this.fixedAfterInput.value = '';
        this.fixedBeforeInput.value = '';
        this.resourceTypeSelect.value = '';
        this.resourceIdInput.value = '';

        this.currentPage = 1;
        this.loadData();
        this.saveFiltersToStorage();
    }

    getCurrentFilters() {
        const filters = {};

        if (this.severitySelect.value) {
            filters.severity = this.severitySelect.value;
        }

        if (this.fixedAfterInput.value) {
            filters.fixedAfter = this.fixedAfterInput.value;
        }

        if (this.fixedBeforeInput.value) {
            filters.fixedBefore = this.fixedBeforeInput.value;
        }

        if (this.resourceTypeSelect.value) {
            filters.resourceType = this.resourceTypeSelect.value;
        }

        if (this.resourceIdInput.value) {
            filters.resourceId = this.resourceIdInput.value.trim();
        }

        return filters;
    }

    async loadData() {
        if (this.isLoading) return;

        this.isLoading = true;
        this.showLoadingState();

        try {
            const filters = this.getCurrentFilters();
            filters.limit = this.pageSize;
            filters.offset = (this.currentPage - 1) * this.pageSize;

            const queryParams = new URLSearchParams(filters).toString();
            const response = await fetch(`/api/fixed-vulnerabilities?${queryParams}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.displayData(data);

        } catch (error) {
            console.error('Failed to load fixed vulnerabilities:', error);
            this.showErrorState(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    displayData(data) {
        this.hideAllStates();

        if (data.data.length === 0) {
            if (this.cardsContainer) {
                this.cardsContainer.innerHTML = '';
            }
            this.updateCardControlsState(0);
            this.showEmptyState();
            return;
        }

        this.totalItems = data.pagination.total;
        this.updateSummary(data.summary);
        this.renderCards(data.data);
        this.updatePagination(data.pagination);
        this.updateCardControlsState(data.data.length);

        this.summarySection.style.display = 'block';
        this.resultsSection.style.display = 'block';
    }

    updateSummary(summary) {
        this.totalFixedEl.textContent = summary.total_fixed || 0;
        this.avgDaysActiveEl.textContent = summary.avg_days_active || 0;
        this.criticalFixedEl.textContent = summary.critical_fixed || 0;
        this.highFixedEl.textContent = summary.high_fixed || 0;
        this.mediumFixedEl.textContent = summary.medium_fixed || 0;
        this.lowFixedEl.textContent = summary.low_fixed || 0;
    }

    renderCards(vulnerabilities) {
        if (!this.cardsContainer) {
            return;
        }

        this.cardsContainer.innerHTML = '';

        vulnerabilities.forEach((vuln, index) => {
            const severity = (vuln.severity || 'unknown').toLowerCase();
            const card = document.createElement('div');
            card.className = `vulnerability-card ${severity} collapsed`;
            card.dataset.cardId = String(index);

            const titleText = this.escapeHtml(vuln.title || vuln.vulnerability_id || 'Unknown vulnerability');
            const identifier = vuln.vulnerability_id ? this.escapeHtml(vuln.vulnerability_id) : null;
            const severityLabel = this.escapeHtml(vuln.severity || 'Unknown');
            const resourceCount = Array.isArray(vuln.affected_resources) ? vuln.affected_resources.length : 0;
            const resourceBadge = resourceCount > 0
                ? `<span class="resources-badge">${resourceCount} resource${resourceCount === 1 ? '' : 's'}</span>`
                : '';
            const displayFixedDate = this.getDisplayFixedDate(vuln);
            const firstObserved = vuln.first_observed_at ? this.formatDate(vuln.first_observed_at) : 'Unknown';
            const lastObserved = vuln.last_observed_at ? this.formatDate(vuln.last_observed_at) : 'Unknown';
            const reportRun = vuln.report_run_date ? this.formatDate(vuln.report_run_date) : 'Not available';
            const daysActive = typeof vuln.days_active === 'number'
                ? `${vuln.days_active} day${vuln.days_active === 1 ? '' : 's'}`
                : 'Unknown';
            const resolutionType = this.escapeHtml(vuln.resolution_type || 'Unknown');
            const fixVersion = this.escapeHtml(vuln.fix_version || 'N/A');
            const inspectorScore = vuln.inspector_score !== undefined && vuln.inspector_score !== null
                ? vuln.inspector_score
                : 'N/A';
            const epssScore = vuln.epss_score !== undefined && vuln.epss_score !== null
                ? vuln.epss_score
                : 'N/A';

            const resourceTypes = Array.isArray(vuln.resource_types) ? vuln.resource_types : [];
            const resourceTypeBadges = resourceTypes.length
                ? resourceTypes.map(type => `<span class="resource-type-badge">${this.escapeHtml(type)}</span>`).join(' ')
                : '';

            const resources = Array.isArray(vuln.affected_resources) ? vuln.affected_resources : [];
            let resourceListHtml = '';
            if (resources.length > 0) {
                const displayResources = resources.slice(0, 5);
                resourceListHtml = `
                    <div class="resource-list">
                        <h4>Affected Resources (${resources.length})</h4>
                        <ul>
                            ${displayResources.map(res => `<li><code>${this.escapeHtml(res)}</code></li>`).join('')}
                        </ul>
                        ${resources.length > 5 ? `<p class="more-resources">+${resources.length - 5} more</p>` : ''}
                    </div>
                `;
            }

            const findingArnAttr = this.escapeAttribute(vuln.finding_arn);
            const vulnerabilityIdAttr = this.escapeAttribute(vuln.vulnerability_id);

            card.innerHTML = `
                <div class="vuln-header" data-card-toggle>
                    <div class="vuln-title">
                        <h3>${titleText}</h3>
                        <span class="severity-badge severity-${severity}">${severityLabel}</span>
                        ${vuln.fix_was_available ? '<span class="fix-badge">Fix Available</span>' : ''}
                        ${resourceBadge}
                    </div>
                    <div class="expand-icon">
                        <span class="arrow">▼</span>
                    </div>
                </div>
                <div class="vuln-summary">
                    <div class="summary-grid">
                        ${identifier ? `<div class="summary-item"><span class="summary-label">Identifier</span><span class="summary-value"><code>${identifier}</code></span></div>` : ''}
                        <div class="summary-item"><span class="summary-label">Fixed Date</span><span class="summary-value">${displayFixedDate}</span></div>
                        <div class="summary-item"><span class="summary-label">Last Observed</span><span class="summary-value">${lastObserved}</span></div>
                        <div class="summary-item"><span class="summary-label">Days Active</span><span class="summary-value">${daysActive}</span></div>
                        <div class="summary-item"><span class="summary-label">Report Generated</span><span class="summary-value">${reportRun}</span></div>
                    </div>
                </div>
                <div class="vuln-content">
                    <div class="vuln-metadata">
                        ${identifier ? `<div class="metadata-item"><strong>Identifier:</strong> <code>${identifier}</code></div>` : ''}
                        <div class="metadata-item"><strong>Severity:</strong> ${severityLabel}</div>
                        <div class="metadata-item"><strong>Fixed Date:</strong> ${displayFixedDate}</div>
                        <div class="metadata-item"><strong>First Observed:</strong> ${firstObserved}</div>
                        <div class="metadata-item"><strong>Last Observed:</strong> ${lastObserved}</div>
                        <div class="metadata-item"><strong>Report Generated:</strong> ${reportRun}</div>
                        <div class="metadata-item"><strong>Days Active:</strong> ${daysActive}</div>
                        <div class="metadata-item"><strong>Resolution:</strong> ${resolutionType}</div>
                        <div class="metadata-item"><strong>Fix Version:</strong> ${fixVersion}</div>
                        <div class="metadata-item"><strong>Fix Available:</strong> ${vuln.fix_was_available ? 'Yes' : 'No'}</div>
                        <div class="metadata-item"><strong>Inspector Score:</strong> ${inspectorScore}</div>
                        <div class="metadata-item"><strong>EPSS Score:</strong> ${epssScore}</div>
                        ${resourceTypes.length ? `<div class="metadata-item full-width"><strong>Resource Types:</strong> <div class="resource-type-badges">${resourceTypeBadges}</div></div>` : ''}
                    </div>
                    ${resourceListHtml}
                    <div class="card-actions">
                        <button type="button" class="btn btn-small btn-history" data-finding-arn="${findingArnAttr}" data-vulnerability-id="${vulnerabilityIdAttr}">History</button>
                    </div>
                </div>
            `;

            const header = card.querySelector('[data-card-toggle]');
            if (header) {
                header.addEventListener('click', () => this.toggleCardElement(card));
            }

            const historyBtn = card.querySelector('.btn-history');
            if (historyBtn) {
                historyBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const target = event.currentTarget;
                    this.showHistory(target.dataset.findingArn, target.dataset.vulnerabilityId);
                });
            }

            this.cardsContainer.appendChild(card);
        });
    }

    toggleCardElement(card) {
        if (!card) return;

        if (card.classList.contains('collapsed')) {
            card.classList.remove('collapsed');
            card.classList.add('expanded');
        } else {
            card.classList.remove('expanded');
            card.classList.add('collapsed');
        }
    }

    expandAllCards() {
        if (!this.cardsContainer) return;
        this.cardsContainer.querySelectorAll('.vulnerability-card').forEach(card => {
            card.classList.remove('collapsed');
            card.classList.add('expanded');
        });
    }

    collapseAllCards() {
        if (!this.cardsContainer) return;
        this.cardsContainer.querySelectorAll('.vulnerability-card').forEach(card => {
            card.classList.remove('expanded');
            card.classList.add('collapsed');
        });
    }

    updateCardControlsState(count) {
        const disabled = count === 0;
        if (this.expandAllBtn) {
            this.expandAllBtn.disabled = disabled;
        }
        if (this.collapseAllBtn) {
            this.collapseAllBtn.disabled = disabled;
        }
    }

    getDisplayFixedDate(vuln) {
        const parseDateValue = (value) => {
            if (!value) return null;
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        };

        const fixedDateValue = parseDateValue(vuln.fixed_date);
        const lastObservedValue = parseDateValue(vuln.last_observed_at);

        let selectedRaw = vuln.fixed_date || null;
        if (lastObservedValue && (!fixedDateValue || lastObservedValue < fixedDateValue)) {
            selectedRaw = vuln.last_observed_at;
        }

        return selectedRaw ? this.formatDate(selectedRaw) : 'Unknown';
    }

    updatePagination(pagination) {
        const totalPages = Math.ceil(pagination.total / pagination.limit);

        this.resultsInfo.textContent =
            `Showing ${pagination.offset + 1}-${Math.min(pagination.offset + pagination.limit, pagination.total)} of ${pagination.total} results`;

        this.pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;

        this.prevPageBtn.disabled = this.currentPage <= 1;
        this.nextPageBtn.disabled = !pagination.has_more;
    }

    async showHistory(findingArn, vulnerabilityId) {
        this.historyModal.style.display = 'flex';
        this.historyContent.innerHTML = `
            <div class="loading-spinner"></div>
            <p>Loading vulnerability history...</p>
        `;

        try {
            const params = new URLSearchParams();
            const normalizedArn = (findingArn || '').trim();
            const normalizedVulnerabilityId = (vulnerabilityId || '').trim();

            if (normalizedArn) {
                params.set('findingArn', normalizedArn);
            } else if (normalizedVulnerabilityId) {
                params.set('vulnerabilityId', normalizedVulnerabilityId);
            } else {
                throw new Error('History lookup requires a finding ARN or vulnerability ID');
            }

            // Include resource ID filter if it's currently active
            if (this.resourceIdInput && this.resourceIdInput.value) {
                params.set('resourceId', this.resourceIdInput.value.trim());
            }

            // Include resource type filter when active so history respects current filters
            if (this.resourceTypeSelect && this.resourceTypeSelect.value) {
                params.set('resourceType', this.resourceTypeSelect.value);
            }

            const response = await fetch(`/api/vulnerability-history?${params.toString()}`);

            if (!response.ok) {
                let message = `HTTP ${response.status}`;
                try {
                    const errorBody = await response.json();
                    if (errorBody && errorBody.message) {
                        message = errorBody.message;
                    }
                } catch (jsonError) {
                    // Ignore JSON parse errors and fall back to the default message
                }
                throw new Error(message);
            }

            const timeline = await response.json();
            this.displayHistory(timeline);

        } catch (error) {
            console.error('Failed to load vulnerability history:', error);
            this.historyContent.innerHTML = `
                <div class="error-message">
                    <h4>Failed to load history</h4>
                    <p>${this.escapeHtml(error.message)}</p>
                </div>
            `;
        }
    }
    displayHistory(timeline) {
        const identifierLabel = this.escapeHtml(timeline.finding_arn || timeline.vulnerability_id || 'Unknown vulnerability');
        const statusLabel = (timeline.current_status || 'UNKNOWN').toUpperCase();
        const statusClass = `status-${statusLabel.toLowerCase()}`;
        const historyEntries = Array.isArray(timeline.history) ? timeline.history : [];

        let historyHtml = `
            <div class="vulnerability-timeline">
                <div class="timeline-header">
                    <h4>Identifier: ${identifierLabel}</h4>
                    <p class="current-status">Current Status: <span class="${statusClass}">${statusLabel}</span></p>
                </div>
                <div class="timeline-items">
        `;

        if (historyEntries.length === 0) {
            historyHtml += '<p>No historical data available for this vulnerability.</p>';
        } else {
            historyEntries.forEach((record) => {
                const severityLabel = (record.severity || 'unknown').toLowerCase();
                historyHtml += `
                    <div class="timeline-item">
                        <div class="timeline-marker"></div>
                        <div class="timeline-content">
                            <div class="timeline-date">${this.formatDate(record.archived_at)}</div>
                            <div class="timeline-details">
                                <h5>${this.escapeHtml(record.title || 'Unknown Title')}</h5>
                                <div class="detail-row">
                                    <span class="detail-label">Severity:</span>
                                    <span class="severity-badge severity-${severityLabel}">
                                        ${record.severity || 'Unknown'}
                                    </span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Status:</span>
                                    <span>${this.escapeHtml(record.status || 'Unknown')}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Fix Available:</span>
                                    <span>${this.escapeHtml(record.fix_available || 'Unknown')}</span>
                                </div>
                                ${record.inspector_score ? `
                                    <div class="detail-row">
                                        <span class="detail-label">Inspector Score:</span>
                                        <span>${record.inspector_score}</span>
                                    </div>
                                ` : ''}
                                ${record.resources && record.resources.length ? `
                                    <div class="detail-row">
                                        <span class="detail-label">Resources:</span>
                                        <span>${this.escapeHtml(record.resources.map(r => r.resource_identifier || r.resource_type || '').filter(Boolean).join(', '))}</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        historyHtml += `
                </div>
            </div>
        `;

        this.historyContent.innerHTML = historyHtml;
    }
    closeHistoryModal() {
        this.historyModal.style.display = 'none';
    }

    async exportResults() {
        try {
            const filters = this.getCurrentFilters();
            filters.limit = 10000; // Get all results for export
            filters.offset = 0;

            const queryParams = new URLSearchParams(filters).toString();
            const response = await fetch(`/api/fixed-vulnerabilities?${queryParams}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.downloadCSV(data.data);

        } catch (error) {
            console.error('Failed to export results:', error);
            alert('Failed to export results: ' + error.message);
        }
    }

    downloadCSV(vulnerabilities) {
        const headers = [
            'Vulnerability ID', 'Title', 'Severity', 'Affected Resources',
            'Resource Types', 'First Observed', 'Report Generated', 'Fixed Date', 'Days Active', 'Fix Available'
        ];

        const rows = vulnerabilities.map(vuln => [
            vuln.vulnerability_id || '',
            (vuln.title || '').replace(/"/g, '""'),
            vuln.severity || '',
            (vuln.affected_resources || []).join('; '),
            (vuln.resource_types || []).join('; '),
            vuln.first_observed_at || '',
            vuln.report_run_date || '',
            vuln.fixed_date || '',
            vuln.days_active || '',
            vuln.fix_was_available ? 'Yes' : 'No'
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(field => `"${field}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `fixed-vulnerabilities-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }

    saveFiltersToStorage() {
        const filters = this.getCurrentFilters();
        localStorage.setItem('fixedVulnerabilityFilters', JSON.stringify(filters));
    }

    loadFiltersFromStorage() {
        try {
            const stored = localStorage.getItem('fixedVulnerabilityFilters');
            if (stored) {
                const filters = JSON.parse(stored);

                if (filters.severity) this.severitySelect.value = filters.severity;
                if (filters.fixedAfter) this.fixedAfterInput.value = filters.fixedAfter;
                if (filters.fixedBefore) this.fixedBeforeInput.value = filters.fixedBefore;
                if (filters.resourceType && this.resourceTypeSelect) {
                    const optionExists = Array.from(this.resourceTypeSelect.options)
                        .some(option => option.value === filters.resourceType);

                    if (optionExists) {
                        this.resourceTypeSelect.value = filters.resourceType;
                    } else {
                        delete filters.resourceType;
                        localStorage.setItem('fixedVulnerabilityFilters', JSON.stringify(filters));
                    }
                }
                if (filters.resourceId) this.resourceIdInput.value = filters.resourceId;
            }
        } catch (error) {
            console.warn('Failed to load filters from storage:', error);
        }
    }

    showLoadingState() {
        this.hideAllStates();
        this.loadingState.style.display = 'block';
    }

    showErrorState(message) {
        this.hideAllStates();
        this.errorMessage.textContent = message;
        this.errorState.style.display = 'block';
    }

    showEmptyState() {
        this.hideAllStates();
        this.emptyState.style.display = 'block';
    }

    hideAllStates() {
        this.loadingState.style.display = 'none';
        this.errorState.style.display = 'none';
        this.summarySection.style.display = 'none';
        this.resultsSection.style.display = 'none';
        this.emptyState.style.display = 'none';
    }

    formatDate(dateString) {
        if (!dateString) return 'Unknown';

        try {
            const date = new Date(dateString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateString;
        }
    }

    formatResourceTypes(types) {
        if (!types || types.length === 0) return '';

        const uniqueTypes = [...new Set(types)];
        if (uniqueTypes.length <= 2) {
            return `<div class="resource-types">${uniqueTypes.join(', ')}</div>`;
        }

        return `<div class="resource-types" title="${uniqueTypes.join(', ')}">${uniqueTypes[0]}, +${uniqueTypes.length - 1} more</div>`;
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    escapeAttribute(value) {
        if (value === undefined || value === null) {
            return '';
        }
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the manager when the page loads
let fixedVulnManager;
document.addEventListener('DOMContentLoaded', () => {
    fixedVulnManager = new FixedVulnerabilitiesManager();
});
