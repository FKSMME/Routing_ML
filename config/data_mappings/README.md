# Data Mapping Profiles

This directory contains data mapping profiles that define how routing data is transformed and exported to various formats.

## Profile Structure

Each profile is a JSON file with the following structure:

```json
{
  "id": "profile-id",
  "name": "Profile Display Name",
  "description": "Profile description",
  "mappings": [
    {
      "routing_field": "internal_field_name",
      "db_column": "OUTPUT_COLUMN_NAME",
      "display_name": "Display Name",
      "data_type": "string|number|boolean|date",
      "is_required": false,
      "default_value": "default value or null",
      "source_type": "ml_prediction|admin_input|external_source|constant",
      "source_config": {
        "type": "process_group",
        "field": "resource_code"
      },
      "transform_rule": "uppercase|lowercase|trim|null"
    }
  ],
  "created_by": "username",
  "created_at": "ISO 8601 timestamp",
  "updated_at": "ISO 8601 timestamp",
  "is_active": true
}
```

## Source Types

### 1. `ml_prediction`
- Data comes from ML model predictions
- Includes: item codes, routing sequences, process codes, time estimates
- Default value is usually `null` (will be filled by ML predictions)

### 2. `admin_input`
- Fixed values set by administrators
- Includes: company codes, plant codes, user IDs, flags
- Default value is the constant value to use

### 3. `external_source`
- Data comes from other modules (e.g., process groups)
- `source_config` specifies where to fetch the data
- Example: `{"type": "process_group", "field": "resource_code"}`

### 4. `constant`
- Same value for all rows
- Includes: system flags, version codes
- Default value is the constant value

## Available Profiles

### fksm-merged-181-profile.json
**Purpose**: FKSM routing data export in 병합1 (merged) sheet format

**Structure**: 181 columns organized as:
- Routing Master fields (IDs, dates, flags)
- Process Master fields (work centers, resources, times)
- Process Detail fields (operations, tools, parameters)
- Process Child fields (sub-items, BOM structure)
- Process Resource fields (resource allocation, capacity)

**Source Distribution**:
- ML Predictions: ~80 columns (item codes, routing sequences, process info, time estimates)
- Admin Input: ~95 columns (company codes, user IDs, flags, fixed parameters)
- External Source: ~4 columns (work centers, resource codes from process groups)
- Constant: ~2 columns (system flags)

**Export Format**: Excel XLSX with 5 sheets
- Sheet 1: 병합1 (Main merged data)
- Sheet 2: P_BOP_PROC_MASTER
- Sheet 3: P_BOP_PROC_DETAIL
- Sheet 4: P_BOP_PROC_CHILD
- Sheet 5: P_BOP_PROC_RES

### fksm-proc-detail-profile.json
**Purpose**: FKSM process detail export

**Columns**: Focused on detailed process operations

### sample-profile-001.json
**Purpose**: Sample profile for testing

### simple-profile-002.json
**Purpose**: Minimal profile for testing

## Usage in API

### List Profiles
```http
GET /api/data-mapping/profiles
```

### Get Profile Details
```http
GET /api/data-mapping/profiles/{profile_id}
```

### Create Profile (Admin Only)
```http
POST /api/data-mapping/profiles
Content-Type: application/json

{
  "name": "New Profile",
  "description": "Description",
  "mappings": [...]
}
```

### Update Profile (Admin Only)
```http
PATCH /api/data-mapping/profiles/{profile_id}
Content-Type: application/json

{
  "mappings": [...]
}
```

### Delete Profile (Admin Only)
```http
DELETE /api/data-mapping/profiles/{profile_id}
```

## Frontend UI

Profiles can be managed through the **프로파일 관리** (Profile Management) menu in the frontend-prediction app:

1. Navigate to Admin menu → 프로파일 관리
2. View all profiles and their metadata
3. Create new profiles
4. Edit 181+ column mappings with search/filter
5. Configure source types, default values, transforms
6. Set field requirements and data types

## Regenerating Profiles

The FKSM 181-column profile is based on the actual Excel structure from:
`FKSM 라우팅 데이터구조.xlsx - 병합1 sheet`

To regenerate or create new profiles:

1. Analyze the target Excel/database structure
2. Map each column to a routing field
3. Determine source type for each column:
   - ML prediction fields: data from model outputs
   - Admin input: fixed organization-specific values
   - External source: data from other modules
   - Constant: same value for all records
4. Set appropriate default values
5. Configure data types and validation rules
6. Test with actual routing data export

## Notes

- Column names may have suffixes (.1, .2, .3) when same field appears in multiple sheets
- External source fields require proper configuration in source modules (e.g., process groups)
- ML prediction fields should have `null` default values
- Admin input fields should have appropriate organizational default values
- All profiles support runtime editing through the Profile Management UI
