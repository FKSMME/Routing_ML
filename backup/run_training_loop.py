# -------------------------------------------------------------
# run_training_loop.py
# 3회 연속 학습을 수행해 logs/train_summary.jsonl 에 누적 기록
# -------------------------------------------------------------
"""CLI: python run_training_loop.py [runs]

기존 backend.trainer.train_model() 코드를 **수정하지 않고**
지정 횟수만큼 반복 학습합니다. 각 회차가 끝나면 trainer._log_training_stats()
를 호출해 동일 포맷(JSONL)으로 로그에 누적 저장하고,
추가로 모든 회차의 요약을 logs/multi_run_summary.json 에 남깁니다.
"""

import argparse
import datetime
import json
import os
import pathlib

from backend import trainer
from backend.database import fetch_all_items_from_db


def single_run(run_idx: int, df):
    print(f"\n=== Run {run_idx} 시작 ===")
    model, enc, scaler, ref_data, feat_cols, num_cols, hist = trainer.train_model()

    # trainer._log_training_stats 는 내부에서 파일 append
    trainer._log_training_stats(
        df, feat_cols, num_cols, model,
        settings={
            "val_split": 0.2,
            "noise_std": None,
        },
    )

    return {
        "run": run_idx,
        "timestamp": datetime.datetime.now().isoformat(),
        "final_loss": float(hist.history["loss"][-1]),
        "final_val_loss": float(hist.history["val_loss"][-1]),
        "epochs": len(hist.history["loss"]),
        "params": int(model.count_params()),
    }


def main(runs: int):
    df_all = fetch_all_items_from_db()
    summaries = [single_run(i + 1, df_all) for i in range(runs)]

    log_dir = pathlib.Path("logs")
    log_dir.mkdir(exist_ok=True)
    with open(log_dir / "multi_run_summary.json", "w", encoding="utf-8") as f:
        json.dump(summaries, f, ensure_ascii=False, indent=2)

    print("\n✔ 모든 학습 완료 — logs/multi_run_summary.json 저장")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=3, help="반복 학습 횟수 (default: 3)")
    args = parser.parse_args()
    main(args.runs)
