const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

class CSVParserService {
    constructor() {
        // Required CSV columns for AWS Inspector reports
        this.requiredColumns = [
            'AWS Account Id',
            'Finding ARN',
            'Title',
            'Description',
            'Severity',
            'Status',
            'First Seen',
            'Last Seen'
        ];

        // Column mapping from CSV to JSON structure
        this.columnMapping = {
            'AWS Account Id': 'awsAccountId',
            'Finding ARN': 'findingArn',
            'Title': 'title',
            'Description': 'description',
            'Severity': 'severity',
            'Status': 'status',
            'Fix Available': 'fixAvailable',
            'First Seen': 'firstObservedAt',
            'Last Seen': 'lastObservedAt',
            'Last Updated': 'updatedAt',
            'Inspector Score': 'inspectorScore',
            'Epss Score': 'epss.score',
            'Exploit Available': 'exploitAvailable',
            'Vulnerability Id': 'packageVulnerabilityDetails.vulnerabilityId',
            'Resource ID': 'resources[0].id',
            'Resource Type': 'resources[0].type',
            'Region': 'resources[0].region',
            'Platform': 'resources[0].details.platform',
            'Affected Packages': 'packageVulnerabilityDetails.vulnerablePackages',
            'Package Installed Version': 'packageVulnerabilityDetails.vulnerablePackages.version',
            'Fixed in Version': 'packageVulnerabilityDetails.vulnerablePackages.fixedInVersion',
            'Package Manager': 'packageVulnerabilityDetails.vulnerablePackages.packageManager',
            'File Path': 'packageVulnerabilityDetails.vulnerablePackages.filePath',
            'Reference Urls': 'packageVulnerabilityDetails.referenceUrls'
        };
    }

    /**
     * Parse AWS Inspector CSV file and transform to JSON structure
     * @param {string} filePath - Absolute path to the CSV file
     * @param {object} options - Parsing options
     * @returns {Promise<object>} Parsed data with findings array and metadata
     */
    async parseInspectorCSV(filePath, options = {}) {
        const { validateSchema = true, skipInvalidRows = false, maxRows = null } = options;

        const startTime = Date.now();
        const findings = [];
        const errors = [];
        let totalRows = 0;
        let validRows = 0;
        let detectedColumns = [];

        try {
            // First, validate schema if requested
            if (validateSchema) {
                const validation = await this.validateCSVSchema(filePath);
                if (!validation.valid) {
                    throw new Error(`CSV validation failed: Missing required columns: ${validation.missingColumns.join(', ')}`);
                }
                detectedColumns = validation.detectedColumns;
            }

            // Parse CSV file
            await new Promise((resolve, reject) => {
                const stream = fs.createReadStream(filePath)
                    .pipe(csv())
                    .on('headers', (headers) => {
                        if (!validateSchema) {
                            detectedColumns = headers;
                        }
                    })
                    .on('data', (row) => {
                        totalRows++;

                        // Check max rows limit
                        if (maxRows && totalRows > maxRows) {
                            stream.destroy();
                            return;
                        }

                        try {
                            const finding = this.transformRowToFinding(row, totalRows);
                            findings.push(finding.finding);

                            if (finding.warnings && finding.warnings.length > 0) {
                                finding.warnings.forEach(warning => {
                                    errors.push({
                                        row: totalRows,
                                        errorType: 'WARNING',
                                        message: warning
                                    });
                                });
                            }

                            validRows++;
                        } catch (error) {
                            errors.push({
                                row: totalRows,
                                errorType: 'VALIDATION_ERROR',
                                message: error.message,
                                value: JSON.stringify(row)
                            });

                            if (!skipInvalidRows) {
                                reject(error);
                                return;
                            }
                        }
                    })
                    .on('end', () => {
                        resolve();
                    })
                    .on('error', (error) => {
                        reject(error);
                    });
            });

            const processingTime = Date.now() - startTime;

            return {
                findings,
                metadata: {
                    totalRows,
                    validRows,
                    invalidRows: totalRows - validRows,
                    processingTime,
                    detectedColumns
                },
                errors
            };

        } catch (error) {
            throw new Error(`CSV parsing failed: ${error.message}`);
        }
    }

    /**
     * Validate that CSV file has required columns
     * @param {string} filePath - Path to CSV file
     * @returns {Promise<object>} Validation result
     */
    async validateCSVSchema(filePath) {
        return new Promise((resolve, reject) => {
            const detectedColumns = [];

            fs.createReadStream(filePath)
                .pipe(csv())
                .on('headers', (headers) => {
                    detectedColumns.push(...headers);

                    const missingColumns = this.requiredColumns.filter(
                        required => !headers.includes(required)
                    );

                    const extraColumns = headers.filter(
                        header => !Object.keys(this.columnMapping).includes(header)
                    );

                    resolve({
                        valid: missingColumns.length === 0,
                        missingColumns,
                        extraColumns,
                        detectedColumns: headers
                    });
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
    }

    /**
     * Transform single CSV row to vulnerability finding JSON object
     * @param {object} csvRow - CSV row data as key-value pairs
     * @param {number} rowNumber - Row number for error reporting
     * @returns {object} Transformed finding and warnings
     */
    transformRowToFinding(csvRow, rowNumber) {
        const warnings = [];

        try {
            // Basic required fields
            const finding = {
                awsAccountId: csvRow['AWS Account Id'],
                findingArn: csvRow['Finding ARN'],
                title: csvRow['Title'],
                description: csvRow['Description'],
                severity: csvRow['Severity'],
                status: csvRow['Status'],
                firstObservedAt: csvRow['First Seen'],
                lastObservedAt: csvRow['Last Seen'],
                updatedAt: csvRow['Last Updated']
            };

            // Keep boolean fields as strings (database expects 'YES'/'NO', no nulls)
            finding.fixAvailable = csvRow['Fix Available'] || 'NO';
            finding.exploitAvailable = csvRow['Exploit Available'] || 'NO';

            // Convert numeric fields
            if (csvRow['Inspector Score']) {
                finding.inspectorScore = parseFloat(csvRow['Inspector Score']);
            }

            // EPSS score (wrap in object like JSON format)
            if (csvRow['Epss Score']) {
                finding.epss = {
                    score: parseFloat(csvRow['Epss Score'])
                };
            }

            // Resources array
            finding.resources = [];
            if (csvRow['Resource ID']) {
                const resource = {
                    id: csvRow['Resource ID'],
                    type: csvRow['Resource Type'],
                    region: csvRow['Region']
                };

                if (csvRow['Platform']) {
                    resource.details = {
                        platform: csvRow['Platform']
                    };
                }

                finding.resources.push(resource);
            }

            // Package vulnerability details
            finding.packageVulnerabilityDetails = {};

            if (csvRow['Vulnerability Id']) {
                finding.packageVulnerabilityDetails.vulnerabilityId = csvRow['Vulnerability Id'];
            }

            // Reference URLs (split by comma if multiple)
            if (csvRow['Reference Urls']) {
                finding.packageVulnerabilityDetails.referenceUrls =
                    csvRow['Reference Urls'].split(',').map(url => url.trim()).filter(url => url);
            }

            // Vulnerable packages (handle comma-separated packages)
            finding.packageVulnerabilityDetails.vulnerablePackages = [];

            if (csvRow['Affected Packages']) {
                const packageNames = csvRow['Affected Packages'].split(',').map(p => p.trim()).filter(p => p);
                const packageVersions = csvRow['Package Installed Version'] ?
                    csvRow['Package Installed Version'].split(',').map(v => v.trim()).filter(v => v) : [];
                const fixedVersions = csvRow['Fixed in Version'] ?
                    csvRow['Fixed in Version'].split(',').map(v => v.trim()).filter(v => v) : [];
                const packageManagers = csvRow['Package Manager'] ?
                    csvRow['Package Manager'].split(',').map(pm => pm.trim()).filter(pm => pm) : [];
                const filePaths = csvRow['File Path'] ?
                    csvRow['File Path'].split(',').map(fp => fp.trim()).filter(fp => fp) : [];

                packageNames.forEach((name, index) => {
                    const pkg = { name };

                    if (packageVersions[index]) pkg.version = packageVersions[index];
                    if (fixedVersions[index]) pkg.fixedInVersion = fixedVersions[index];
                    if (packageManagers[index]) pkg.packageManager = packageManagers[index];
                    if (filePaths[index]) pkg.filePath = filePaths[index];

                    finding.packageVulnerabilityDetails.vulnerablePackages.push(pkg);
                });
            }

            // Validate required fields
            if (!finding.awsAccountId || !finding.findingArn || !finding.title) {
                throw new Error(`Missing required fields in row ${rowNumber}`);
            }

            return { finding, warnings };

        } catch (error) {
            throw new Error(`Row ${rowNumber} transformation failed: ${error.message}`);
        }
    }

    /**
     * Parse boolean values from CSV
     * @param {string} value - String value to parse
     * @returns {boolean|null} Parsed boolean or null
     */
    parseBoolean(value) {
        if (!value) return null;
        const normalized = value.toString().toLowerCase().trim();
        if (normalized === 'yes' || normalized === 'true' || normalized === '1') return true;
        if (normalized === 'no' || normalized === 'false' || normalized === '0') return false;
        return null;
    }

    /**
     * Health check for the CSV parser service
     * @returns {Promise<object>} Health status
     */
    async healthCheck() {
        try {
            // Test CSV parser is available
            const testData = '"Test","Data"\n"value1","value2"';
            const testPath = path.join(__dirname, '..', '..', 'temp_health_check.csv');

            fs.writeFileSync(testPath, testData);
            const result = await this.validateCSVSchema(testPath);
            fs.unlinkSync(testPath);

            return {
                status: 'healthy',
                message: 'CSV parser service is operational',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'error',
                message: `CSV parser service error: ${error.message}`,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = new CSVParserService();