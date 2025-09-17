// Filter persistence and management
function saveFiltersToStorage() {
    const form = document.getElementById('filterForm');
    const formData = new FormData(form);
    const filters = {};

    for (let [key, value] of formData.entries()) {
        if (value && value.trim() !== '') {
            filters[key] = value;
        }
    }

    localStorage.setItem('vulnerabilityFilters', JSON.stringify(filters));
}

function loadFiltersFromStorage() {
    try {
        const stored = localStorage.getItem('vulnerabilityFilters');
        if (stored) {
            const filters = JSON.parse(stored);
            const form = document.getElementById('filterForm');

            // Apply stored filters to form fields
            Object.keys(filters).forEach(key => {
                const field = form.querySelector(`[name="${key}"]`);
                if (field) {
                    field.value = filters[key];
                }
            });
        }
    } catch (error) {
        console.error('Error loading filters from storage:', error);
    }
}

function clearFilters() {
    document.getElementById('filterForm').reset();
    localStorage.removeItem('vulnerabilityFilters');
    window.location.href = '/vulnerabilities';
}

function updateSelection() {
    const checkboxes = document.querySelectorAll('.vuln-checkbox:checked');
    const count = checkboxes.length;

    document.getElementById('selectedCount').textContent = count;
    document.getElementById('selectedCount2').textContent = count;

    document.getElementById('exportPdfBtn').disabled = count === 0;
    document.getElementById('exportNotionBtn').disabled = count === 0;
}

function selectAll() {
    const checkboxes = document.querySelectorAll('.vuln-checkbox');
    checkboxes.forEach(cb => cb.checked = true);
    updateSelection();
}

function deselectAll() {
    const checkboxes = document.querySelectorAll('.vuln-checkbox');
    checkboxes.forEach(cb => cb.checked = false);
    updateSelection();
}

async function exportPDF() {
    const selectedIds = getSelectedIds();

    if (selectedIds.length === 0) {
        alert('Please select vulnerabilities to export');
        return;
    }

    try {
        const response = await fetch('/api/export/pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ vulnerabilityIds: selectedIds })
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vulnerability-report-${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            alert('Error generating PDF');
        }
    } catch (error) {
        alert('Error exporting PDF: ' + error.message);
    }
}

async function exportNotion() {
    const selectedIds = getSelectedIds();

    if (selectedIds.length === 0) {
        alert('Please select vulnerabilities to export');
        return;
    }

    try {
        const response = await fetch('/api/export/notion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ vulnerabilityIds: selectedIds })
        });

        if (response.ok) {
            const result = await response.json();
            document.getElementById('notionText').value = result.content;
            document.getElementById('notionModal').style.display = 'flex';
        } else {
            alert('Error generating Notion export');
        }
    } catch (error) {
        alert('Error exporting for Notion: ' + error.message);
    }
}

function getSelectedIds() {
    const checkboxes = document.querySelectorAll('.vuln-checkbox:checked');
    return Array.from(checkboxes).map(cb => parseInt(cb.value));
}

function closeNotionModal() {
    document.getElementById('notionModal').style.display = 'none';
}

function copyNotion() {
    const textarea = document.getElementById('notionText');
    textarea.select();
    textarea.setSelectionRange(0, 99999); // For mobile devices

    try {
        document.execCommand('copy');
        alert('Copied to clipboard! You can now paste this into Notion.');
    } catch (err) {
        alert('Failed to copy text. Please select and copy manually.');
    }
}

// Close modal when clicking outside of it
window.onclick = function(event) {
    const modal = document.getElementById('notionModal');
    if (event.target === modal) {
        closeNotionModal();
    }
}

// Expand/Collapse functionality
function toggleCard(cardIndex) {
    const card = document.querySelector(`[data-card-id="${cardIndex}"]`);
    if (card.classList.contains('collapsed')) {
        card.classList.remove('collapsed');
        card.classList.add('expanded');
    } else {
        card.classList.remove('expanded');
        card.classList.add('collapsed');
    }
}

function expandAll() {
    const cards = document.querySelectorAll('.vulnerability-card');
    cards.forEach(card => {
        card.classList.remove('collapsed');
        card.classList.add('expanded');
    });
}

function collapseAll() {
    const cards = document.querySelectorAll('.vulnerability-card');
    cards.forEach(card => {
        card.classList.remove('expanded');
        card.classList.add('collapsed');
    });
}

// Initialize filter functionality when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Load saved filters from localStorage
    loadFiltersFromStorage();

    // Add event listeners for filter changes
    const form = document.getElementById('filterForm');
    if (form) {
        // Save filters when any input changes
        form.addEventListener('change', function() {
            saveFiltersToStorage();
        });

        // Special handling for the date filter to provide immediate feedback
        const dateFilter = document.getElementById('lastObservedAt');
        if (dateFilter) {
            dateFilter.addEventListener('change', function() {
                saveFiltersToStorage();
                // Show a brief feedback that filter was applied
                const today = new Date().toISOString().split('T')[0];
                if (this.value && this.value > today) {
                    console.warn('Date filter set to future date:', this.value);
                }
            });
        }
    }
});