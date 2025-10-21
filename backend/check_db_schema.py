"""데이터베이스 스키마 확인 스크립트"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.database import describe_table, VIEW_ITEM_MASTER, VIEW_ROUTING

print("=" * 80)
print("BI_ITEM_INFO_VIEW 컬럼 확인")
print("=" * 80)
try:
    item_columns = describe_table(VIEW_ITEM_MASTER)
    print(f"\n총 {len(item_columns)}개 컬럼:\n")
    for i, col in enumerate(item_columns, 1):
        print(f"{i:3d}. {col['name']:30s} {col['type']:20s} {'NULL' if col['nullable'] else 'NOT NULL'}")

    # 특정 컬럼 존재 여부 확인
    column_names = [col['name'] for col in item_columns]
    print("\n\n누락 컬럼 확인:")
    check_cols = ['ITEM_GRP2', 'ITEM_GRP2NM', 'ITEM_GRP3', 'ITEM_GRP3NM', 'INSRT_DT', 'MODI_DT']
    for col in check_cols:
        exists = col in column_names
        print(f"  {col:20s}: {'✓ EXISTS' if exists else '✗ NOT FOUND'}")

except Exception as e:
    print(f"ERROR: {e}")

print("\n" + "=" * 80)
print("BI_ROUTING_HIS_VIEW 컬럼 확인")
print("=" * 80)
try:
    routing_columns = describe_table(VIEW_ROUTING)
    print(f"\n총 {len(routing_columns)}개 컬럼:\n")
    for i, col in enumerate(routing_columns, 1):
        print(f"{i:3d}. {col['name']:30s} {col['type']:20s} {'NULL' if col['nullable'] else 'NOT NULL'}")

    # 특정 컬럼 존재 여부 확인
    column_names = [col['name'] for col in routing_columns]
    print("\n\n누락 컬럼 확인:")
    check_cols = ['INSRT_DT', 'MODI_DT']
    for col in check_cols:
        exists = col in column_names
        print(f"  {col:20s}: {'✓ EXISTS' if exists else '✗ NOT FOUND'}")

except Exception as e:
    print(f"ERROR: {e}")

print("\n" + "=" * 80)
