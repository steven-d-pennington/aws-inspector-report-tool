let selectedFile = null;

// File input handling
document.getElementById('fileInput').addEventListener('change', function(e) {
    handleFileSelect(e.target.files[0]);
});

// Drag and drop handling
const uploadArea = document.getElementById('uploadArea');

uploadArea.addEventListener('dragover', function(e) {
    e.preventDefault();
    this.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', function(e) {
    e.preventDefault();
    this.classList.remove('dragover');
});

uploadArea.addEventListener('drop', function(e) {
    e.preventDefault();
    this.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileSelect(files[0]);
    }
});

uploadArea.addEventListener('click', function() {
    document.getElementById('fileInput').click();
});

function handleFileSelect(file) {
    if (!file) return;

    // Check for supported file formats (JSON and CSV)
    const supportedExtensions = ['.json', '.csv'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!supportedExtensions.includes(fileExtension)) {
        alert(`Please select a JSON or CSV file. Supported formats: ${supportedExtensions.join(', ')}`);
        return;
    }

    selectedFile = file;

    // Display file information with format indicator
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = `Size: ${formatFileSize(file.size)}`;

    // Add file format indicator
    const formatIndicator = document.createElement('span');
    formatIndicator.className = 'file-format-indicator';
    formatIndicator.textContent = fileExtension.toUpperCase().substring(1) + ' Format';
    formatIndicator.style.cssText = 'margin-left: 10px; padding: 2px 6px; background: #007bff; color: white; font-size: 10px; border-radius: 3px;';

    const fileNameElement = document.getElementById('fileName');
    // Remove any existing format indicators
    const existingIndicator = fileNameElement.querySelector('.file-format-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    fileNameElement.appendChild(formatIndicator);

    document.getElementById('fileInfo').style.display = 'block';
    document.getElementById('uploadArea').style.display = 'none';
}

function clearFile() {
    selectedFile = null;
    document.getElementById('fileInput').value = '';
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('uploadArea').style.display = 'block';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function uploadFile() {
    if (!selectedFile) {
        alert('Please select a file');
        return;
    }

    const formData = new FormData();
    formData.append('reportFile', selectedFile);

    // Show progress
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('uploadProgress').style.display = 'block';

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
            document.getElementById('resultMessage').textContent = result.message;

            let detailsHTML = `
                <p><strong>Report ID:</strong> ${result.reportId}</p>
                <p><strong>Vulnerabilities Processed:</strong> ${result.vulnerabilityCount}</p>
            `;

            // Add file format and processing time if available
            if (result.fileFormat) {
                detailsHTML += `<p><strong>File Format:</strong> ${result.fileFormat.toUpperCase()}</p>`;
            }
            if (result.processingTime) {
                detailsHTML += `<p><strong>Processing Time:</strong> ${result.processingTime}ms</p>`;
            }

            document.getElementById('resultDetails').innerHTML = detailsHTML;
            document.getElementById('uploadResult').className = 'result success';

            // Refresh recent reports
            loadRecentReports();
        } else {
            document.getElementById('resultTitle').textContent = 'Upload Failed';
            document.getElementById('resultMessage').textContent = result.error || 'An error occurred during upload';
            document.getElementById('resultDetails').innerHTML = '';
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
    clearFile();
    document.getElementById('uploadResult').style.display = 'none';
}

async function loadRecentReports() {
    try {
        const response = await fetch('/api/reports');
        const reports = await response.json();

        const recentReportsList = document.getElementById('recentReportsList');

        if (reports.length === 0) {
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