const path = require('path');
const fs = require('fs');

class FileTypeDetector {
    constructor() {
        // Supported file formats for AWS Inspector reports
        this.supportedFormats = ['.json', '.csv'];

        // MIME type mappings
        this.mimeTypeMap = {
            '.json': 'application/json',
            '.csv': 'text/csv'
        };
    }

    /**
     * Detect file format based on extension and optionally validate content
     * @param {string} filename - Original filename
     * @param {string} filePath - Path to uploaded file (optional for content validation)
     * @param {object} options - Detection options
     * @returns {object} Detection result
     */
    detectFormat(filename, filePath = null, options = {}) {
        const { validateContent = false, confidence = 'high' } = options;

        // Primary detection: file extension
        const extension = path.extname(filename).toLowerCase();
        const detectedFormat = extension;
        const isSupported = this.supportedFormats.includes(extension);

        const result = {
            detectedFormat: extension || 'unknown',
            isSupported,
            confidence: isSupported ? 'high' : 'low',
            detectionMethod: 'extension',
            supportedFormats: this.supportedFormats,
            mimeType: this.mimeTypeMap[extension] || 'application/octet-stream'
        };

        // Content validation if requested and file path provided
        if (validateContent && filePath && isSupported) {
            try {
                const contentValidation = this.validateContent(filePath, extension);
                result.contentValidation = contentValidation;

                if (!contentValidation.valid) {
                    result.confidence = 'low';
                    result.error = contentValidation.error;
                }
            } catch (error) {
                result.contentValidation = {
                    valid: false,
                    error: error.message
                };
                result.confidence = 'low';
                result.error = `Content validation failed: ${error.message}`;
            }
        }

        return result;
    }

    /**
     * Validate that file content matches expected format
     * @param {string} filePath - Path to file to validate
     * @param {string} expectedExtension - Expected file extension
     * @returns {object} Validation result
     */
    validateContent(filePath, expectedExtension) {
        try {
            // Read first chunk of file for validation
            const buffer = fs.readFileSync(filePath, { encoding: 'utf8', flag: 'r' });
            const firstChunk = buffer.substring(0, 1024); // First 1KB

            switch (expectedExtension) {
                case '.json':
                    return this.validateJSONContent(firstChunk);
                case '.csv':
                    return this.validateCSVContent(firstChunk);
                default:
                    return {
                        valid: false,
                        error: `Unknown format validation for ${expectedExtension}`
                    };
            }
        } catch (error) {
            return {
                valid: false,
                error: `File read error: ${error.message}`
            };
        }
    }

    /**
     * Validate JSON content format
     * @param {string} content - File content to validate
     * @returns {object} Validation result
     */
    validateJSONContent(content) {
        try {
            // Try to parse as JSON
            const trimmed = content.trim();

            if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
                return {
                    valid: false,
                    error: 'Content does not appear to be JSON (missing opening brace/bracket)'
                };
            }

            // Attempt to parse the beginning - don't require complete JSON
            // since we're only reading first chunk
            return {
                valid: true,
                message: 'Content appears to be valid JSON format'
            };
        } catch (error) {
            return {
                valid: false,
                error: `JSON validation failed: ${error.message}`
            };
        }
    }

    /**
     * Validate CSV content format
     * @param {string} content - File content to validate
     * @returns {object} Validation result
     */
    validateCSVContent(content) {
        try {
            const lines = content.split('\n');

            if (lines.length === 0) {
                return {
                    valid: false,
                    error: 'File appears to be empty'
                };
            }

            // Check if first line looks like CSV headers
            const firstLine = lines[0].trim();

            if (!firstLine) {
                return {
                    valid: false,
                    error: 'First line is empty - no CSV headers found'
                };
            }

            // Basic CSV format check - should have comma-separated values
            const hasCommas = firstLine.includes(',');
            const hasQuotes = firstLine.includes('"');

            if (!hasCommas) {
                return {
                    valid: false,
                    error: 'Content does not appear to be CSV (no commas found in header line)'
                };
            }

            // Check for AWS Inspector specific headers
            const awsInspectorIndicators = [
                'AWS Account Id',
                'Finding ARN',
                'Vulnerability Id',
                'Severity'
            ];

            const hasAwsHeaders = awsInspectorIndicators.some(indicator =>
                firstLine.includes(indicator)
            );

            return {
                valid: true,
                message: 'Content appears to be valid CSV format',
                isAwsInspectorFormat: hasAwsHeaders
            };
        } catch (error) {
            return {
                valid: false,
                error: `CSV validation failed: ${error.message}`
            };
        }
    }

    /**
     * Check if file format is supported
     * @param {string} filename - Filename to check
     * @returns {boolean} Whether format is supported
     */
    isFormatSupported(filename) {
        const extension = path.extname(filename).toLowerCase();
        return this.supportedFormats.includes(extension);
    }

    /**
     * Get MIME type for file
     * @param {string} filename - Filename
     * @returns {string} MIME type
     */
    getMimeType(filename) {
        const extension = path.extname(filename).toLowerCase();
        return this.mimeTypeMap[extension] || 'application/octet-stream';
    }

    /**
     * Generate user-friendly error message for unsupported formats
     * @param {string} filename - Attempted filename
     * @returns {string} Error message
     */
    getUnsupportedFormatMessage(filename) {
        const extension = path.extname(filename).toLowerCase();
        return `Unsupported file format '${extension || 'unknown'}'. ` +
               `Please upload files with extensions: ${this.supportedFormats.join(', ')}`;
    }

    /**
     * Get comprehensive file type information
     * @param {string} filename - Filename to analyze
     * @param {string} filePath - Optional file path for content validation
     * @returns {object} Complete file type information
     */
    getFileTypeInfo(filename, filePath = null) {
        const detection = this.detectFormat(filename, filePath, { validateContent: !!filePath });

        return {
            filename,
            extension: detection.detectedFormat,
            isSupported: detection.isSupported,
            mimeType: detection.mimeType,
            confidence: detection.confidence,
            detectionMethod: detection.detectionMethod,
            supportedFormats: detection.supportedFormats,
            contentValidation: detection.contentValidation || null,
            error: detection.error || null,
            message: detection.isSupported ?
                'File format is supported' :
                this.getUnsupportedFormatMessage(filename)
        };
    }
}

module.exports = new FileTypeDetector();