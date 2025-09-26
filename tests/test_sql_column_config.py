import pytest

from common.config_store import SQLColumnConfig
from common.sql_schema import DEFAULT_SQL_OUTPUT_COLUMNS


def test_sql_column_config_rejects_unknown_output_column():
    with pytest.raises(ValueError) as exc:
        SQLColumnConfig.from_dict(
            {
                "output_columns": ["ITEM_CD", "UNKNOWN_COL"],
                "available_columns": list(DEFAULT_SQL_OUTPUT_COLUMNS),
            }
        )
    assert "output_columns" in str(exc.value)


def test_sql_column_config_rejects_invalid_alias_target():
    config = SQLColumnConfig.from_dict({})
    config.column_aliases["INVALID"] = "SOME_UNKNOWN_COLUMN"
    with pytest.raises(ValueError) as exc:
        config.validate_columns()
    assert "column_aliases" in str(exc.value)
