const path = require('path');

/**
 * Date validation utility for report run date tracking
 * Validates report generation dates according to business rules
 */
class DateValidator {
    constructor() {
        // Maximum age in years for report run dates
        this.maxAgeYears = 2;

        // Date format pattern (YYYY-MM-DD)
        this.dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;
    }

    /**
     * Validate a report run date according to business rules
     * @param {string|Date} dateInput - Date to validate
     * @returns {object} Validation result with isValid, date, and error
     */
    validateReportRunDate(dateInput) {
        try {
            // Check if date input exists
            if (!dateInput) {
                return {
                    isValid: false,
                    error: 'Report run date is required',
                    field: 'reportRunDate'
                };
            }

            // Convert string to Date if necessary
            let date;
            if (typeof dateInput === 'string') {
                // Validate format first
                if (!this.isValidDateFormat(dateInput)) {
                    return {
                        isValid: false,
                        error: 'Date must be in YYYY-MM-DD format',
                        field: 'reportRunDate'
                    };
                }
                date = new Date(dateInput);
            } else if (dateInput instanceof Date) {
                date = dateInput;
            } else {
                return {
                    isValid: false,
                    error: 'Invalid date type',
                    field: 'reportRunDate'
                };
            }

            // Check if date is valid
            if (isNaN(date.getTime())) {
                return {
                    isValid: false,
                    error: 'Invalid date value',
                    field: 'reportRunDate'
                };
            }

            // Check if date is in the future
            if (this.isFutureDate(date)) {
                return {
                    isValid: false,
                    error: 'Report run date cannot be in the future',
                    field: 'reportRunDate'
                };
            }

            // Check if date is too old
            if (this.isTooOld(date)) {
                return {
                    isValid: false,
                    error: `Report run date cannot be more than ${this.maxAgeYears} years old`,
                    field: 'reportRunDate'
                };
            }

            // All validations passed
            return {
                isValid: true,
                date: date.toISOString(),
                formattedDate: this.formatDateForDisplay(date)
            };

        } catch (error) {
            return {
                isValid: false,
                error: `Date validation failed: ${error.message}`,
                field: 'reportRunDate'
            };
        }
    }

    /**
     * Check if date format matches YYYY-MM-DD pattern
     * @param {string} dateString - Date string to validate
     * @returns {boolean} Whether format is valid
     */
    isValidDateFormat(dateString) {
        if (typeof dateString !== 'string') {
            return false;
        }

        return this.dateFormatRegex.test(dateString);
    }

    /**
     * Check if date is in the future
     * @param {Date} date - Date to check
     * @returns {boolean} Whether date is in the future
     */
    isFutureDate(date) {
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today
        return date.getTime() > today.getTime();
    }

    /**
     * Check if date is too old (more than maxAgeYears)
     * @param {Date} date - Date to check
     * @returns {boolean} Whether date is too old
     */
    isTooOld(date) {
        const cutoffDate = new Date();
        cutoffDate.setFullYear(cutoffDate.getFullYear() - this.maxAgeYears);
        cutoffDate.setHours(0, 0, 0, 0); // Start of cutoff date
        return date.getTime() < cutoffDate.getTime();
    }

    /**
     * Format date for display to users
     * @param {Date} date - Date to format
     * @returns {string} Formatted date string
     */
    formatDateForDisplay(date) {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    /**
     * Get date constraints for client-side validation
     * @returns {object} Min and max date strings for HTML date input
     */
    getDateConstraints() {
        const today = new Date();
        const minDate = new Date();
        minDate.setFullYear(minDate.getFullYear() - this.maxAgeYears);

        return {
            min: minDate.toISOString().split('T')[0], // YYYY-MM-DD format
            max: today.toISOString().split('T')[0],   // YYYY-MM-DD format
            default: today.toISOString().split('T')[0]
        };
    }

    /**
     * Parse and normalize date for database storage
     * @param {string|Date} dateInput - Date to normalize
     * @returns {string} ISO string for database storage
     */
    normalizeDateForStorage(dateInput) {
        const validation = this.validateReportRunDate(dateInput);
        if (!validation.isValid) {
            throw new Error(validation.error);
        }
        return validation.date;
    }

    /**
     * Validate multiple dates (for bulk operations)
     * @param {Array} dates - Array of dates to validate
     * @returns {object} Validation results for all dates
     */
    validateMultipleDates(dates) {
        const results = [];
        let allValid = true;

        for (let i = 0; i < dates.length; i++) {
            const result = this.validateReportRunDate(dates[i]);
            result.index = i;
            results.push(result);

            if (!result.isValid) {
                allValid = false;
            }
        }

        return {
            allValid,
            results,
            validCount: results.filter(r => r.isValid).length,
            errorCount: results.filter(r => !r.isValid).length
        };
    }

    /**
     * Health check for the date validator
     * @returns {object} Health status
     */
    healthCheck() {
        try {
            // Test basic validation
            const testDate = new Date().toISOString().split('T')[0];
            const result = this.validateReportRunDate(testDate);

            if (result.isValid) {
                return {
                    status: 'healthy',
                    message: 'Date validator is operational',
                    timestamp: new Date().toISOString()
                };
            } else {
                return {
                    status: 'error',
                    message: `Validation failed: ${result.error}`,
                    timestamp: new Date().toISOString()
                };
            }
        } catch (error) {
            return {
                status: 'error',
                message: `Health check failed: ${error.message}`,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = new DateValidator();