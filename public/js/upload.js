let selectedFiles = [];

const supportedExtensions = ['.json', '.csv'];

const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');

// File input handling
fileInput.addEventListener('change', (event) => {
    handleFileSelect(Array.from(event.target.files));
});

// Drag and drop handling
uploadArea.addEventListener('dragover', (event) => {
    event.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', (event) => {
    event.preventDefault();
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (event) => {
    event.preventDefault();
    uploadArea.classList.remove('dragover');

    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        handleFileSelect(Array.from(event.dataTransfer.files));
    }
});

uploadArea.addEventListener('click', () => {
    fileInput.click();
});

function handleFileSelect(files) {
    if (!files || files.length === 0) {
        return;
    }

    const errors = [];

    files.forEach((file) => {
        const extensionIndex = file.name.lastIndexOf('.');
        const extension = extensionIndex !== -1 ? file.name.substring(extensionIndex).toLowerCase() : '';

        if (!supportedExtensions.includes(extension)) {
            errors.push(`${file.name}: unsupported file type. Please select JSON or CSV files.`);
            return;
        }

        const derivedDate = extractDateFromFilename(file.name);
        if (!derivedDate) {
            errors.push(`${file.name}: filename must follow the MM-DD-YYYY.ext format.`);
            return;
        }

        const isDuplicate = selectedFiles.some((entry) =>
            entry.file.name === file.name && entry.file.size === file.size
        );

        if (isDuplicate) {
            errors.push(`${file.name}: already selected, skipping duplicate.`);
            return;
        }

        selectedFiles.push({ file, derivedDate });
    });

    selectedFiles.sort((a, b) => new Date(a.derivedDate) - new Date(b.derivedDate));

    renderSelectedFiles();

    if (errors.length > 0) {
        alert(errors.join('\n'));
    }

    // Allow the same file to be selected again if needed
    fileInput.value = '';
}

function renderSelectedFiles() {
    const fileInfo = document.getElementById('fileInfo');
    const selectedFilesList = document.getElementById('selectedFilesList');

    if (!selectedFilesList) {
        return;
    }

    if (selectedFiles.length === 0) {
        selectedFilesList.innerHTML = '';
        fileInfo.style.display = 'none';
        uploadArea.style.display = 'block';
        return;
    }

    uploadArea.style.display = 'none';
    fileInfo.style.display = 'block';

    let html = '<table class="data-table">';
    html += '<thead><tr><th>Filename</th><th>Report Date</th><th>Size</th><th></th></tr></thead>';
    html += '<tbody>';

    selectedFiles.forEach((entry, index) => {
        html += `
            <tr>
                <td>${entry.file.name}</td>
                <td>${formatDisplayDate(entry.derivedDate)}</td>
                <td>${formatFileSize(entry.file.size)}</td>
                <td>
                    <button class="btn btn-small btn-secondary" onclick="removeFile(${index})">
                        Remove
                    </button>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    html += `<p class="file-info-summary">Files will be uploaded in the order shown (${selectedFiles.length} total).</p>`;

    selectedFilesList.innerHTML = html;
}

function extractDateFromFilename(fileName) {
    if (!fileName) {
        return null;
    }

    const lastDotIndex = fileName.lastIndexOf('.');
    const baseName = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
    const match = baseName.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);

    if (!match) {
        return null;
    }

    const month = parseInt(match[1], 10);
    const day = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    const date = new Date(Date.UTC(year, month - 1, day));
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() + 1 !== month ||
        date.getUTCDate() !== day
    ) {
        return null;
    }

    const normalizedMonth = String(month).padStart(2, '0');
    const normalizedDay = String(day).padStart(2, '0');

    return `${year}-${normalizedMonth}-${normalizedDay}`;
}

function formatDisplayDate(dateString) {
    if (!dateString) {
        return '—';
    }

    const date = new Date(`${dateString}T00:00:00Z`);
    if (isNaN(date.getTime())) {
        return dateString;
    }

    return date.toLocaleDateString();
}

function clearFiles() {
    selectedFiles = [];
    fileInput.value = '';
    renderSelectedFiles();
}

function removeFile(index) {
    if (index < 0 || index >= selectedFiles.length) {
        return;
    }

    selectedFiles.splice(index, 1);
    renderSelectedFiles();
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

async function uploadFile() {
    if (selectedFiles.length === 0) {
        alert('Please select at least one report file to upload.');
        return;
    }

    document.getElementById('uploadResult').style.display = 'none';

    const formData = new FormData();
    selectedFiles.forEach((entry) => {
        formData.append('reportFiles', entry.file);
    });

    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('uploadProgress').style.display = 'block';
    document.getElementById('progressText').textContent = `Uploading ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}...`;

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        document.getElementById('uploadProgress').style.display = 'none';
        document.getElementById('uploadResult').style.display = 'block';

        if (response.ok) {
            document.getElementById('resultTitle').textContent = 'Upload Successful!';
            document.getElementById('resultMessage').textContent = result.message || 'Reports processed successfully.';

            let detailsHTML = '';

            if (typeof result.totalProcessed === 'number') {
                detailsHTML += `<p><strong>Total Files Processed:</strong> ${result.totalProcessed}</p>`;
            }

            if (typeof result.totalVulnerabilities === 'number') {
                detailsHTML += `<p><strong>Total Vulnerabilities Processed:</strong> ${result.totalVulnerabilities}</p>`;
            }

            if (Array.isArray(result.processedReports) && result.processedReports.length > 0) {
                detailsHTML += '<table class="data-table">';
                detailsHTML += '<thead><tr><th>Filename</th><th>Report Date</th><th>Format</th><th>Vulnerabilities</th><th>Report ID</th></tr></thead>';
                detailsHTML += '<tbody>';

                result.processedReports.forEach((report) => {
                    const reportDate = report.reportRunDate ? new Date(report.reportRunDate).toLocaleDateString() : '—';
                    const format = report.fileFormat ? report.fileFormat.toUpperCase() : '—';
                    const vulnerabilityCount = typeof report.vulnerabilityCount === 'number' ? report.vulnerabilityCount : '—';
                    const reportId = report.reportId || '—';

                    detailsHTML += `
                        <tr>
                            <td>${report.filename}</td>
                            <td>${reportDate}</td>
                            <td>${format}</td>
                            <td>${vulnerabilityCount}</td>
                            <td>${reportId}</td>
                        </tr>
                    `;
                });

                detailsHTML += '</tbody></table>';
            }

            if (typeof result.processingTime === 'number') {
                detailsHTML += `<p><strong>Total Processing Time:</strong> ${result.processingTime}ms</p>`;
            }

            document.getElementById('resultDetails').innerHTML = detailsHTML;
            document.getElementById('uploadResult').className = 'result success';

            clearFiles();
            loadRecentReports();
        } else {
            document.getElementById('resultTitle').textContent = 'Upload Failed';
            document.getElementById('resultMessage').textContent = result.error || 'An error occurred during upload.';

            if (result.details) {
                document.getElementById('resultDetails').innerHTML = `<pre>${JSON.stringify(result.details, null, 2)}</pre>`;
            } else {
                document.getElementById('resultDetails').innerHTML = '';
            }

            document.getElementById('uploadResult').className = 'result error';
        }
    } catch (error) {
        document.getElementById('uploadProgress').style.display = 'none';
        document.getElementById('uploadResult').style.display = 'block';
        document.getElementById('resultTitle').textContent = 'Upload Error';
        document.getElementById('resultMessage').textContent = error.message;
        document.getElementById('resultDetails').innerHTML = '';
        document.getElementById('uploadResult').className = 'result error';
    }
}

function resetUpload() {
    clearFiles();
    document.getElementById('uploadResult').style.display = 'none';
    document.getElementById('uploadProgress').style.display = 'none';
    uploadArea.style.display = 'block';
}

async function loadRecentReports() {
    try {
        const response = await fetch('/api/reports');
        const reports = await response.json();

        const recentReportsList = document.getElementById('recentReportsList');

        if (!Array.isArray(reports) || reports.length === 0) {
            recentReportsList.innerHTML = '<p>No reports uploaded yet.</p>';
            return;
        }

        let html = '<table class="data-table">';
        html += '<thead><tr><th>Filename</th><th>Date</th><th>Vulnerabilities</th><th>Actions</th></tr></thead>';
        html += '<tbody>';

        reports.slice(0, 5).forEach(report => {
            html += `
                <tr>
                    <td>${report.filename}</td>
                    <td>${new Date(report.upload_date).toLocaleString()}</td>
                    <td>${report.vulnerability_count}</td>
                    <td>
                        <button class="btn btn-small btn-danger" onclick="deleteReport(${report.id})">Delete</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        recentReportsList.innerHTML = html;
    } catch (error) {
        console.error('Error loading reports:', error);
    }
}

async function deleteReport(reportId) {
    if (!confirm('Are you sure you want to delete this report?')) {
        return;
    }

    try {
        const response = await fetch(`/api/reports/${reportId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadRecentReports();
        } else {
            alert('Error deleting report');
        }
    } catch (error) {
        alert('Error deleting report: ' + error.message);
    }
}

// Load recent reports on page load
loadRecentReports();
