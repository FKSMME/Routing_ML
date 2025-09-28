import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Play, 
  Square, 
  Settings, 
  Save, 
  Download,
  Zap,
  GitBranch,
  Database,
  ArrowRight,
  Circle,
  MoreHorizontal
} from 'lucide-react';

interface AlgorithmNode {
  id: string;
  type: 'input' | 'process' | 'model' | 'output';
  label: string;
  x: number;
  y: number;
  parameters?: any;
}

interface AlgorithmConnection {
  from: string;
  to: string;
}

interface AlgorithmWorkflow {
  nodes: AlgorithmNode[];
  connections: AlgorithmConnection[];
}

export const AlgorithmVisualization: React.FC = () => {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<AlgorithmWorkflow | null>(null);
  const [selectedNode, setSelectedNode] = useState<AlgorithmNode | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadAlgorithmSettings();
  }, []);

  const loadAlgorithmSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('algorithm_settings_2025_09_28_04_25')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setWorkflows(data || []);
      if (data && data.length > 0) {
        setSelectedWorkflow(data[0].workflow_graph);
      }
    } catch (error: any) {
      toast({
        title: "알고리즘 로드 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const runWorkflow = async () => {
    if (!selectedWorkflow) return;

    setIsRunning(true);
    try {
      // Simulate workflow execution
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      toast({
        title: "워크플로우 실행 완료",
        description: "알고리즘이 성공적으로 실행되었습니다.",
      });
    } catch (error: any) {
      toast({
        title: "워크플로우 실행 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const saveWorkflow = async () => {
    if (!selectedWorkflow) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('algorithm_settings_2025_09_28_04_25')
        .insert({
          name: `워크플로우 ${Date.now()}`,
          algorithm_type: 'Custom',
          parameters: {},
          workflow_graph: selectedWorkflow
        });

      if (error) throw error;

      toast({
        title: "워크플로우 저장 완료",
        description: "워크플로우가 성공적으로 저장되었습니다.",
      });

      loadAlgorithmSettings();
    } catch (error: any) {
      toast({
        title: "워크플로우 저장 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'input': return Database;
      case 'process': return Settings;
      case 'model': return Zap;
      case 'output': return Download;
      default: return Circle;
    }
  };

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'input': return 'bg-blue-500';
      case 'process': return 'bg-green-500';
      case 'model': return 'bg-purple-500';
      case 'output': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="heading-lg text-foreground">알고리즘 시각화</h1>
          <p className="body-text text-muted-foreground">
            머신러닝 알고리즘을 시각적으로 설계하고 관리합니다
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={runWorkflow} disabled={isRunning || !selectedWorkflow} className="btn-primary">
            {isRunning ? <Square className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {isRunning ? '실행 중...' : '실행'}
          </Button>
          <Button onClick={saveWorkflow} disabled={loading} variant="outline">
            <Save className="w-4 h-4 mr-2" />
            저장
          </Button>
        </div>
      </div>

      <Tabs defaultValue="workflow" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="workflow">워크플로우 그래프</TabsTrigger>
          <TabsTrigger value="trainer">Trainer 함수</TabsTrigger>
          <TabsTrigger value="predictor">Predictor 함수</TabsTrigger>
          <TabsTrigger value="settings">설정</TabsTrigger>
        </TabsList>

        <TabsContent value="workflow" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Workflow List */}
            <Card className="card-gradient">
              <CardHeader>
                <CardTitle className="text-sm">워크플로우 목록</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {workflows.map((workflow) => (
                      <div
                        key={workflow.id}
                        className="p-3 bg-surface-base rounded-lg cursor-pointer hover:bg-secondary/10 transition-colors"
                        onClick={() => setSelectedWorkflow(workflow.workflow_graph)}
                      >
                        <p className="font-medium text-sm">{workflow.name}</p>
                        <p className="text-xs text-muted-foreground">{workflow.algorithm_type}</p>
                        <Badge variant="secondary" className="text-xs mt-1">
                          {workflow.workflow_graph?.nodes?.length || 0} 노드
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Workflow Canvas */}
            <div className="lg:col-span-2">
              <Card className="card-gradient">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <GitBranch className="w-5 h-5" />
                    <span>워크플로우 캔버스</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[500px] bg-surface-base rounded-lg p-4 relative overflow-hidden">
                    {selectedWorkflow ? (
                      <div className="relative w-full h-full">
                        {/* Render Nodes */}
                        {selectedWorkflow.nodes?.map((node, index) => {
                          const Icon = getNodeIcon(node.type);
                          return (
                            <div
                              key={node.id}
                              className={`absolute p-4 rounded-lg shadow-lg cursor-pointer transition-all hover:scale-105 ${
                                selectedNode?.id === node.id ? 'ring-2 ring-primary' : ''
                              }`}
                              style={{
                                left: `${20 + index * 150}px`,
                                top: `${100 + (index % 2) * 100}px`,
                                backgroundColor: 'white',
                                border: `2px solid hsl(var(--border))`
                              }}
                              onClick={() => setSelectedNode(node)}
                            >
                              <div className="flex flex-col items-center space-y-2">
                                <div className={`w-8 h-8 rounded-full ${getNodeColor(node.type)} flex items-center justify-center`}>
                                  <Icon className="w-4 h-4 text-white" />
                                </div>
                                <p className="text-xs font-medium text-center">{node.label}</p>
                                <Badge variant="outline" className="text-xs">
                                  {node.type}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}

                        {/* Render Connections */}
                        {selectedWorkflow.connections?.map((connection, index) => (
                          <div key={index} className="absolute">
                            <ArrowRight className="w-6 h-6 text-muted-foreground" 
                              style={{
                                left: `${120 + index * 150}px`,
                                top: `${130 + (index % 2) * 100}px`
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                          <GitBranch className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>워크플로우를 선택하여 시각화를 확인하세요</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Node Properties */}
            <Card className="card-gradient">
              <CardHeader>
                <CardTitle className="text-sm">노드 속성</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedNode ? (
                  <div className="space-y-4">
                    <div>
                      <p className="font-medium">{selectedNode.label}</p>
                      <Badge variant="secondary" className="text-xs mt-1">
                        {selectedNode.type}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">매개변수</h4>
                      {selectedNode.parameters ? (
                        Object.entries(selectedNode.parameters).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-sm">
                            <span>{key}</span>
                            <span className="text-muted-foreground">{String(value)}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">매개변수가 없습니다</p>
                      )}
                    </div>

                    <Button size="sm" className="w-full">
                      <Settings className="w-4 h-4 mr-2" />
                      설정 편집
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                    <MoreHorizontal className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">노드를 선택하세요</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trainer" className="space-y-6">
          <Card className="card-gradient">
            <CardHeader>
              <CardTitle>Trainer 함수 시각화</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] bg-surface-base rounded-lg p-4 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Trainer 함수 블루프린트가 여기에 표시됩니다</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictor" className="space-y-6">
          <Card className="card-gradient">
            <CardHeader>
              <CardTitle>Predictor 함수 시각화</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] bg-surface-base rounded-lg p-4 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Predictor 함수 블루프린트가 여기에 표시됩니다</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card className="card-gradient">
            <CardHeader>
              <CardTitle>알고리즘 설정</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">알고리즘 유형</label>
                    <select className="w-full p-2 border rounded-lg">
                      <option>Random Forest</option>
                      <option>Gradient Boosting</option>
                      <option>Neural Network</option>
                      <option>SVM</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">학습률</label>
                    <input type="number" className="w-full p-2 border rounded-lg" defaultValue="0.01" step="0.001" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">에포크 수</label>
                    <input type="number" className="w-full p-2 border rounded-lg" defaultValue="100" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">배치 크기</label>
                    <input type="number" className="w-full p-2 border rounded-lg" defaultValue="32" />
                  </div>
                </div>
                
                <div className="pt-4">
                  <Button className="btn-primary">
                    <Save className="w-4 h-4 mr-2" />
                    설정 저장
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};