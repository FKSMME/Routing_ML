import { useState } from "react";

import { CandidatePanel } from "@components/CandidatePanel";
import { Header } from "@components/Header";
import { MetricsPanel } from "@components/MetricsPanel";
import { PredictionControls } from "@components/PredictionControls";
import { TimelinePanel } from "@components/TimelinePanel";
import { usePredictRoutings } from "@hooks/usePredictRoutings";

const DEFAULT_ITEM = "ITEM-001";

export default function App() {
  const [itemCodes, setItemCodes] = useState<string[]>([DEFAULT_ITEM]);
  const [topK, setTopK] = useState<number>(10);
  const [threshold, setThreshold] = useState<number>(0.3);

  const { data, isLoading, isFetching, refetch } = usePredictRoutings({
    itemCodes,
    topK,
    threshold,
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header onRefresh={refetch} loading={isLoading || isFetching} />
      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-8">
        <div className="w-80 space-y-6">
          <PredictionControls
            itemCodes={itemCodes}
            onChangeItemCodes={setItemCodes}
            topK={topK}
            onChangeTopK={setTopK}
            threshold={threshold}
            onChangeThreshold={setThreshold}
            loading={isLoading || isFetching}
            onSubmit={refetch}
          />
          <MetricsPanel metrics={data?.metrics} loading={isLoading || isFetching} />
        </div>
        <div className="flex-1 space-y-6">
          <CandidatePanel candidates={data?.candidates ?? []} loading={isLoading || isFetching} />
        </div>
        <div className="w-96">
          <TimelinePanel routings={data?.items ?? []} loading={isLoading || isFetching} />
        </div>
      </div>
    </div>
  );
}
