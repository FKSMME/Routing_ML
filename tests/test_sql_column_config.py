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


def test_sql_column_config_requires_key_columns_inside_output():
    with pytest.raises(ValueError) as exc:
        SQLColumnConfig.from_dict(
            {
                "output_columns": ["ITEM_CD", "CANDIDATE_ID"],
                "available_columns": list(DEFAULT_SQL_OUTPUT_COLUMNS),
                "key_columns": ["ITEM_CD", "ROUTING_SIGNATURE"],
            }
        )
    assert "key_columns" in str(exc.value)


def test_sql_column_config_rejects_training_mapping_outside_output():
    with pytest.raises(ValueError) as exc:
        SQLColumnConfig.from_dict(
            {
                "output_columns": ["ITEM_CD", "CANDIDATE_ID", "ROUTING_SIGNATURE"],
                "available_columns": list(DEFAULT_SQL_OUTPUT_COLUMNS),
                "training_output_mapping": {"item": "SIMILARITY_SCORE"},
            }
        )
    assert "training_output_mapping" in str(exc.value)


def test_sql_column_config_detects_exclusive_group_conflict():
    with pytest.raises(ValueError) as exc:
        SQLColumnConfig.from_dict(
            {
                "output_columns": ["ITEM_CD", "CANDIDATE_ID"],
                "available_columns": list(DEFAULT_SQL_OUTPUT_COLUMNS),
                "exclusive_column_groups": [["ITEM_CD", "CANDIDATE_ID"]],
            }
        )
    assert "상호 배타" in str(exc.value)
