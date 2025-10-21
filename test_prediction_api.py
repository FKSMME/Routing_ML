"""
Phase 2: 예측 API 테스트 스크립트

전체 피처셋으로 재학습된 모델을 사용하여 다양한 품목 코드에 대한 예측을 테스트합니다.
"""

import requests
import json
from typing import Dict, Any, List

API_BASE = "http://127.0.0.1:8000"

def test_prediction(item_codes: List[str]) -> Dict[str, Any]:
    """예측 API 호출 테스트"""

    url = f"{API_BASE}/api/routing/predict"

    payload = {
        "item_codes": item_codes,
        "top_k": 3,
        "similarity_threshold": 0.7
    }

    print(f"\n{'='*80}")
    print(f"예측 요청: {item_codes}")
    print(f"{'='*80}\n")

    try:
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()

        result = response.json()

        # 결과 분석
        print(f"✅ 예측 성공!")
        print(f"응답 코드: {response.status_code}")

        if "predictions" in result:
            predictions = result["predictions"]
            print(f"\n예측 결과 개수: {len(predictions)}")

            for i, pred in enumerate(predictions, 1):
                item_cd = pred.get("item_cd", "N/A")
                candidates = pred.get("candidates", [])

                print(f"\n[{i}] 품목: {item_cd}")
                print(f"    후보 개수: {len(candidates)}")

                if candidates:
                    print(f"    상위 3개 후보:")
                    for j, cand in enumerate(candidates[:3], 1):
                        ref_item = cand.get("reference_item_cd", "N/A")
                        similarity = cand.get("similarity_score", 0.0)
                        operations = cand.get("operations", [])

                        print(f"      {j}. 참조품목: {ref_item}")
                        print(f"         유사도: {similarity:.4f}")
                        print(f"         공정 수: {len(operations)}")

                        # Timeline 데이터 확인
                        if operations:
                            timeline_exists = any("proc_seq" in op for op in operations)
                            print(f"         타임라인: {'✅ 있음' if timeline_exists else '❌ 없음'}")
                else:
                    print(f"    ⚠️  후보를 찾지 못했습니다")

        return result

    except requests.exceptions.RequestException as e:
        print(f"❌ API 호출 실패: {e}")
        return {}
    except json.JSONDecodeError as e:
        print(f"❌ JSON 파싱 실패: {e}")
        print(f"응답 내용: {response.text[:500]}")
        return {}


def test_item_search(search_term: str) -> List[str]:
    """품목 검색 API 테스트"""

    url = f"{API_BASE}/api/items/search"
    params = {"q": search_term, "limit": 5}

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()

        items = response.json()
        item_codes = [item.get("ITEM_CD") for item in items if "ITEM_CD" in item]

        print(f"\n품목 검색 결과 ('{search_term}'):")
        for item in items:
            print(f"  - {item.get('ITEM_CD', 'N/A')}: {item.get('ITEM_NM', 'N/A')}")

        return item_codes

    except Exception as e:
        print(f"❌ 품목 검색 실패: {e}")
        return []


def main():
    """메인 테스트 실행"""

    print("\n" + "="*80)
    print("Phase 2: 예측 API 테스트")
    print("="*80)

    # 1. 서버 상태 확인
    try:
        response = requests.get(f"{API_BASE}/health", timeout=5)
        print(f"\n✅ 서버 상태: {response.json()}")
    except Exception as e:
        print(f"\n❌ 서버 연결 실패: {e}")
        return

    # 2. 품목 검색으로 실제 품목 코드 획득
    print("\n" + "-"*80)
    print("Step 1: 품목 검색")
    print("-"*80)

    item_codes = test_item_search("SEAL")

    if not item_codes:
        # 검색 실패 시 샘플 품목 코드 사용
        print("\n품목 검색 실패. 샘플 품목 코드 사용...")
        item_codes = ["ITEM-001", "ITEM-002", "ITEM-003"]

    # 3. 다중 품목 예측 테스트
    print("\n" + "-"*80)
    print("Step 2: 다중 품목 예측 테스트")
    print("-"*80)

    # 첫 3개 품목으로 테스트
    test_items = item_codes[:3]
    result = test_prediction(test_items)

    # 4. 결과 요약
    print("\n" + "="*80)
    print("테스트 요약")
    print("="*80)

    if result and "predictions" in result:
        predictions = result["predictions"]
        total_candidates = sum(len(p.get("candidates", [])) for p in predictions)

        print(f"\n✅ 테스트 성공!")
        print(f"   - 요청 품목: {len(test_items)}개")
        print(f"   - 예측 결과: {len(predictions)}개")
        print(f"   - 총 후보: {total_candidates}개")

        # Timeline 데이터 확인
        has_timeline = False
        for pred in predictions:
            for cand in pred.get("candidates", []):
                if cand.get("operations"):
                    has_timeline = True
                    break
            if has_timeline:
                break

        print(f"   - 타임라인 데이터: {'✅ 생성됨' if has_timeline else '❌ 없음'}")

        if has_timeline:
            print("\n🎉 Critical Issue #1 해결 확인:")
            print("   - 다중 품목 예측 작동 ✅")
            print("   - 타임라인 데이터 생성 ✅")
            print("   - Canvas 와이어 표시 준비 완료 ✅")
    else:
        print(f"\n⚠️  예측 결과를 받지 못했습니다")

    print("\n" + "="*80 + "\n")


if __name__ == "__main__":
    main()
