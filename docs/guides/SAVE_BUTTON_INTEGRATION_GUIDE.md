# SaveButtonDropdown 통합 가이드

**작성 시간**: 2025-10-05 07:00 UTC
**대상 파일**: `frontend-prediction/src/components/RoutingGroupControls.tsx`

---

## 📋 개요

`SaveButtonDropdown` 컴포넌트를 기존 `RoutingGroupControls`에 통합하는 방법을 설명합니다.

---

## 🔧 통합 단계

### 1. Import 추가

```typescript
import { SaveButtonDropdown } from "./SaveButtonDropdown";
```

### 2. 기존 SAVE 버튼 로직 분리

기존 `RoutingGroupControls.tsx`의 저장 관련 상태와 함수를 확인:

```typescript
// 현재 구조 (예상)
const [format, setFormat] = useState<FileFormat>("CSV");
const [destination, setDestination] = useState<Destination>("local");
const [saving, setSaving] = useState(false);

const handleSave = async () => {
  // 저장 로직
};

const handleLocalExport = async () => {
  // 로컬 저장 로직
};

const handleClipboardExport = async () => {
  // 클립보드 저장 로직
};
```

### 3. SaveButtonDropdown 콜백 연결

```typescript
const handleSaveFromDropdown = async (
  selectedFormat: FileFormat,
  selectedDestination: Destination
) => {
  setSaving(true);
  try {
    if (selectedDestination === "local") {
      await handleLocalExportWithFormat(selectedFormat);
    } else if (selectedDestination === "clipboard") {
      await handleClipboardExportWithFormat(selectedFormat);
    }
  } catch (error) {
    console.error("저장 실패:", error);
    throw error; // SaveButtonDropdown에서 토스트로 표시
  } finally {
    setSaving(false);
  }
};
```

### 4. 기존 버튼 교체

**Before**:
```tsx
<button
  type="button"
  className="primary-button"
  onClick={handleSave}
  disabled={disabledSave}
>
  <Save size={16} />
  {saving ? "처리 중..." : "저장"}
</button>
```

**After**:
```tsx
<SaveButtonDropdown
  onSave={handleSaveFromDropdown}
  disabled={disabledSave}
  saving={saving}
  defaultFormat="CSV"
  defaultDestination="local"
/>
```

---

## 📝 전체 통합 예제

```typescript
// RoutingGroupControls.tsx 일부

import { SaveButtonDropdown } from "./SaveButtonDropdown";

// ... 기존 코드 ...

export function RoutingGroupControls({ variant = "panel" }: RoutingGroupControlsProps) {
  // ... 기존 상태들 ...
  const [saving, setSaving] = useState(false);

  // 포맷별 로컬 저장 함수
  const handleLocalExportWithFormat = async (format: FileFormat) => {
    const timeline = useRoutingStore.getState().timeline;

    switch (format) {
      case "CSV":
        await exportToCSV(timeline);
        break;
      case "XML":
        await exportToXML(timeline);
        break;
      case "JSON":
        await exportToJSON(timeline);
        break;
      case "Excel":
        await exportToExcel(timeline);
        break;
      case "ACCESS":
        throw new Error("ACCESS는 로컬 저장을 지원하지 않습니다. 서버에 저장하세요.");
      default:
        throw new Error(`지원하지 않는 포맷: ${format}`);
    }
  };

  // 포맷별 클립보드 복사 함수
  const handleClipboardExportWithFormat = async (format: FileFormat) => {
    const timeline = useRoutingStore.getState().timeline;

    switch (format) {
      case "CSV":
        await copyCSVToClipboard(timeline);
        break;
      case "XML":
        await copyXMLToClipboard(timeline);
        break;
      case "JSON":
        await copyJSONToClipboard(timeline);
        break;
      case "Excel":
      case "ACCESS":
        throw new Error(`${format}는 클립보드 복사를 지원하지 않습니다.`);
      default:
        throw new Error(`지원하지 않는 포맷: ${format}`);
    }
  };

  // SaveButtonDropdown 콜백
  const handleSaveFromDropdown = async (
    selectedFormat: FileFormat,
    selectedDestination: Destination
  ) => {
    setSaving(true);
    try {
      if (selectedDestination === "local") {
        await handleLocalExportWithFormat(selectedFormat);
      } else if (selectedDestination === "clipboard") {
        await handleClipboardExportWithFormat(selectedFormat);
      }
    } catch (error) {
      console.error("저장 실패:", error);
      throw error; // SaveButtonDropdown에서 토스트로 표시
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="routing-group-controls">
      {/* ... 다른 컨트롤들 ... */}

      {/* 기존 SAVE 버튼을 SaveButtonDropdown으로 교체 */}
      <SaveButtonDropdown
        onSave={handleSaveFromDropdown}
        disabled={timeline.length === 0}
        saving={saving}
        defaultFormat="CSV"
        defaultDestination="local"
      />

      {/* ... 나머지 컨트롤들 ... */}
    </div>
  );
}
```

---

## 🔍 주의사항

### 1. FORMAT_CAPABILITIES 일치
`SaveButtonDropdown.tsx`의 `FORMAT_CAPABILITIES`와 실제 구현이 일치해야 합니다:

```typescript
const FORMAT_CAPABILITIES: Record<FileFormat, { local: boolean; clipboard: boolean }> = {
  CSV: { local: true, clipboard: true },
  XML: { local: true, clipboard: true },
  JSON: { local: true, clipboard: true },
  Excel: { local: true, clipboard: false },
  ACCESS: { local: false, clipboard: false },
};
```

만약 ACCESS를 서버에만 저장 가능하다면, 별도의 "서버 저장" 버튼을 추가하거나, `Destination` 타입에 `"server"` 추가를 고려하세요.

### 2. 오류 처리
`onSave` 콜백에서 발생한 오류는 `SaveButtonDropdown`이 자동으로 토스트로 표시합니다:

```typescript
// SaveButtonDropdown 내부
try {
  await onSave(selectedFormat, selectedDestination);
  setToast({ message: `${selectedFormat} 저장 완료`, type: "success" });
} catch (error) {
  setToast({ message: `저장 실패: ${error}`, type: "error" });
}
```

따라서 `handleSaveFromDropdown`에서는 오류를 `throw`만 하면 됩니다.

### 3. 기존 SAVE 버튼 로직 유지
기존 `RoutingGroupControls`에 여러 저장 관련 함수가 있다면, 재사용하세요:

- `handleLocalExport()` → `handleLocalExportWithFormat(format)`로 확장
- `handleClipboardExport()` → `handleClipboardExportWithFormat(format)`로 확장
- `handleServerSave()` → 그대로 유지 (ACCESS용)

---

## 🧪 테스트 체크리스트

통합 후 다음 사항을 확인하세요:

- [ ] CSV 로컬 저장 성공
- [ ] CSV 클립보드 복사 성공
- [ ] XML 로컬 저장 성공
- [ ] XML 클립보드 복사 성공
- [ ] JSON 로컬/클립보드 성공
- [ ] Excel 로컬 저장 성공
- [ ] Excel 클립보드 선택 시 비활성화 확인
- [ ] ACCESS 로컬/클립보드 선택 시 비활성화 확인
- [ ] 드롭다운 열기/닫기 동작
- [ ] 외부 클릭 시 자동 닫기
- [ ] 저장 성공 시 토스트 표시
- [ ] 저장 실패 시 토스트 표시
- [ ] 토스트 3초 후 자동 사라짐

---

## 🚀 다음 단계

1. **RoutingGroupControls.tsx 백업**:
   ```bash
   cp frontend-prediction/src/components/RoutingGroupControls.tsx \
      frontend-prediction/src/components/RoutingGroupControls.tsx.backup
   ```

2. **통합 구현**:
   - Import 추가
   - `handleSaveFromDropdown` 함수 작성
   - 기존 버튼 교체

3. **테스트**:
   - `npm run dev` 실행
   - 브라우저에서 동작 확인
   - 콘솔 오류 확인

4. **정리**:
   - 사용하지 않는 코드 제거
   - 주석 정리
   - 코드 포맷팅

---

## 📚 참고

- SaveButtonDropdown 소스: `frontend-prediction/src/components/SaveButtonDropdown.tsx`
- 기존 RoutingGroupControls: `frontend-prediction/src/components/RoutingGroupControls.tsx`
- CSS 스타일: `frontend-prediction/src/index.css` (`.save-dropdown-menu` 등)

---

**작성 완료**: 2025-10-05 07:00 UTC
