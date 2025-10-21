import pandas as pd
import pytest

from backend import predictor_ml


def test_fetch_work_order_times_prefers_input_item(monkeypatch):
    columns = ['ITEM_CD', 'PROC_SEQ', 'OPERATION_CD', 'ACT_SETUP_TIME', 'ACT_RUN_TIME']
    input_rows = pd.DataFrame(
        [
            ['ITEM-A', 10, 'JOB-1', 12.0, 105.0],
            ['ITEM-A', 10, 'JOB-1', 10.0, 99.0],
            ['ITEM-A', 11, 'JOB-2', 14.0, 130.0],
        ],
        columns=columns,
    )

    fetched_items = []

    def fake_fetch(item_cd):
        fetched_items.append(item_cd)
        if item_cd == 'ITEM-A':
            return input_rows.copy()
        return pd.DataFrame(columns=columns)

    monkeypatch.setattr(predictor_ml, 'fetch_work_results_for_item', fake_fetch)

    result = predictor_ml.fetch_and_calculate_work_order_times('ITEM-A', 10, 'JOB-1')

    assert result['data_source'] == 'input'
    assert result['has_work_data'] is True
    assert result['work_order_count'] == 2
    assert result['predicted_run_time'] == pytest.approx((105.0 + 99.0) / 2, rel=1e-6)
    assert result['source_items'] == ['ITEM-A']
    assert result['confidence'] > 0.3
    assert fetched_items == ['ITEM-A']


def test_fetch_work_order_times_fallback_to_similar_candidates(monkeypatch):
    columns = ['ITEM_CD', 'PROC_SEQ', 'OPERATION_CD', 'ACT_SETUP_TIME', 'ACT_RUN_TIME']

    sim1_rows = pd.DataFrame(
        [
            ['SIM-1', 20, 'JOB-X', 8.0, 80.0],
            ['SIM-1', 20, 'JOB-X', 10.0, 100.0],
        ],
        columns=columns,
    )
    sim2_rows = pd.DataFrame(
        [
            ['SIM-2', 20, 'JOB-X', 6.0, 60.0],
        ],
        columns=columns,
    )

    def fake_fetch(item_cd):
        if item_cd == 'INPUT-ITEM':
            return pd.DataFrame(columns=columns)
        if item_cd == 'SIM-1':
            return sim1_rows.copy()
        if item_cd == 'SIM-2':
            return sim2_rows.copy()
        return pd.DataFrame(columns=columns)

    monkeypatch.setattr(predictor_ml, 'fetch_work_results_for_item', fake_fetch)

    proc_list = [
        {'SOURCE_ITEM': 'SIM-1', 'SIMILARITY': 0.9},
        {'SOURCE_ITEM': 'SIM-1', 'SIMILARITY': 0.85},
        {'SOURCE_ITEM': 'SIM-2', 'SIMILARITY': 0.6},
    ]

    result = predictor_ml.fetch_and_calculate_work_order_times(
        'INPUT-ITEM',
        20,
        'JOB-X',
        similar_candidates=proc_list,
    )

    assert result['data_source'] == 'similar'
    assert result['has_work_data'] is True
    assert sorted(result['source_items']) == ['SIM-1', 'SIM-2']
    assert result['work_order_count'] == 3
    weight_total = (max(1, 2) * 0.9) + (max(1, 1) * 0.6)
    setup_numerator = ((8.0 + 10.0) / 2) * (2 * 0.9) + 6.0 * (1 * 0.6)
    run_numerator = ((80.0 + 100.0) / 2) * (2 * 0.9) + 60.0 * (1 * 0.6)
    assert result['predicted_setup_time'] == pytest.approx(setup_numerator / weight_total, rel=1e-6)
    assert result['predicted_run_time'] == pytest.approx(run_numerator / weight_total, rel=1e-6)
    assert result['confidence'] > 0.2
    assert result['average_similarity'] == pytest.approx((0.9 * 2 + 0.6 * 1) / 3, rel=1e-6)


def test_fetch_work_order_times_returns_none_when_no_data(monkeypatch):
    columns = ['ITEM_CD', 'PROC_SEQ', 'OPERATION_CD', 'ACT_SETUP_TIME', 'ACT_RUN_TIME']

    def always_empty(item_cd):
        return pd.DataFrame(columns=columns)

    monkeypatch.setattr(predictor_ml, 'fetch_work_results_for_item', always_empty)

    result = predictor_ml.fetch_and_calculate_work_order_times(
        'ITEM-Z',
        5,
        'JOB-Z',
        similar_candidates=[{'SOURCE_ITEM': 'ALT-1', 'SIMILARITY': 0.8}],
    )

    assert result['has_work_data'] is False
    assert result['data_source'] == 'none'
    assert result['predicted_setup_time'] is None
    assert result['predicted_run_time'] is None
    assert result['work_order_count'] == 0
    assert result['confidence'] == 0.0
