# 이미 모델 로드돼 있다고 가정
from backend.trainer_ml import load_optimized_model
searcher, *_ = load_optimized_model(r"D:\routing\machine\models")

# 벡터 0번(A품목)과 1번(B품목) 구분해보기
code_a = searcher.item_codes[0]          # 예: '4H69065ZZ'
code_b = searcher.item_codes[1]          # 예: '00-098004'

print("A:", code_a)
print("B:", code_b)

# (1) A벡터로 질의 → 당연히 A가 가장 유사
print(searcher.find_similar(searcher.vectors[0], 1))

# (2) B벡터로 질의 → B가 나와야 정상
print(searcher.find_similar(searcher.vectors[1], 1))

# (3) A벡터로 Top-3 보기
print(searcher.find_similar(searcher.vectors[0], 3))
