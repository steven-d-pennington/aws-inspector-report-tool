const path = require('path');

class ReportFilenameParser {
    static parse(filename) {
        if (!filename || typeof filename !== 'string') {
            throw new Error('Filename is required to derive the report date.');
        }

        const baseName = path.parse(filename).name;
        const match = baseName.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);

        if (!match) {
            throw new Error(`Unable to derive report date from filename "${filename}". Expected format MM-DD-YYYY.ext`);
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
            throw new Error(`Filename "${filename}" contains an invalid calendar date.`);
        }

        const normalizedMonth = String(month).padStart(2, '0');
        const normalizedDay = String(day).padStart(2, '0');

        return {
            normalizedDate: `${year}-${normalizedMonth}-${normalizedDay}`,
            isoString: date.toISOString(),
            date
        };
    }

    static getNormalizedDate(filename) {
        return this.parse(filename).normalizedDate;
    }
}

module.exports = { ReportFilenameParser };
