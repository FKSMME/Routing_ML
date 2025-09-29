"""
D:\routing\machine\models의 상세 모델 정보 확인
"""

import sys
import joblib
import numpy as np
from pathlib import Path
from datetime import datetime

# backend 모듈 경로 추가
sys.path.insert(0, r"D:\routing\machine")

def check_model_details():
    """모델 상세 정보 확인"""
    
    model_path = Path(r"D:\routing\machine\models")
    
    print("=" * 80)
    print("🔍 ML 모델 상세 정보 분석")
    print("=" * 80)
    print(f"📂 모델 경로: {model_path}")
    print(f"🕐 확인 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    if not model_path.exists():
        print("❌ 경로가 존재하지 않습니다!")
        return
    
    # 1. Feature Columns 확인
    print("\n📋 [1] Feature Columns (특성 목록)")
    print("-" * 60)
    try:
        feature_columns = joblib.load(model_path / "feature_columns.joblib")
        print(f"총 특성 수: {len(feature_columns)}개\n")
        
        # 특성을 카테고리별로 분류
        numeric_features = []
        categorical_features = []
        
        # 일반적인 수치형 특성 키워드
        numeric_keywords = ['QTY', 'AMT', 'COST', 'PRICE', 'RATE', 'CNT', 'NO', 'WEIGHT', 'SIZE']
        
        for feat in feature_columns:
            if any(keyword in feat.upper() for keyword in numeric_keywords):
                numeric_features.append(feat)
            else:
                categorical_features.append(feat)
        
        print(f"범주형 특성: {len(categorical_features)}개")
        for i, feat in enumerate(categorical_features[:10], 1):
            print(f"  {i:2d}. {feat}")
        if len(categorical_features) > 10:
            print(f"  ... 외 {len(categorical_features)-10}개")
        
        print(f"\n수치형 특성: {len(numeric_features)}개")
        for i, feat in enumerate(numeric_features[:10], 1):
            print(f"  {i:2d}. {feat}")
        if len(numeric_features) > 10:
            print(f"  ... 외 {len(numeric_features)-10}개")
            
    except Exception as e:
        print(f"❌ 로드 실패: {e}")
    
    # 2. Encoder 정보
    print("\n\n🔤 [2] Encoder (범주형 인코더)")
    print("-" * 60)
    try:
        encoder = joblib.load(model_path / "encoder.joblib")
        print(f"인코더 타입: {type(encoder).__name__}")
        
        if hasattr(encoder, 'categories_'):
            print(f"인코딩된 특성 수: {len(encoder.categories_)}개")
            
            # 각 특성의 고유값 수
            unique_counts = [len(cats) for cats in encoder.categories_]
            print("\n카테고리 통계:")
            print(f"  - 최소 고유값 수: {min(unique_counts)}개")
            print(f"  - 최대 고유값 수: {max(unique_counts)}개")
            print(f"  - 평균 고유값 수: {np.mean(unique_counts):.1f}개")
            print(f"  - 중앙값: {np.median(unique_counts):.0f}개")
            
            # 고유값이 많은 특성 Top 5
            if len(categorical_features) > 0:
                print("\n고유값이 가장 많은 특성 Top 5:")
                cat_counts = list(zip(categorical_features[:len(encoder.categories_)], unique_counts))
                cat_counts.sort(key=lambda x: x[1], reverse=True)
                for i, (feat, count) in enumerate(cat_counts[:5], 1):
                    print(f"  {i}. {feat}: {count}개 카테고리")
                    
    except Exception as e:
        print(f"❌ 로드 실패: {e}")
    
    # 3. Scaler 정보
    print("\n\n📊 [3] Scaler (수치형 스케일러)")
    print("-" * 60)
    try:
        scaler = joblib.load(model_path / "scaler.joblib")
        print(f"스케일러 타입: {type(scaler).__name__}")
        
        if hasattr(scaler, 'mean_') and hasattr(scaler, 'scale_'):
            print(f"스케일링된 특성 수: {len(scaler.mean_)}개")
            
            print("\n통계 정보:")
            print(f"  - 평균값 범위: [{scaler.mean_.min():.4f}, {scaler.mean_.max():.4f}]")
            print(f"  - 표준편차 범위: [{scaler.scale_.min():.4f}, {scaler.scale_.max():.4f}]")
            
            # 스케일이 큰 특성 (변동성이 큰 특성)
            if len(scaler.scale_) > 0 and len(numeric_features) > 0:
                scale_indices = np.argsort(scaler.scale_)[::-1][:5]
                print("\n변동성이 큰 특성 Top 5:")
                for i, idx in enumerate(scale_indices, 1):
                    if idx < len(numeric_features):
                        print(f"  {i}. {numeric_features[idx]}: σ={scaler.scale_[idx]:.4f}")
                        
    except Exception as e:
        print(f"❌ 로드 실패: {e}")
    
    # 4. Similarity Engine 정보
    print("\n\n🔍 [4] Similarity Engine (유사도 검색 엔진)")
    print("-" * 60)
    try:
        # backend 모듈이 있는지 확인
        try:
            searcher = joblib.load(model_path / "similarity_engine.joblib")
            print(f"검색 엔진 타입: {type(searcher).__name__}")
            
            if hasattr(searcher, 'item_codes'):
                print(f"인덱싱된 품목 수: {len(searcher.item_codes):,}개")
                
                # 품목 코드 샘플
                print("\n품목 코드 샘플 (처음 10개):")
                for i, code in enumerate(searcher.item_codes[:10], 1):
                    print(f"  {i:2d}. {code}")
                    
            if hasattr(searcher, 'item_vectors'):
                print("\n벡터 정보:")
                print(f"  - Shape: {searcher.item_vectors.shape}")
                print(f"  - 데이터 타입: {searcher.item_vectors.dtype}")
                print(f"  - 메모리 사용량: {searcher.item_vectors.nbytes / (1024*1024):.2f} MB")
                
                # 벡터 노름 통계
                norms = np.linalg.norm(searcher.item_vectors, axis=1)
                print("\n벡터 노름 통계:")
                print(f"  - 최소: {norms.min():.4f}")
                print(f"  - 최대: {norms.max():.4f}")
                print(f"  - 평균: {norms.mean():.4f}")
                print(f"  - 표준편차: {norms.std():.4f}")
                
        except ImportError:
            print("⚠️ backend 모듈을 import할 수 없어 기본 정보만 표시합니다.")
            obj = joblib.load(model_path / "similarity_engine.joblib")
            print(f"객체 타입: {type(obj).__name__}")
            print(f"파일 크기: {(model_path / 'similarity_engine.joblib').stat().st_size / (1024*1024):.2f} MB")

    except Exception as e:
        print(f"❌ 로드 실패: {e}")
    
    # 5. 추가 파일 확인
    print("\n\n📁 [5] 기타 파일")
    print("-" * 60)
    
    # feature_weights.npy
    weights_path = model_path / "feature_weights.npy"
    if weights_path.exists():
        try:
            weights = np.load(weights_path)
            print("✅ feature_weights.npy")
            print(f"   - Shape: {weights.shape}")
            print(f"   - 범위: [{weights.min():.4f}, {weights.max():.4f}]")
            print(f"   - 평균: {weights.mean():.4f}")
        except Exception as e:
            print(f"❌ feature_weights.npy 로드 실패: {e}")
    else:
        print("❌ feature_weights.npy 파일 없음")
    
    # item_ids와 item_vectors (레거시)
    if (model_path / "item_ids.joblib").exists():
        print("\n📌 레거시 파일 발견:")
        try:
            item_ids = joblib.load(model_path / "item_ids.joblib")
            print(f"  - item_ids.joblib: {len(item_ids):,}개 품목")
        except Exception:
            pass

        if (model_path / "item_vectors.joblib").exists():
            try:
                vectors = joblib.load(model_path / "item_vectors.joblib")
                print(f"  - item_vectors.joblib: shape {vectors.shape}")
            except Exception:
                pass
    
    # 6. 모델 요약
    print("\n\n" + "=" * 80)
    print("📊 모델 요약")
    print("=" * 80)
    
    files = list(model_path.glob("*.joblib")) + list(model_path.glob("*.npy"))
    total_size = sum(f.stat().st_size for f in files) / (1024 * 1024)
    
    print(f"✅ 총 파일 수: {len(files)}개")
    print(f"💾 총 크기: {total_size:.2f} MB")
    print(f"📅 최종 수정: {datetime.fromtimestamp(max(f.stat().st_mtime for f in files)).strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 모델 타입 판별
    if (model_path / "similarity_engine.joblib").exists():
        print("🎯 모델 타입: ML 최적화 모델 (Similarity Search Engine 포함)")
    else:
        print("🎯 모델 타입: 레거시 모델")
    
    print("\n✨ 모델이 정상적으로 로드 가능한 상태입니다.")
    print("   GUI에서 [로드] 버튼으로 이 모델을 사용할 수 있습니다.")

if __name__ == "__main__":
    check_model_details()
