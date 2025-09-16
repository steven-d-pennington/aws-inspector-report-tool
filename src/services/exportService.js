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

                    // Metadata table
                    notionText += '| Property | Value |\n';
                    notionText += '|----------|-------|\n';
                    notionText += `| Status | ${vuln.status} |\n`;
                    notionText += `| Fix Available | ${vuln.fix_available === 'YES' ? '✅ Yes' : '❌ No'} |\n`;
                    notionText += `| CVSS Score | ${vuln.inspector_score || 'N/A'} |\n`;
                    notionText += `| Resource Type | ${vuln.resource_type || 'N/A'} |\n`;
                    notionText += `| Platform | ${vuln.platform || 'N/A'} |\n`;

                    if (vuln.resource_id) {
                        notionText += `| Resource ID | \`${vuln.resource_id}\` |\n`;
                    }

                    notionText += '\n';

                    // Affected packages
                    if (vuln.packages && vuln.packages.length > 0) {
                        notionText += '**Affected Packages:**\n';
                        for (const pkg of vuln.packages) {
                            notionText += `- \`${pkg.name}@${pkg.version}\``;
                            if (pkg.fixed_version) {
                                notionText += ` → **Fixed in:** \`${pkg.fixed_version}\``;
                            }
                            notionText += ` (${pkg.package_manager || 'Unknown'})\n`;
                        }
                        notionText += '\n';
                    }

                    // Fix information
                    if (vuln.fix_available === 'YES') {
                        notionText += '**💡 Fix Available**\n';
                        if (vuln.packages && vuln.packages.length > 0) {
                            for (const pkg of vuln.packages) {
                                if (pkg.fixed_version) {
                                    notionText += `- Update \`${pkg.name}\` to version \`${pkg.fixed_version}\`\n`;
                                }
                            }
                        }
                        notionText += '\n';
                    }

                    // References
                    if (vuln.references && vuln.references.length > 0) {
                        notionText += '**📚 References:**\n';
                        for (const ref of vuln.references) {
                            notionText += `- [${this.shortenUrl(ref)}](${ref})\n`;
                        }
                        notionText += '\n';
                    }

                    notionText += '---\n\n';
                }
            }
        }

        // Action items section
        notionText += '## 📋 Recommended Actions\n\n';

        const fixableVulns = vulnerabilities.filter(v => v.fix_available === 'YES');
        if (fixableVulns.length > 0) {
            notionText += `### ✅ Immediate Fixes Available (${fixableVulns.length} vulnerabilities)\n\n`;

            const packageUpdates = new Map();
            for (const vuln of fixableVulns) {
                if (vuln.packages) {
                    for (const pkg of vuln.packages) {
                        if (pkg.fixed_version) {
                            const key = `${pkg.name}|${pkg.package_manager}`;
                            if (!packageUpdates.has(key)) {
                                packageUpdates.set(key, {
                                    name: pkg.name,
                                    manager: pkg.package_manager,
                                    versions: new Set(),
                                    fixedVersion: pkg.fixed_version
                                });
                            }
                            packageUpdates.get(key).versions.add(pkg.version);
                        }
                    }
                }
            }

            if (packageUpdates.size > 0) {
                notionText += '**Package Updates Required:**\n';
                for (const [, pkg] of packageUpdates) {
                    notionText += `- [ ] Update \`${pkg.name}\` to \`${pkg.fixedVersion}\` (${pkg.manager || 'Unknown'})\n`;
                }
                notionText += '\n';
            }
        }

        const criticalHighVulns = vulnerabilities.filter(v =>
            (v.severity === 'CRITICAL' || v.severity === 'HIGH') && v.fix_available !== 'YES'
        );

        if (criticalHighVulns.length > 0) {
            notionText += `### ⚠️ Critical/High Vulnerabilities Without Fixes (${criticalHighVulns.length})\n\n`;
            notionText += 'These vulnerabilities require alternative mitigation strategies:\n';
            for (const vuln of criticalHighVulns) {
                notionText += `- [ ] Review and mitigate: **${vuln.vulnerability_id || vuln.title}**\n`;
            }
            notionText += '\n';
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