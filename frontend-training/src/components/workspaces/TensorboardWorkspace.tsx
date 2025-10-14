import { TensorboardEmbeddingPanel } from "@components/tensorboard/TensorboardEmbeddingPanel";

export function TensorboardWorkspace() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <section className="rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">TensorBoard Embedding Explorer</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          학습된 임베딩을 3D로 살펴보고, 메타데이터 필터와 지표 탭을 통해 모델 상태를 점검합니다.
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
          새로운 학습 버전이 생성되면 자동으로 최신 Projector를 로드합니다.
        </p>
      </section>
      <TensorboardEmbeddingPanel />
    </div>
  );
}
