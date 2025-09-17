# Data Model: CSV Format Support

**Feature**: Add CSV Format Support for AWS Inspector Reports
**Date**: 2025-09-17
**Dependencies**: research.md

## Data Entities

### File Upload Entity
Represents the uploaded file and its processing metadata.

**Attributes**:
- `filename`: Original filename with extension
- `fileExtension`: Detected file extension (.json or .csv)
- `fileSize`: File size in bytes
- `uploadTimestamp`: When file was uploaded
- `processingStatus`: Upload processing state
- `errorMessage`: Error details if processing failed
- `recordCount`: Number of vulnerability records processed

**Validation Rules**:
- File extension must be .json or .csv
- File size must not exceed 100MB
- Filename must not be empty
- Processing status must be one of: pending, processing, completed, failed

**State Transitions**:
```
pending → processing → completed
                  ↘ failed
```

### CSV Column Mapping Entity
Defines the transformation rules from CSV columns to JSON structure.

**Core Mappings**:
```javascript
{
  // Direct field mappings
  "AWS Account Id": "awsAccountId",
  "Finding ARN": "findingArn",
  "Title": "title",
  "Description": "description",
  "Severity": "severity",
  "Status": "status",
  "First Seen": "firstObservedAt",
  "Last Seen": "lastObservedAt",
  "Last Updated": "updatedAt",
  "Resource ID": "resources[0].id",
  "Resource Type": "resources[0].type",
  "Region": "resources[0].region",
  "Platform": "resources[0].details.platform",

  // Nested object mappings
  "Vulnerability Id": "packageVulnerabilityDetails.vulnerabilityId",
  "Reference Urls": "packageVulnerabilityDetails.referenceUrls[]",

  // Type conversion mappings
  "Fix Available": "fixAvailable", // "YES"/"NO" → boolean
  "Inspector Score": "inspectorScore", // string → number
  "Epss Score": "epss.score", // string → number, wrap in object
  "Exploit Available": "exploitAvailable", // "YES"/"NO" → boolean

  // Array parsing mappings
  "Affected Packages": "packageVulnerabilityDetails.vulnerablePackages[].name",
  "Package Installed Version": "packageVulnerabilityDetails.vulnerablePackages[].version",
  "Fixed in Version": "packageVulnerabilityDetails.vulnerablePackages[].fixedInVersion",
  "Package Manager": "packageVulnerabilityDetails.vulnerablePackages[].packageManager",
  "File Path": "packageVulnerabilityDetails.vulnerablePackages[].filePath"
}
```

**Validation Rules**:
- All required columns must be present in CSV header
- Column names must match exactly (case-sensitive)
- Data types must be convertible to expected JSON types

### Format Detection Entity
Handles file format identification and validation.

**Attributes**:
- `detectedFormat`: Identified format (json, csv, unknown)
- `detectionMethod`: How format was determined (extension, content, mime)
- `confidence`: Detection confidence level (high, medium, low)
- `supportedFormats`: List of formats the system accepts

**Detection Rules**:
1. Primary: File extension (.json, .csv)
2. Fallback: Content analysis if extension missing/unknown
3. Validation: Verify content matches detected format

**Validation Rules**:
- Extension must be in supported formats list
- Content must be parseable in detected format
- File must not be empty

### Transformation Result Entity
Represents the outcome of CSV to JSON transformation.

**Attributes**:
- `originalFormat`: Source format (csv)
- `targetFormat`: Target format (json)
- `recordsProcessed`: Number of CSV rows processed
- `recordsSuccessful`: Number successfully transformed
- `recordsFailed`: Number that failed transformation
- `transformationErrors`: List of specific errors
- `processingTime`: Time taken for transformation

**Relationships**:
- Belongs to one File Upload
- Contains many Vulnerability Records (after transformation)

## Data Flow

### CSV Processing Flow
```
1. File Upload → Format Detection
   ↓
2. CSV Validation → Column Mapping Verification
   ↓
3. Stream Processing → Row-by-Row Transformation
   ↓
4. JSON Structure Assembly → Vulnerability Records
   ↓
5. Existing Processing Pipeline → Database Storage
```

### Transformation Pipeline
```
CSV Row → Field Extraction → Type Conversion → Object Assembly → JSON Finding
```

**Type Conversions**:
- Dates: ISO string → Date object
- Booleans: "YES"/"NO" → true/false
- Numbers: String → Float/Integer
- Arrays: Comma-separated → Array of objects
- Objects: Flat fields → Nested structure

## Validation Schema

### Required CSV Columns
```javascript
const requiredColumns = [
  "AWS Account Id",
  "Finding ARN",
  "Title",
  "Description",
  "Severity",
  "Status",
  "First Seen",
  "Last Seen"
];
```

### Data Type Validations
```javascript
const typeValidations = {
  "AWS Account Id": "string",
  "Inspector Score": "number",
  "Epss Score": "number",
  "Fix Available": ["YES", "NO"],
  "Exploit Available": ["YES", "NO"],
  "Severity": ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNTRIAGED"],
  "Status": ["ACTIVE", "RESOLVED", "SUPPRESSED"]
};
```

### Business Rules
1. **Finding ARN** must be unique within upload
2. **AWS Account Id** must be consistent across all rows
3. **Package arrays** must be properly formed when split by comma
4. **Date fields** must be valid ISO 8601 format
5. **Numeric fields** must be finite numbers when present

## Error Handling

### Validation Error Types
```javascript
{
  MISSING_REQUIRED_COLUMN: "Required column '{column}' not found in CSV",
  INVALID_DATA_TYPE: "Invalid data type in row {row}, column '{column}'",
  MALFORMED_PACKAGE_LIST: "Cannot parse package list in row {row}",
  INVALID_DATE_FORMAT: "Invalid date format in row {row}, column '{column}'",
  DUPLICATE_FINDING_ARN: "Duplicate Finding ARN found in row {row}",
  EMPTY_REQUIRED_FIELD: "Required field '{field}' is empty in row {row}"
}
```

### Error Recovery Strategy
- **Column errors**: Fail fast before processing any data
- **Row errors**: Skip invalid rows, continue processing valid ones
- **Type errors**: Attempt conversion, use default value if possible
- **Critical errors**: Stop processing and return error details

## Integration Points

### Existing Database Schema
No changes required to existing vulnerability database schema. CSV data transforms to the same structure as JSON data.

### Service Layer Integration
- **CSV Parser Service**: New service implementing transformation logic
- **Report Service**: No changes - receives same JSON structure
- **Database Service**: No changes - stores same data structure
- **Upload Handler**: Modified to detect format and route to appropriate parser

## Performance Considerations

### Memory Usage
- Stream processing prevents loading entire CSV into memory
- Transform one row at a time to JSON structure
- Batch database insertions as with current JSON processing

### Processing Time
- CSV parsing typically 2-3x faster than JSON parsing
- Transformation overhead minimal for flat-to-nested structure conversion
- Overall processing time expected to be comparable to JSON uploads