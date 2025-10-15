# MCS Server Dashboard v5.0.0 - 빌드 및 배포 가이드

## 개요

이 가이드는 MCS Server Dashboard v5.0.0의 빌드 및 배포 프로세스를 설명합니다.

---

## 빌드 종류

### 1. Portable Version (실행형)
- **파일명**: `MCS_Server_Dashboard_v5.0.0_Portable.exe`
- **특징**:
  - 단일 실행 파일
  - 설치 불필요
  - USB 메모리에서 실행 가능
  - 레지스트리 사용 안 함
- **용도**: 임시 사용, 테스트, 이동식 환경

### 2. Installer Version (설치형)
- **파일명**: `MCS_Server_Dashboard_v5.0.0_Setup.exe`
- **특징**:
  - Windows 표준 설치 프로그램
  - 시작 메뉴 단축키 생성
  - 바탕화면 아이콘 옵션
  - 제어판에서 제거 가능
- **용도**: 영구 설치, 프로덕션 환경

---

## 빌드 요구사항

### 필수 소프트웨어
1. **Python 3.8+**
   - 가상환경 활성화 필요
   - 경로: `.venv\Scripts\python.exe`

2. **PyInstaller**
   ```bash
   pip install pyinstaller
   ```

3. **psutil**
   ```bash
   pip install psutil
   ```

4. **Inno Setup 6.x** (설치형만 해당)
   - 다운로드: https://jrsoftware.org/isdl.php
   - 기본 설치 경로: `C:\Program Files (x86)\Inno Setup 6\`

### 시스템 요구사항
- **OS**: Windows 10/11 (64-bit)
- **RAM**: 최소 2GB
- **디스크**: 500MB 여유 공간

---

## 빌드 방법

### 옵션 1: 통합 빌드 (권장)

**모든 버전을 한 번에 빌드**:

```bash
cd c:\Users\syyun\Documents\GitHub\Routing_ML_251014
deploy\build_all_v5.bat
```

**빌드 프로세스**:
```
[Step 1/7] 가상환경 활성화
[Step 2/7] 의존성 확인 및 설치
[Step 3/7] 이전 빌드 아티팩트 정리
[Step 4/7] Portable 버전 빌드 (PyInstaller)
[Step 5/7] Installer 디렉토리 빌드 (PyInstaller)
[Step 6/7] Setup 실행 파일 생성 (Inno Setup)
[Step 7/7] 빌드 요약
```

**예상 소요 시간**:
- Portable: ~2-3분
- Installer: ~2-3분
- Setup: ~1분
- **총**: ~5-7분

### 옵션 2: 개별 빌드

#### Portable 버전만 빌드
```bash
.venv\Scripts\python.exe -m PyInstaller --clean RoutingMLMonitor_v5_Portable.spec
```

**출력**:
- `dist\MCS_Server_Dashboard_v5.0.0_Portable.exe`

#### Installer 버전만 빌드
```bash
# 1. PyInstaller로 디렉토리 생성
.venv\Scripts\python.exe -m PyInstaller --clean RoutingMLMonitor_v5_Installer.spec

# 2. Inno Setup으로 설치 파일 생성
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" setup_installer_v5.iss
```

**출력**:
- `dist\MCS_Server_Dashboard_v5.0.0\` (디렉토리)
- `dist\installer\MCS_Server_Dashboard_v5.0.0_Setup.exe` (설치 파일)

---

## 빌드 출력 구조

```
Routing_ML_251014/
├── dist/
│   ├── MCS_Server_Dashboard_v5.0.0_Portable.exe  # Portable 버전
│   │
│   ├── MCS_Server_Dashboard_v5.0.0/              # Installer 디렉토리
│   │   ├── MCS_Server_Dashboard.exe              # 메인 실행 파일
│   │   ├── _internal/                            # 의존성 파일들
│   │   │   ├── *.dll
│   │   │   ├── *.pyd
│   │   │   └── ...
│   │   ├── docs/
│   │   │   └── DASHBOARD_V5_RELEASE_NOTES.md
│   │   ├── VERSION.txt
│   │   └── README.md
│   │
│   └── installer/
│       └── MCS_Server_Dashboard_v5.0.0_Setup.exe # Setup 실행 파일
│
├── build/                                         # 임시 빌드 파일 (자동 삭제)
└── *.spec                                         # PyInstaller 스펙 파일
```

---

## 파일 크기 비교

| 버전 | 파일 크기 | 파일 개수 |
|------|-----------|-----------|
| Portable | ~35-40 MB | 1 |
| Installer (디렉토리) | ~30-35 MB | ~50 |
| Setup (설치 파일) | ~15-20 MB | 1 (압축) |

---

## 빌드 설정

### PyInstaller 최적화 옵션

#### `RoutingMLMonitor_v5_Portable.spec`
```python
# 제외할 모듈 (크기 축소)
excludes=[
    'matplotlib',  # 차트 라이브러리 (사용 안 함)
    'numpy',       # 수치 연산 (사용 안 함)
    'pandas',      # 데이터 분석 (사용 안 함)
    'scipy',       # 과학 연산 (사용 안 함)
    'PIL',         # 이미지 처리 (사용 안 함)
    'wx',          # wxPython (사용 안 함)
],

# 최적화 레벨
optimize=2,  # 최대 최적화

# UPX 압축 활성화
upx=True,
```

### Inno Setup 압축 설정

#### `setup_installer_v5.iss`
```ini
; 최대 압축
Compression=lzma2/max
SolidCompression=yes
LZMAUseSeparateProcess=yes
LZMANumBlockThreads=4
```

---

## 배포 방법

### 방법 1: 로컬 배포 (사내)

#### Portable 버전
```bash
# USB 또는 네트워크 드라이브에 복사
copy dist\MCS_Server_Dashboard_v5.0.0_Portable.exe Z:\Tools\

# 사용자에게 안내
"Z:\Tools\MCS_Server_Dashboard_v5.0.0_Portable.exe를 실행하세요"
```

#### Installer 버전
```bash
# 네트워크 공유 폴더에 Setup 파일 배포
copy dist\installer\MCS_Server_Dashboard_v5.0.0_Setup.exe \\server\share\Software\

# 사용자에게 안내
"\\server\share\Software\MCS_Server_Dashboard_v5.0.0_Setup.exe를 실행하여 설치하세요"
```

### 방법 2: 클라우드 배포

#### GitHub Releases
```bash
# 1. Git 태그 생성
git tag -a v5.0.0 -m "Release v5.0.0"
git push origin v5.0.0

# 2. GitHub에서 Release 생성
# 3. 빌드 파일 업로드:
#    - MCS_Server_Dashboard_v5.0.0_Portable.exe
#    - MCS_Server_Dashboard_v5.0.0_Setup.exe
```

#### 체크섬 생성 (무결성 검증)
```bash
# SHA256 해시 생성 (PowerShell)
Get-FileHash dist\MCS_Server_Dashboard_v5.0.0_Portable.exe -Algorithm SHA256
Get-FileHash dist\installer\MCS_Server_Dashboard_v5.0.0_Setup.exe -Algorithm SHA256

# 결과를 CHECKSUMS.txt에 저장
```

### 방법 3: 자동 업데이트

**향후 버전에서 지원 예정**:
- 자동 업데이트 체크
- 백그라운드 다운로드
- 무중단 업그레이드

---

## 설치 가이드 (최종 사용자용)

### Portable 버전 사용법

1. **다운로드**
   - `MCS_Server_Dashboard_v5.0.0_Portable.exe` 다운로드

2. **실행**
   - 파일을 더블클릭
   - Windows Defender 경고 시:
     - "추가 정보" → "실행" 클릭

3. **사용**
   - 설치 없이 즉시 사용 가능
   - 원하는 폴더에 배치 가능

4. **제거**
   - 파일 삭제만 하면 됨
   - 레지스트리 잔여물 없음

### Installer 버전 설치법

1. **다운로드**
   - `MCS_Server_Dashboard_v5.0.0_Setup.exe` 다운로드

2. **설치**
   - Setup 파일 실행
   - 설치 마법사 따라가기:
     ```
     [환영] → [라이선스] → [경로 선택] → [설치] → [완료]
     ```
   - 기본 설치 경로: `C:\Program Files\MCS Server Dashboard\`

3. **실행**
   - 시작 메뉴: "MCS Server Dashboard"
   - 바탕화면 아이콘 (옵션)

4. **제거**
   - 제어판 → 프로그램 제거
   - 또는 시작 메뉴 → "Uninstall MCS Server Dashboard"

---

## 트러블슈팅

### 빌드 오류

#### 오류 1: "PyInstaller not found"
```bash
# 해결 방법
pip install pyinstaller
```

#### 오류 2: "No module named 'psutil'"
```bash
# 해결 방법
pip install psutil
```

#### 오류 3: "UPX is not available"
```bash
# UPX 다운로드 및 설치
# https://upx.github.io/
# PATH 환경변수에 추가
```

#### 오류 4: "Inno Setup not found"
```bash
# Inno Setup 설치
# https://jrsoftware.org/isdl.php
# 기본 경로에 설치: C:\Program Files (x86)\Inno Setup 6\
```

### 실행 오류

#### 오류 1: "Windows Defender SmartScreen 경고"
**증상**: "Windows의 PC 보호" 메시지

**해결 방법**:
```
1. "추가 정보" 클릭
2. "실행" 버튼 클릭
3. (장기적) 코드 서명 인증서 구매 및 적용
```

#### 오류 2: "VCRUNTIME140.dll이 없습니다"
**증상**: 실행 시 DLL 누락 오류

**해결 방법**:
```
Microsoft Visual C++ Redistributable 설치
https://aka.ms/vs/17/release/vc_redist.x64.exe
```

#### 오류 3: "관리자 권한이 필요합니다"
**증상**: 설치 시 권한 오류

**해결 방법**:
```
Setup 파일 우클릭 → "관리자 권한으로 실행"
```

---

## 버전 관리

### 버전 번호 규칙
```
v5.0.0
│ │ └─ Patch: 버그 수정
│ └─── Minor: 기능 추가
└───── Major: 대규모 변경
```

### 버전 업데이트 체크리스트

새 버전 릴리스 시:

- [ ] `VERSION.txt` 파일 업데이트
- [ ] `__version__` 변수 업데이트 (Python 파일)
- [ ] PyInstaller 스펙 파일의 버전 업데이트
- [ ] Inno Setup 스크립트의 버전 업데이트
- [ ] 릴리스 노트 작성
- [ ] CHANGELOG.md 업데이트
- [ ] Git 태그 생성

---

## 성능 최적화

### 빌드 시간 단축

1. **병렬 빌드 비활성화**
   ```python
   # spec 파일에서
   multiprocessing=False
   ```

2. **UPX 압축 건너뛰기** (개발 중)
   ```python
   upx=False,
   ```

3. **증분 빌드**
   ```bash
   # --clean 옵션 제거
   pyinstaller --noconfirm RoutingMLMonitor_v5_Portable.spec
   ```

### 파일 크기 축소

1. **불필요한 모듈 제외**
   ```python
   excludes=['matplotlib', 'numpy', 'pandas', ...]
   ```

2. **UPX 압축 활성화**
   ```python
   upx=True,
   ```

3. **최적화 레벨 증가**
   ```python
   optimize=2,
   ```

---

## 보안 고려사항

### 코드 서명

**이점**:
- Windows Defender SmartScreen 경고 제거
- 사용자 신뢰도 증가
- 악성 코드 변조 방지

**방법**:
```bash
# 1. 코드 서명 인증서 구매 (예: DigiCert, Sectigo)
# 2. SignTool로 서명
signtool sign /f certificate.pfx /p password /t http://timestamp.digicert.com dist\MCS_Server_Dashboard_v5.0.0_Portable.exe
```

### 바이러스 백신 오탐지

**문제**: PyInstaller로 빌드한 EXE가 바이러스로 오인될 수 있음

**해결 방법**:
1. **코드 서명** (가장 효과적)
2. **VirusTotal 제출**: 주요 백신 벤더에 false positive 신고
3. **사용자 안내**: 신뢰할 수 있는 출처에서 다운로드

---

## CI/CD 통합 (향후)

### GitHub Actions 예제

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          pip install pyinstaller psutil
      - name: Build Portable
        run: |
          pyinstaller --clean RoutingMLMonitor_v5_Portable.spec
      - name: Upload artifacts
        uses: actions/upload-artifact@v2
        with:
          name: portable
          path: dist/*.exe
```

---

## 체크리스트

### 릴리스 전 확인사항

#### 빌드 테스트
- [ ] Portable 버전이 정상적으로 실행되는가?
- [ ] Installer 버전이 정상적으로 설치/제거되는가?
- [ ] 모든 기능이 정상 작동하는가?
- [ ] 백신 프로그램이 차단하지 않는가?

#### 문서 확인
- [ ] VERSION.txt 업데이트됨
- [ ] 릴리스 노트 작성됨
- [ ] 사용자 가이드 업데이트됨
- [ ] 빌드 가이드 업데이트됨

#### 배포 준비
- [ ] 체크섬 파일 생성됨
- [ ] GitHub Release 준비됨
- [ ] 변경 이력 작성됨

---

## 참고 자료

### 공식 문서
- PyInstaller: https://pyinstaller.org/
- Inno Setup: https://jrsoftware.org/isinfo.php
- psutil: https://github.com/giampaolo/psutil

### 관련 가이드
- [사용자 가이드](SERVER_DASHBOARD_V5_GUIDE.md)
- [릴리스 노트](../../DASHBOARD_V5_RELEASE_NOTES.md)

---

**Last Updated**: 2025-01-15
**Version**: 5.0.0
