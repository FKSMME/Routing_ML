# FKSM 181-Column XLSX Export Implementation

**Date**: 2025-10-15 12:24
**Branch**: 251014
**Task**: Implement 181-column routing data output with XLSX multi-sheet export

## Overview

Implemented XLSX export functionality for routing prediction output to match FKSM Excel structure with 181 columns split across 5 sheets.

## Requirements

### Excel Structure (FKSM 라우팅 데이터구조.xlsx)
- **병합1 Sheet**: All 181 columns combined
- **P_BOP_PROC_MASTER**: Columns 1-28 (routing master data)
- **P_BOP_PROC_DETAIL**: Columns 29-121 (93 columns, process details)
- **P_BOP_PROC_CHILD**: Columns 122-142 (21 columns, material BOM)
- **P_BOP_PROC_RES**: Columns 143-181 (39 columns, resource mapping)

### Data Source Management
- **ml_prediction**: Auto-populated from ML timeline data (seq, run_time, JOB_CD, etc.)
- **admin_input**: Fixed values configured by administrator
- **external_source**: Connected to other system modules (e.g., RES_CD from process group management)
- **constant**: Same fixed value for all rows

## Implementation Details

### 1. Schema Updates

#### DataMappingApplyRequest (backend/api/schemas.py:1172-1181)
```python
class DataMappingApplyRequest(BaseModel):
    """데이터 매핑 적용 요청 (라우팅 그룹 데이터 → CSV/XLSX 변환)."""

    profile_id: str
    routing_group_id: str
    routing_group_data: List[Dict[str, Any]]
    preview_only: bool = Field(True)
    export_format: Literal["csv", "xlsx"] = Field("csv")  # NEW FIELD
```

#### DataMappingApplyResponse (backend/api/schemas.py:1193-1204)
```python
class DataMappingApplyResponse(BaseModel):
    """데이터 매핑 적용 결과."""

    profile_id: str
    routing_group_id: str
    columns: List[str]
    preview_rows: List[Dict[str, Any]]
    total_rows: int
    csv_path: Optional[str]  # Updated description to "생성된 CSV/XLSX 파일 경로"
    message: str
```

#### DataMappingRule (backend/api/schemas.py:1103-1144)
```python
class DataMappingRule(BaseModel):
    """데이터 매핑 규칙."""

    routing_field: str
    db_column: str
    display_name: Optional[str]
    data_type: Literal["string", "number", "boolean", "date"]
    is_required: bool = False
    default_value: Optional[str]

    # Data source configuration
    source_type: Literal["ml_prediction", "admin_input", "external_source", "constant"]
    source_config: Optional[Dict[str, Any]]

    transform_rule: Optional[str]
    description: Optional[str]
```

### 2. Service Implementation

#### apply_mapping Method (backend/api/services/data_mapping_service.py:215-244)
```python
# File generation (CSV or XLSX)
export_format = getattr(request, 'export_format', 'csv')

if export_format == 'xlsx':
    csv_path = self._export_to_xlsx(
        columns=columns,
        rows=transformed_rows,
        routing_group_id=request.routing_group_id,
        profile_id=request.profile_id,
    )
else:
    csv_path = self._export_to_csv(
        columns=columns,
        rows=transformed_rows,
        routing_group_id=request.routing_group_id,
        profile_id=request.profile_id,
    )
```

#### _extract_value_by_source_type Method (backend/api/services/data_mapping_service.py:247-286)
```python
def _extract_value_by_source_type(
    self,
    rule: DataMappingRule,
    row_data: Dict[str, Any],
) -> Any:
    """Extract value based on data source type."""

    source_type = getattr(rule, 'source_type', 'ml_prediction')

    if source_type == 'ml_prediction':
        # From ML prediction results (timeline data)
        return row_data.get(rule.routing_field, rule.default_value)

    elif source_type == 'admin_input':
        # Administrator-configured fixed value
        return rule.default_value

    elif source_type == 'constant':
        # Same fixed value for all rows
        return rule.default_value

    elif source_type == 'external_source':
        # From external source (process group management, etc.)
        source_config = getattr(rule, 'source_config', None)
        if source_config and isinstance(source_config, dict):
            external_field = source_config.get('field', rule.routing_field)
            value = row_data.get(external_field)
            if value is not None:
                return value
        return rule.default_value

    return row_data.get(rule.routing_field, rule.default_value)
```

#### _export_to_xlsx Method (backend/api/services/data_mapping_service.py:288-403)
```python
def _export_to_xlsx(
    self,
    columns: List[str],
    rows: List[Dict[str, Any]],
    routing_group_id: str,
    profile_id: str,
) -> str:
    """
    Export data to XLSX file with 5 sheets.

    Sheet structure:
    - 병합1: All 181 columns (MASTER + DETAIL + CHILD + RES)
    - P_BOP_PROC_MASTER: Columns 1-28
    - P_BOP_PROC_DETAIL: Columns 29-121 (93 columns)
    - P_BOP_PROC_CHILD: Columns 122-142 (21 columns)
    - P_BOP_PROC_RES: Columns 143-181 (39 columns)
    """
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment

    # Sheet configuration with column ranges
    sheet_config = {
        "병합1": {"start": 0, "end": len(columns), "columns": columns},
        "P_BOP_PROC_MASTER": {"start": 0, "end": 28, "columns": columns[0:28]},
        "P_BOP_PROC_DETAIL": {"start": 28, "end": 121, "columns": columns[28:121]},
        "P_BOP_PROC_CHILD": {"start": 121, "end": 142, "columns": columns[121:142]},
        "P_BOP_PROC_RES": {"start": 142, "end": 181, "columns": columns[142:181]},
    }

    # Professional header styling
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center")

    # Create workbook and sheets...
    # (Full implementation in data_mapping_service.py)
```

### 3. FKSM Profile Generation

Generated 181-column mapping profile at `config/data_mappings/fksm-merged-181-profile.json`:

**Column Distribution by Source Type**:
- **ML Prediction** (29 columns): seq, run_time, JOB_CD, JOB_NM, etc.
- **External Source** (3 columns): RES_CD, TOOL_CD, TOOL_GRP_CD
- **Admin Input** (149 columns): Company codes, plant codes, dates, etc.

### 4. Dependencies

Added to `requirements.txt`:
```
openpyxl==3.1.2  # Excel file generation (XLSX)
```

## File Changes

### Modified Files
1. `backend/api/schemas.py`
   - Line 1181: Added `export_format` field to DataMappingApplyRequest
   - Line 1103-1144: Extended DataMappingRule with source_type fields
   - Line 1203: Updated csv_path description for CSV/XLSX support

2. `backend/api/services/data_mapping_service.py`
   - Lines 215-244: Updated apply_mapping to support XLSX export
   - Lines 247-286: Added _extract_value_by_source_type method
   - Lines 288-403: Added _export_to_xlsx method with 5-sheet generation

3. `requirements.txt`
   - Added openpyxl==3.1.2

### New Files
1. `config/data_mappings/fksm-merged-181-profile.json`
   - 181-column mapping profile for FKSM structure
   - Categorized by source_type (ml_prediction, admin_input, external_source)

2. `generate_fksm_profile.py`
   - Script to auto-generate FKSM profile from Excel structure

## Features

### XLSX Export Capabilities
1. **Multi-Sheet Generation**: Automatically splits 181 columns into 5 sheets
2. **Professional Styling**: Blue headers, auto-adjusted column widths
3. **Source-Type Awareness**: Intelligent data extraction based on source_type
4. **Backward Compatibility**: CSV export still available (default)
5. **NULL Handling**: Converts None/NULL to empty strings

### Data Mapping System
1. **Three-Tier Mapping**: ML prediction → Admin input → External sources
2. **Profile-Based Configuration**: JSON-based mapping profiles
3. **Type Safety**: Pydantic schemas with Literal types
4. **Flexible Transform Rules**: Support for uppercase, lowercase, trim, etc.

## API Usage

### Request Example
```json
POST /api/data-mapping/apply
{
  "profile_id": "fksm-merged-181-profile",
  "routing_group_id": "RG_20251015_001",
  "routing_group_data": [
    {
      "seq": 10,
      "run_time": 120.5,
      "JOB_CD": "OP10",
      "JOB_NM": "Cutting Process",
      ...
    }
  ],
  "preview_only": false,
  "export_format": "xlsx"
}
```

### Response Example
```json
{
  "profile_id": "fksm-merged-181-profile",
  "routing_group_id": "RG_20251015_001",
  "columns": ["COMP_CD", "PLANT_CD", "PROC_SEQ", ...],
  "preview_rows": [...],
  "total_rows": 45,
  "csv_path": "data_mappings/output/RG_20251015_001_fksm-merged-181-profile_20251015_122430.xlsx",
  "message": "XLSX 파일 생성 완료: data_mappings/output/..."
}
```

## Testing Plan

1. **Unit Tests**
   - Test _extract_value_by_source_type with all source types
   - Test _export_to_xlsx sheet creation and splitting
   - Test column range validation

2. **Integration Tests**
   - End-to-end: Prediction → Timeline → Mapping → XLSX
   - Test with actual FKSM 181-column profile
   - Verify 5-sheet structure and data integrity

3. **Manual Tests**
   - Generate XLSX from routing prediction
   - Open in Excel and verify all 5 sheets
   - Check header styling and column widths
   - Validate data accuracy against ML predictions

## Next Steps

1. **Admin UI Development** (Deferred)
   - Create profile management UI
   - Allow administrators to configure default values
   - Connect external data sources

2. **Process Group Management Integration**
   - Implement external_source connector for RES_CD field
   - Link to process group management module

3. **Domain Migration** (Deferred)
   - Change all URLs to domain names
   - Complete builds for all services

## Notes

- Maintained backward compatibility with existing CSV export
- Used same `csv_path` field for both CSV and XLSX to avoid breaking changes
- XLSX export generates larger files but provides better usability with multiple sheets
- Column ranges are fixed based on FKSM structure (validated against source Excel)

## References

- Source Excel: `FKSM 라우팅 데이터구조.xlsx`
- Profile: `config/data_mappings/fksm-merged-181-profile.json`
- Generator Script: `generate_fksm_profile.py`
