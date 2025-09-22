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

        // Table elements
        this.tableBody = document.getElementById('vulnerabilitiesTableBody');
        this.resultsInfo = document.getElementById('resultsInfo');
        this.pageInfo = document.getElementById('pageInfo');
        this.prevPageBtn = document.getElementById('prevPage');
        this.nextPageBtn = document.getElementById('nextPage');

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
        ['severity', 'fixedAfter', 'fixedBefore', 'resourceType'].forEach(filterId => {
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
            this.showEmptyState();
            return;
        }

        this.totalItems = data.pagination.total;
        this.updateSummary(data.summary);
        this.updateTable(data.data);
        this.updatePagination(data.pagination);

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

    updateTable(vulnerabilities) {
        this.tableBody.innerHTML = '';

        vulnerabilities.forEach(vuln => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <span class="vulnerability-id">${this.escapeHtml(vuln.vulnerability_id || 'N/A')}</span>
                </td>
                <td>
                    <span class="vulnerability-title" title="${this.escapeHtml(vuln.title || 'No title')}">
                        ${this.truncateText(vuln.title || 'No title', 50)}
                    </span>
                </td>
                <td>
                    <span class="severity-badge severity-${(vuln.severity || 'unknown').toLowerCase()}">
                        ${vuln.severity || 'Unknown'}
                    </span>
                </td>
                <td>
                    <div class="resource-info">
                        <span class="resource-count">${(vuln.affected_resources || []).length} resource(s)</span>
                        ${this.formatResourceTypes(vuln.resource_types || [])}
                    </div>
                </td>
                <td>
                    <span class="date-text">
                        ${vuln.first_observed_at ? this.formatDate(vuln.first_observed_at) : 'Unknown'}
                    </span>
                </td>
                <td>
                    <span class="date-text" title="AWS Inspector report generation date">
                        ${vuln.report_run_date ? this.formatDate(vuln.report_run_date) : 'Not available'}
                    </span>
                </td>
                <td>
                    <span class="date-text" title="Date when vulnerability was detected as fixed">
                        ${this.formatDate(vuln.fixed_date)}
                    </span>
                </td>
                <td>
                    <span class="days-active">
                        ${vuln.days_active !== null ? vuln.days_active + ' days' : 'Unknown'}
                    </span>
                </td>
                <td>
                    <span class="fix-available ${vuln.fix_was_available ? 'yes' : 'no'}">
                        ${vuln.fix_was_available ? 'Yes' : 'No'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button type="button" class="btn btn-small btn-history"
                                onclick="fixedVulnManager.showHistory('${this.escapeAttribute(vuln.finding_arn)}', '${this.escapeAttribute(vuln.vulnerability_id)}')"
                                title="View vulnerability history">
                            History
                        </button>
                    </div>
                </td>
            `;
            this.tableBody.appendChild(row);
        });
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
                if (filters.resourceType) this.resourceTypeSelect.value = filters.resourceType;
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



