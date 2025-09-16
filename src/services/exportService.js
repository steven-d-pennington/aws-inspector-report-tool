const puppeteer = require('puppeteer');
const marked = require('marked');

class ExportService {
    async generatePDF(vulnerabilities) {
        const html = this.generateHTMLReport(vulnerabilities);

        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();

        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: {
                top: '20mm',
                right: '20mm',
                bottom: '20mm',
                left: '20mm'
            },
            printBackground: true
        });

        await browser.close();
        return pdfBuffer;
    }

    generateHTMLReport(vulnerabilities) {
        const groupedBySeverity = this.groupBySeverity(vulnerabilities);

        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Vulnerability Report</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    margin: 0;
                    padding: 0;
                }
                h1 {
                    color: #2c3e50;
                    border-bottom: 3px solid #3498db;
                    padding-bottom: 10px;
                }
                h2 {
                    color: #34495e;
                    margin-top: 30px;
                }
                h3 {
                    color: #7f8c8d;
                }
                .vulnerability {
                    margin-bottom: 30px;
                    padding: 15px;
                    border: 1px solid #ecf0f1;
                    border-radius: 5px;
                    page-break-inside: avoid;
                }
                .critical {
                    border-left: 5px solid #e74c3c;
                    background-color: #ffebee;
                }
                .high {
                    border-left: 5px solid #e67e22;
                    background-color: #fff3e0;
                }
                .medium {
                    border-left: 5px solid #f39c12;
                    background-color: #fffde7;
                }
                .low {
                    border-left: 5px solid #27ae60;
                    background-color: #e8f5e9;
                }
                .metadata {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                    margin: 15px 0;
                    font-size: 0.9em;
                }
                .metadata-item {
                    padding: 5px;
                    background-color: #f8f9fa;
                    border-radius: 3px;
                }
                .metadata-label {
                    font-weight: bold;
                    color: #667;
                }
                .package-list {
                    margin: 10px 0;
                    padding-left: 20px;
                }
                .package-item {
                    margin: 5px 0;
                    padding: 5px;
                    background-color: #f1f3f5;
                    border-radius: 3px;
                }
                .references {
                    margin-top: 15px;
                    font-size: 0.85em;
                }
                .reference-link {
                    color: #3498db;
                    text-decoration: none;
                    margin-right: 10px;
                }
                .summary {
                    background-color: #ecf0f1;
                    padding: 20px;
                    border-radius: 5px;
                    margin-bottom: 30px;
                }
                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 15px;
                    margin-top: 15px;
                }
                .summary-item {
                    text-align: center;
                    padding: 10px;
                    background-color: white;
                    border-radius: 5px;
                }
                .summary-count {
                    font-size: 2em;
                    font-weight: bold;
                    color: #2c3e50;
                }
                .summary-label {
                    font-size: 0.9em;
                    color: #7f8c8d;
                    text-transform: uppercase;
                }
            </style>
        </head>
        <body>
            <h1>Vulnerability Assessment Report</h1>
            <p><strong>Report Generated:</strong> ${new Date().toLocaleString()}</p>

            <div class="summary">
                <h2>Summary</h2>
                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="summary-count">${vulnerabilities.length}</div>
                        <div class="summary-label">Total</div>
                    </div>
                    <div class="summary-item" style="color: #e74c3c;">
                        <div class="summary-count">${groupedBySeverity.CRITICAL ? groupedBySeverity.CRITICAL.length : 0}</div>
                        <div class="summary-label">Critical</div>
                    </div>
                    <div class="summary-item" style="color: #e67e22;">
                        <div class="summary-count">${groupedBySeverity.HIGH ? groupedBySeverity.HIGH.length : 0}</div>
                        <div class="summary-label">High</div>
                    </div>
                    <div class="summary-item" style="color: #f39c12;">
                        <div class="summary-count">${groupedBySeverity.MEDIUM ? groupedBySeverity.MEDIUM.length : 0}</div>
                        <div class="summary-label">Medium</div>
                    </div>
                </div>
            </div>
        `;

        // Add vulnerabilities grouped by severity
        const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
        for (const severity of severityOrder) {
            if (groupedBySeverity[severity] && groupedBySeverity[severity].length > 0) {
                html += `<h2>${severity} Severity Vulnerabilities</h2>`;

                for (const vuln of groupedBySeverity[severity]) {
                    html += `
                    <div class="vulnerability ${severity.toLowerCase()}">
                        <h3>${vuln.vulnerability_id || vuln.title}</h3>
                        <p><strong>${vuln.title}</strong></p>
                        <p>${this.escapeHtml(vuln.description || '')}</p>

                        <div class="metadata">
                            <div class="metadata-item">
                                <span class="metadata-label">Status:</span> ${vuln.status}
                            </div>
                            <div class="metadata-item">
                                <span class="metadata-label">Fix Available:</span> ${vuln.fix_available}
                            </div>
                            <div class="metadata-item">
                                <span class="metadata-label">CVSS Score:</span> ${vuln.inspector_score || 'N/A'}
                            </div>
                            <div class="metadata-item">
                                <span class="metadata-label">Resource:</span> ${vuln.resource_type || 'N/A'}
                            </div>
                        </div>
                    `;

                    // Add package information
                    if (vuln.packages && vuln.packages.length > 0) {
                        html += '<div><strong>Affected Packages:</strong></div>';
                        html += '<div class="package-list">';
                        for (const pkg of vuln.packages) {
                            html += `
                            <div class="package-item">
                                ${pkg.name} ${pkg.version}
                                ${pkg.fixed_version ? `→ Fixed in: ${pkg.fixed_version}` : ''}
                                (${pkg.package_manager || 'Unknown'})
                            </div>`;
                        }
                        html += '</div>';
                    }

                    // Add resource details
                    if (vuln.resource_id) {
                        html += `<div><strong>Resource ID:</strong> ${vuln.resource_id}</div>`;
                    }
                    if (vuln.platform) {
                        html += `<div><strong>Platform:</strong> ${vuln.platform}</div>`;
                    }

                    // Add references
                    if (vuln.references && vuln.references.length > 0) {
                        html += '<div class="references"><strong>References:</strong><br>';
                        for (const ref of vuln.references) {
                            html += `<a class="reference-link" href="${ref}">${this.shortenUrl(ref)}</a><br>`;
                        }
                        html += '</div>';
                    }

                    html += '</div>';
                }
            }
        }

        html += `
        </body>
        </html>
        `;

        return html;
    }

    generateNotionText(vulnerabilities) {
        const groupedBySeverity = this.groupBySeverity(vulnerabilities);
        let notionText = '';

        notionText += '# Vulnerability Assessment Report\n\n';
        notionText += `**Generated:** ${new Date().toLocaleString()}\n\n`;

        // Summary section
        notionText += '## Summary\n\n';
        notionText += `- **Total Vulnerabilities:** ${vulnerabilities.length}\n`;
        notionText += `- **Critical:** ${groupedBySeverity.CRITICAL ? groupedBySeverity.CRITICAL.length : 0}\n`;
        notionText += `- **High:** ${groupedBySeverity.HIGH ? groupedBySeverity.HIGH.length : 0}\n`;
        notionText += `- **Medium:** ${groupedBySeverity.MEDIUM ? groupedBySeverity.MEDIUM.length : 0}\n`;
        notionText += `- **Low:** ${groupedBySeverity.LOW ? groupedBySeverity.LOW.length : 0}\n\n`;

        notionText += '---\n\n';

        // Vulnerabilities by severity
        const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
        const severityEmojis = {
            'CRITICAL': '🔴',
            'HIGH': '🟠',
            'MEDIUM': '🟡',
            'LOW': '🟢'
        };

        for (const severity of severityOrder) {
            if (groupedBySeverity[severity] && groupedBySeverity[severity].length > 0) {
                notionText += `## ${severityEmojis[severity]} ${severity} Severity\n\n`;

                for (const vuln of groupedBySeverity[severity]) {
                    notionText += `### ${vuln.vulnerability_id || vuln.title}\n\n`;

                    // Create a callout box for the main info
                    notionText += `> **${vuln.title}**\n`;
                    notionText += `> ${vuln.description || 'No description available'}\n\n`;

                    // Add CVE link if available
                    if (vuln.vulnerability_id && vuln.vulnerability_id.startsWith('CVE-')) {
                        notionText += `**🔗 CVE Report:** [${vuln.vulnerability_id}](https://nvd.nist.gov/vuln/detail/${vuln.vulnerability_id})\n\n`;
                    }

                    // List affected instance IDs
                    if (vuln.resources && vuln.resources.length > 0) {
                        const instanceIds = vuln.resources
                            .filter(resource => resource.resource_type === 'AWS_EC2_INSTANCE' && resource.resource_id.startsWith('i-'))
                            .map(resource => resource.resource_id);

                        if (instanceIds.length > 0) {
                            notionText += `**🖥️ Affected Instances:**\n`;
                            instanceIds.forEach(instanceId => {
                                notionText += `- \`${instanceId}\`\n`;
                            });
                            notionText += '\n';
                        }
                    } else if (vuln.resource_id && vuln.resource_type === 'AWS_EC2_INSTANCE' && vuln.resource_id.startsWith('i-')) {
                        // Handle individual findings (non-grouped)
                        notionText += `**🖥️ Affected Instance:**\n- \`${vuln.resource_id}\`\n\n`;
                    }

                    notionText += '---\n\n';
                }
            }
        }


        return notionText;
    }

    groupBySeverity(vulnerabilities) {
        return vulnerabilities.reduce((acc, vuln) => {
            const severity = vuln.severity || 'UNKNOWN';
            if (!acc[severity]) {
                acc[severity] = [];
            }
            acc[severity].push(vuln);
            return acc;
        }, {});
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    shortenUrl(url) {
        if (url.length > 50) {
            const urlObj = new URL(url);
            return urlObj.hostname + '...' + url.substr(url.length - 20);
        }
        return url;
    }
}

module.exports = new ExportService();