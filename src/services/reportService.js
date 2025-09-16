class ReportService {
    async processReport(reportData, db, filename) {
        try {
            const findings = reportData.findings || [];
            const awsAccountId = findings.length > 0 ? findings[0].awsAccountId : 'unknown';

            // Insert main report record
            const reportId = await db.insertReport(filename, findings.length, awsAccountId);

            // Process each finding
            for (const finding of findings) {
                try {
                    // Insert vulnerability
                    const vulnerabilityId = await db.insertVulnerability(reportId, finding);

                    // Insert resources
                    if (finding.resources && finding.resources.length > 0) {
                        for (const resource of finding.resources) {
                            await db.insertResource(vulnerabilityId, resource);
                        }
                    }

                    // Insert vulnerable packages
                    if (finding.packageVulnerabilityDetails && finding.packageVulnerabilityDetails.vulnerablePackages) {
                        for (const pkg of finding.packageVulnerabilityDetails.vulnerablePackages) {
                            await db.insertPackage(vulnerabilityId, pkg);
                        }
                    }

                    // Insert reference URLs
                    if (finding.packageVulnerabilityDetails && finding.packageVulnerabilityDetails.referenceUrls) {
                        for (const url of finding.packageVulnerabilityDetails.referenceUrls) {
                            await db.insertReference(vulnerabilityId, url);
                        }
                    }
                } catch (err) {
                    console.error('Error processing finding:', err);
                    // Continue processing other findings
                }
            }

            return reportId;
        } catch (error) {
            console.error('Error processing report:', error);
            throw error;
        }
    }
}

module.exports = new ReportService();