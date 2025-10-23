import {
  createDataMappingProfile,
  type DataMappingProfile,
  type DataMappingProfileCreate,
  type DataRelationshipMapping,
  deleteDataMappingProfile,
  fetchDataMappingProfile,
  fetchDataMappingProfiles,
  updateDataMappingProfile,
} from "@lib/apiClient";
import { AlertCircle, ArrowRight, Plus, Save, Settings, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

const DATA_TYPES = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "date", label: "Date" },
] as const;

// 학습 데이터 컬럼 샘플 (실제로는 backend/constants.py의 TRAIN_FEATURES에서 가져와야 함)
const TRAINING_COLUMNS = [
  "ITEM_CD",
  "PART_TYPE",
  "PartNm",
  "ITEM_SPEC",
  "ITEM_NM",
  "ITEM_MATERIAL",
  "OUTDIAMETER",
  "INDIAMETER",
  "ROTATE_CLOCKWISE",
];

// 예측 결과 컬럼 샘플 (실제로는 backend/constants.py의 ROUTING_OUTPUT_COLS에서 가져와야 함)
const PREDICTION_COLUMNS = [
  "dbo_BI_ROUTING_VIEW_JOB_CD",
  "JOB_NM",
  "RES_CD",
  "RES_DIS",
  "MACH_WORKED_HOURS",
  "SETUP_TIME",
  "RUN_TIME_QTY",
  "BATCH_OPER",
];

export function DataRelationshipManager() {
  const [profiles, setProfiles] = useState<DataMappingProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<DataMappingProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  // 새 프로파일 생성 모달 상태
  const [showNewProfileModal, setShowNewProfileModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileDescription, setNewProfileDescription] = useState("");

  // 매핑 편집 상태
  const [relationships, setRelationships] = useState<DataRelationshipMapping[]>([]);

  // 프로파일 목록 로드
  useEffect(() => {
    loadProfiles();
  }, []);

  // 선택된 프로파일 로드
  useEffect(() => {
    if (selectedProfileId) {
      loadProfileDetail(selectedProfileId);
    }
  }, [selectedProfileId]);

  const loadProfiles = async () => {
    try {
      setIsLoading(true);
      const response = await fetchDataMappingProfiles();
      setProfiles(response.profiles);
    } catch (err: any) {
      setError(err.message || "프로파일 목록 로드 실패");
    } finally {
      setIsLoading(false);
    }
  };

  const loadProfileDetail = async (profileId: string) => {
    try {
      setIsLoading(true);
      const profile = await fetchDataMappingProfile(profileId);
      setSelectedProfile(profile);
      setRelationships(profile.relationships || []);
    } catch (err: any) {
      setError(err.message || "프로파일 로드 실패");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) {
      setError("프로파일 이름을 입력하세요");
      return;
    }

    try {
      setIsLoading(true);
      const payload: DataMappingProfileCreate = {
        name: newProfileName.trim(),
        description: newProfileDescription.trim() || undefined,
        relationships: [],
      };
      const created = await createDataMappingProfile(payload);
      setProfiles([...profiles, created]);
      setSelectedProfileId(created.id);
      setShowNewProfileModal(false);
      setNewProfileName("");
      setNewProfileDescription("");
      setSuccessMessage("프로파일이 생성되었습니다");
    } catch (err: any) {
      setError(err.message || "프로파일 생성 실패");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!selectedProfileId || !selectedProfile) return;

    try {
      setIsLoading(true);
      await updateDataMappingProfile(selectedProfileId, {
        relationships,
      });
      setSuccessMessage("저장되었습니다");
      await loadProfiles();
    } catch (err: any) {
      setError(err.message || "저장 실패");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!selectedProfileId) return;
    if (!confirm("이 프로파일을 삭제하시겠습니까?")) return;

    try {
      setIsLoading(true);
      await deleteDataMappingProfile(selectedProfileId);
      setProfiles(profiles.filter((p) => p.id !== selectedProfileId));
      setSelectedProfileId(null);
      setSelectedProfile(null);
      setRelationships([]);
      setSuccessMessage("프로파일이 삭제되었습니다");
    } catch (err: any) {
      setError(err.message || "삭제 실패");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRelationship = () => {
    setRelationships([
      ...relationships,
      {
        training_column: "",
        prediction_column: null,
        output_column: "",
        data_type: "string",
        is_required: false,
        default_value: null,
        transform_rule: null,
        description: null,
      },
    ]);
  };

  const handleRemoveRelationship = (index: number) => {
    setRelationships(relationships.filter((_, i) => i !== index));
  };

  const handleUpdateRelationship = (
    index: number,
    field: keyof DataRelationshipMapping,
    value: any
  ) => {
    const updated = [...relationships];
    updated[index] = { ...updated[index], [field]: value };
    setRelationships(updated);
  };

  return (
    <div className="min-h-screen p-6 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="heading-1 flex items-center gap-3">
                <Settings className="text-primary-400" size={32} />
                데이터 관계 설정
              </h1>
              <p className="body-text-secondary mt-2">
                학습 데이터 → 예측 결과 → 출력 컬럼 간의 관계를 설정합니다
              </p>
            </div>
            <button
              type="button"
              className="btn-primary neon-cyan"
              onClick={() => setShowNewProfileModal(true)}
            >
              <Plus size={18} />
              새 프로파일
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
            <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-200 font-medium">오류</p>
              <p className="text-red-300 text-sm mt-1">{error}</p>
            </div>
            <button
              onClick={() => setError("")}
              className="ml-auto text-red-400 hover:text-red-300"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-4 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center justify-between">
            <p className="text-green-200">{successMessage}</p>
            <button
              onClick={() => setSuccessMessage("")}
              className="text-green-400 hover:text-green-300"
            >
              <X size={18} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* 프로파일 목록 */}
          <div className="col-span-3">
            <div className="glass-morphism p-6 rounded-xl">
              <h2 className="heading-3 mb-4">프로파일 목록</h2>
              {isLoading && !selectedProfile ? (
                <p className="body-text-secondary text-center py-8">로딩 중...</p>
              ) : profiles.length === 0 ? (
                <p className="body-text-secondary text-center py-8">
                  프로파일이 없습니다
                </p>
              ) : (
                <div className="space-y-2">
                  {profiles.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => setSelectedProfileId(profile.id)}
                      className={`
                        w-full text-left p-3 rounded-lg transition-all
                        ${
                          selectedProfileId === profile.id
                            ? "bg-primary-500/20 border-2 border-primary-400"
                            : "bg-dark-surface border-2 border-dark-border hover:border-primary-500/50"
                        }
                      `}
                    >
                      <p className="font-semibold text-sm">{profile.name}</p>
                      {profile.description && (
                        <p className="text-xs text-dark-text-secondary mt-1">
                          {profile.description}
                        </p>
                      )}
                      <p className="text-xs text-dark-text-tertiary mt-2">
                        {profile.relationships?.length || 0}개 매핑
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 매핑 편집기 */}
          <div className="col-span-9">
            {!selectedProfile ? (
              <div className="glass-morphism p-12 rounded-xl text-center">
                <Settings size={48} className="mx-auto text-dark-text-tertiary mb-4" />
                <p className="body-text-secondary">
                  왼쪽에서 프로파일을 선택하거나 새로 만드세요
                </p>
              </div>
            ) : (
              <div className="glass-morphism p-6 rounded-xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="heading-2">{selectedProfile.name}</h2>
                    {selectedProfile.description && (
                      <p className="body-text-secondary mt-1">
                        {selectedProfile.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-ghost text-red-500 hover:text-red-400"
                      onClick={handleDeleteProfile}
                    >
                      <Trash2 size={18} />
                      삭제
                    </button>
                    <button
                      type="button"
                      className="btn-primary neon-cyan"
                      onClick={handleSaveProfile}
                      disabled={isLoading}
                    >
                      <Save size={18} />
                      {isLoading ? "저장 중..." : "저장"}
                    </button>
                  </div>
                </div>

                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-dark-text-secondary">
                    데이터 흐름: 학습 컬럼 → 예측 컬럼 → 출력 컬럼
                  </p>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleAddRelationship}
                  >
                    <Plus size={16} />
                    매핑 추가
                  </button>
                </div>

                {relationships.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="body-text-secondary">
                      ë§¤íì´ ììµëë¤. &quot;ë§¤í ì¶ê°&quot; ë²í¼ì í´ë¦­íì¸ì
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {relationships.map((rel, index) => (
                      <div
                        key={index}
                        className="p-4 rounded-lg border-2 border-dark-border bg-dark-surface/50"
                      >
                        <div className="grid grid-cols-12 gap-4 items-center">
                          {/* 학습 컬럼 */}
                          <div className="col-span-3">
                            <label className="block text-xs font-medium mb-1">
                              학습 데이터 컬럼
                            </label>
                            <select
                              className="form-input w-full"
                              value={rel.training_column}
                              onChange={(e) =>
                                handleUpdateRelationship(
                                  index,
                                  "training_column",
                                  e.target.value
                                )
                              }
                            >
                              <option value="">선택...</option>
                              {TRAINING_COLUMNS.map((col) => (
                                <option key={col} value={col}>
                                  {col}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-span-1 flex justify-center">
                            <ArrowRight size={20} className="text-primary-400" />
                          </div>

                          {/* 예측 컬럼 */}
                          <div className="col-span-3">
                            <label className="block text-xs font-medium mb-1">
                              예측 결과 컬럼
                            </label>
                            <select
                              className="form-input w-full"
                              value={rel.prediction_column || ""}
                              onChange={(e) =>
                                handleUpdateRelationship(
                                  index,
                                  "prediction_column",
                                  e.target.value || null
                                )
                              }
                            >
                              <option value="">동일 컬럼 사용</option>
                              {PREDICTION_COLUMNS.map((col) => (
                                <option key={col} value={col}>
                                  {col}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-span-1 flex justify-center">
                            <ArrowRight size={20} className="text-primary-400" />
                          </div>

                          {/* 출력 컬럼 */}
                          <div className="col-span-3">
                            <label className="block text-xs font-medium mb-1">
                              출력 컬럼명
                            </label>
                            <input
                              type="text"
                              className="form-input w-full"
                              placeholder="예: 공정명"
                              value={rel.output_column}
                              onChange={(e) =>
                                handleUpdateRelationship(
                                  index,
                                  "output_column",
                                  e.target.value
                                )
                              }
                            />
                          </div>

                          {/* 삭제 버튼 */}
                          <div className="col-span-1">
                            <button
                              type="button"
                              className="btn-ghost text-red-500 hover:text-red-400 mt-5"
                              onClick={() => handleRemoveRelationship(index)}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>

                        {/* 추가 옵션 */}
                        <div className="grid grid-cols-4 gap-4 mt-4">
                          <div>
                            <label className="block text-xs font-medium mb-1">
                              데이터 타입
                            </label>
                            <select
                              className="form-input w-full"
                              value={rel.data_type}
                              onChange={(e) =>
                                handleUpdateRelationship(index, "data_type", e.target.value)
                              }
                            >
                              {DATA_TYPES.map((type) => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">
                              기본값
                            </label>
                            <input
                              type="text"
                              className="form-input w-full"
                              placeholder="선택사항"
                              value={rel.default_value || ""}
                              onChange={(e) =>
                                handleUpdateRelationship(
                                  index,
                                  "default_value",
                                  e.target.value || null
                                )
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">
                              변환 규칙
                            </label>
                            <input
                              type="text"
                              className="form-input w-full"
                              placeholder="예: uppercase"
                              value={rel.transform_rule || ""}
                              onChange={(e) =>
                                handleUpdateRelationship(
                                  index,
                                  "transform_rule",
                                  e.target.value || null
                                )
                              }
                            />
                          </div>
                          <div className="flex items-end">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={rel.is_required}
                                onChange={(e) =>
                                  handleUpdateRelationship(
                                    index,
                                    "is_required",
                                    e.target.checked
                                  )
                                }
                              />
                              <span className="text-xs">필수</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 새 프로파일 모달 */}
      {showNewProfileModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowNewProfileModal(false)}
        >
          <div
            className="glass-morphism p-8 rounded-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between mb-6">
              <h2 className="heading-2">새 프로파일</h2>
              <button
                type="button"
                className="btn-ghost p-2"
                onClick={() => setShowNewProfileModal(false)}
              >
                <X size={20} />
              </button>
            </header>

            <div className="space-y-4">
              <div>
                <label htmlFor="profile-name" className="block text-sm font-medium mb-2">
                  프로파일 이름 <span className="text-red-400">*</span>
                </label>
                <input
                  id="profile-name"
                  type="text"
                  className="form-input w-full"
                  placeholder="예: 기본 매핑"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="profile-description" className="block text-sm font-medium mb-2">
                  설명
                </label>
                <textarea
                  id="profile-description"
                  className="form-input w-full resize-none"
                  rows={3}
                  placeholder="프로파일 설명 (선택사항)"
                  value={newProfileDescription}
                  onChange={(e) => setNewProfileDescription(e.target.value)}
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowNewProfileModal(false)}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="btn-primary neon-cyan"
                  onClick={handleCreateProfile}
                  disabled={isLoading || !newProfileName.trim()}
                >
                  {isLoading ? "생성 중..." : "생성"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}