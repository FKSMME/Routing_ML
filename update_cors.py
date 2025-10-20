# -*- coding: utf-8 -*-
"""CORS 설정 업데이트"""

# 파일 읽기
with open("backend/api/config.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

# 새로운 CORS 설정
new_cors_lines = [
    "    allowed_origins: List[str] = Field(\n",
    "        default_factory=lambda: [\n",
    "            "http://localhost:3000",\n",
    "            "http://127.0.0.1:3000",\n",
    "            "http://localhost:5173",\n",
    "            "http://127.0.0.1:5173",\n",
    "            "http://localhost:5174",\n",
    "            "http://127.0.0.1:5174",\n",
    "            "http://localhost:5175",\n",
    "            "http://127.0.0.1:5175",\n",
    "            "http://localhost:5176",\n",
    "            "http://127.0.0.1:5176",\n",
    "            "http://10.204.2.28:3000",\n",
    "            "http://10.204.2.28:5173",\n",
    "            "http://10.204.2.28:5174",\n",
    "            "http://10.204.2.28:5176",\n",
    "            "https://rtml.ksm.co.kr:3000",\n",
    "            "https://rtml.ksm.co.kr:5173",\n",
    "            "https://rtml.ksm.co.kr:5174",\n",
    "            "https://rtml.ksm.co.kr:5176",\n",
    "            "https://mcs.ksm.co.kr:3000",\n",
    "            "https://mcs.ksm.co.kr:5173",\n",
    "            "https://mcs.ksm.co.kr:5174",\n",
    "            "https://mcs.ksm.co.kr:5176",\n",
    "        ],\n",
    "    )\n",
]
    "        default_factory=lambda: [\n",
    "            \"http://localhost:3000\",\n",
    "            \"http://127.0.0.1:3000\",\n",
    "            \"http://localhost:5173\",\n",
    "            \"http://127.0.0.1:5173\",\n",
    "            \"http://localhost:5174\",\n",
    "            \"http://127.0.0.1:5174\",\n",
    "            \"http://localhost:5175\",\n",
    "            \"http://127.0.0.1:5175\",\n",
    "            \"http://localhost:5176\",\n",
    "            \"http://127.0.0.1:5176\",\n",
    "            \"http://10.204.2.28:3000\",\n",
    "            \"http://10.204.2.28:5173\",\n",
    "            \"http://10.204.2.28:5174\",\n",
    "            \"http://10.204.2.28:5176\",\n",
    "            \"http://rtml.ksm.co.kr:3000\",\n",
    "            \"http://rtml.ksm.co.kr:5173\",\n",
    "            \"http://rtml.ksm.co.kr:5174\",\n",
    "            \"http://rtml.ksm.co.kr:5176\",\n",
    "            \"http://mcs.ksm.co.kr:3000\",\n",
    "            \"http://mcs.ksm.co.kr:5173\",\n",
    "            \"http://mcs.ksm.co.kr:5174\",\n",
    "            \"http://mcs.ksm.co.kr:5176\",\n",
    "        ],\n",
    "    )\n",
]

# 라인 40(인덱스 40)부터 53(인덱스 53)까지 교체
new_lines = lines[:40] + new_cors_lines + lines[54:]

# 파일 쓰기
with open("backend/api/config.py", "w", encoding="utf-8") as f:
    f.writelines(new_lines)

print("CORS updated successfully!")
print("Added origins:")
print("  - http://10.204.2.28:*")
print("  - https://rtml.ksm.co.kr:*")
print("  - https://mcs.ksm.co.kr:*")
