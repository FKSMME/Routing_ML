"""
CORS 설정 패치 스크립트
rtml.ksm.co.kr 도메인 추가
"""

import re

config_file = "backend/api/config.py"

# 파일 읽기
with open(config_file, "r", encoding="utf-8") as f:
    content = f.read()

# allowed_origins 섹션 찾기 및 수정
old_pattern = r'allowed_origins: List\[str\] = Field\(\s+default_factory=lambda: \[\s+("http://localhost:3000",.*?"http://127\.0\.0\.1:5176",)\s+\],'

new_origins = '''allowed_origins: List[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:5175",
            "http://127.0.0.1:5175",
            "http://localhost:5176",
            "http://127.0.0.1:5176",
            "http://10.204.2.28:3000",
            "http://10.204.2.28:5173",
            "http://10.204.2.28:5174",
            "http://rtml.ksm.co.kr:3000",
            "http://rtml.ksm.co.kr:5173",
            "http://rtml.ksm.co.kr:5174",
            "http://mcs.ksm.co.kr:3000",
            "http://mcs.ksm.co.kr:5173",
            "http://mcs.ksm.co.kr:5174",
        ],'''

# 간단한 방법: 라인 번호로 직접 수정
lines = content.split('\n')
new_lines = []
skip_until = 0

for i, line in enumerate(lines, 1):
    if skip_until > 0:
        if skip_until == i:
            skip_until = 0
        continue

    if i == 41 and 'allowed_origins' in line:
        # 41번 라인부터 54번 라인까지 교체
        new_lines.append(new_origins)
        skip_until = 54
    else:
        new_lines.append(line)

# 파일 쓰기
with open(config_file, "w", encoding="utf-8") as f:
    f.write('\n'.join(new_lines))

print("✅ CORS 설정 패치 완료!")
print("추가된 도메인:")
print("  - http://10.204.2.28:*")
print("  - http://rtml.ksm.co.kr:*")
print("  - http://mcs.ksm.co.kr:*")
