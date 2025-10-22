import { Layers,Table } from "lucide-react";
import { useState } from "react";

import { Tabs } from "../ui/Tabs";
import { ProcessGroupsWorkspace } from "./ProcessGroupsWorkspace";
import { RoutingMatrixWorkspace } from "./RoutingMatrixWorkspace";

export function RoutingConfigWorkspace() {
  const [activeTab, setActiveTab] = useState("routing-matrix");

  const tabs = [
    {
      id: "routing-matrix",
      label: "라우팅 조합",
      icon: <Table size={18} />,
      content: <RoutingMatrixWorkspace />,
    },
    {
      id: "process-groups",
      label: "공정 그룹",
      icon: <Layers size={18} />,
      content: <ProcessGroupsWorkspace />,
    },
  ];

  return (
    <div className="routing-config-workspace" data-layout-fix="v3-tabs">
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
