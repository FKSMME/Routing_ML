import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SAMPLE_MODELS } from '@/data/sampleData';
import { useToast } from '@/hooks/use-toast';
import { 
  TrendingUp, 
  BarChart3, 
  PieChart, 
  Activity, 
  Save,
  ExternalLink,
  RefreshCw,
  Calendar,
  Target,
  Zap
} from 'lucide-react';

interface ModelData {
  id: string;
  model_name: string;
  model_type: string;
  training_date: string;
  feature_weights: any;
  metrics: any;
  visualization_data: any;
}

export const LearningDataStatus: React.FC = () => {
  const [models, setModels] = useState<ModelData[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelData | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadModelData();
  }, []);

  const loadModelData = () => {
    setLoading(true);
    setTimeout(() => {
      setModels(SAMPLE_MODELS);
      if (SAMPLE_MODELS.length > 0) {
        setSelectedModel(SAMPLE_MODELS[0]);
        setSelectedFeatures(Object.keys(SAMPLE_MODELS[0].feature_weights));
      }
      setLoading(false);
      toast({
        title: '모델 데이터 갱신',
        description: '로컬 샘플 모델 정보가 업데이트되었습니다.',
      });
    }, 200);
  };

  const saveFeatureSelection = async () => {
    if (!selectedModel) return;

    try {
      toast({
        title: "피쳐 선택 저장 완료",
        description: "선택된 피쳐가 성공적으로 저장되었습니다.",
      });
    } catch (error: any) {
      toast({
        title: "저장 실패",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleFeature = (feature: string) => {
    setSelectedFeatures(prev => 
      prev.includes(feature) 
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    );
  };

  const openTensorboard = () => {
    // In real implementation, this would open Tensorboard
    window.open('http://localhost:6006', '_blank');
    toast({
      title: "Tensorboard 연결",
      description: "Tensorboard가 새 탭에서 열립니다.",
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="heading-lg text-foreground">학습 데이터 현황</h1>
          <p className="body-text text-muted-foreground">
            머신러닝 모델의 성능과 학습 데이터를 분석합니다
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={loadModelData} disabled={loading} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            새로고침
          </Button>
          <Button onClick={openTensorboard} variant="outline">
            <ExternalLink className="w-4 h-4 mr-2" />
            Tensorboard
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">개요</TabsTrigger>
          <TabsTrigger value="metrics">성능 지표</TabsTrigger>
          <TabsTrigger value="features">피쳐 가중치</TabsTrigger>
          <TabsTrigger value="visualization">시각화</TabsTrigger>
          <TabsTrigger value="settings">설정</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Model List */}
            <Card className="card-gradient">
              <CardHeader>
                <CardTitle className="text-sm">모델 목록</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {models.map((model) => (
                      <div
                        key={model.id}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedModel?.id === model.id 
                            ? 'bg-primary/10 border-2 border-primary' 
                            : 'bg-surface-base hover:bg-secondary/10'
                        }`}
                        onClick={() => setSelectedModel(model)}
                      >
                        <div className="space-y-2">
                          <p className="font-medium text-sm">{model.model_name}</p>
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary" className="text-xs">
                              {model.model_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(model.training_date).toLocaleDateString()}
                            </span>
                          </div>
                          {model.metrics && (
                            <div className="text-xs text-muted-foreground">
                              정확도: {(model.metrics.accuracy * 100).toFixed(1)}%
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Model Details */}
            <div className="md:col-span-2 space-y-4">
              {selectedModel ? (
                <>
                  <Card className="card-gradient">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Zap className="w-5 h-5" />
                        <span>{selectedModel.model_name}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">모델 타입</p>
                          <p className="font-medium">{selectedModel.model_type}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">학습 날짜</p>
                          <p className="font-medium">
                            {new Date(selectedModel.training_date).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">정확도</p>
                          <p className="font-medium text-green-600">
                            {selectedModel.metrics ? (selectedModel.metrics.accuracy * 100).toFixed(1) : 'N/A'}%
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">F1 스코어</p>
                          <p className="font-medium text-blue-600">
                            {selectedModel.metrics ? selectedModel.metrics.f1_score.toFixed(3) : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="card-gradient">
                    <CardHeader>
                      <CardTitle>성능 요약</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedModel.metrics && (
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>정확도</span>
                              <span>{(selectedModel.metrics.accuracy * 100).toFixed(1)}%</span>
                            </div>
                            <Progress value={selectedModel.metrics.accuracy * 100} />
                          </div>
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>정밀도</span>
                              <span>{(selectedModel.metrics.precision * 100).toFixed(1)}%</span>
                            </div>
                            <Progress value={selectedModel.metrics.precision * 100} />
                          </div>
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>재현율</span>
                              <span>{(selectedModel.metrics.recall * 100).toFixed(1)}%</span>
                            </div>
                            <Progress value={selectedModel.metrics.recall * 100} />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="card-gradient">
                  <CardContent className="flex items-center justify-center h-[400px]">
                    <div className="text-center text-muted-foreground">
                      <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>모델을 선택하여 상세 정보를 확인하세요</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-6">
          {selectedModel && selectedModel.metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="card-gradient">
                <CardHeader>
                  <CardTitle>성능 지표</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(selectedModel.metrics).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center">
                        <span className="capitalize">{key.replace('_', ' ')}</span>
                        <Badge variant="secondary">
                          {typeof value === 'number' ? value.toFixed(3) : String(value)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="card-gradient">
                <CardHeader>
                  <CardTitle>혼동 행렬</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedModel.visualization_data?.confusion_matrix && (
                    <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
                      {selectedModel.visualization_data.confusion_matrix.map((row: number[], i: number) =>
                        row.map((value: number, j: number) => (
                          <div
                            key={`${i}-${j}`}
                            className="aspect-square flex items-center justify-center bg-surface-base rounded text-center"
                          >
                            <span className="font-bold text-lg">{value}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="features" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="card-gradient">
              <CardHeader>
                <CardTitle>피쳐 가중치</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedModel && selectedModel.feature_weights && (
                  <div className="space-y-3">
                    {Object.entries(selectedModel.feature_weights).map(([feature, weight]) => (
                      <div key={feature} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize">{feature.replace('_', ' ')}</span>
                          <span>{(Number(weight) * 100).toFixed(1)}%</span>
                        </div>
                        <Progress value={Number(weight) * 100} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="card-gradient">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>피쳐 선택</span>
                  <Button onClick={saveFeatureSelection} size="sm" className="btn-primary">
                    <Save className="w-4 h-4 mr-2" />
                    저장
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {selectedModel && selectedModel.feature_weights && 
                    Object.keys(selectedModel.feature_weights).map((feature) => (
                      <div key={feature} className="flex items-center space-x-2">
                        <Checkbox
                          id={feature}
                          checked={selectedFeatures.includes(feature)}
                          onCheckedChange={() => toggleFeature(feature)}
                        />
                        <label htmlFor={feature} className="text-sm capitalize cursor-pointer">
                          {feature.replace('_', ' ')}
                        </label>
                      </div>
                    ))
                  }
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="visualization" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="card-gradient">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5" />
                  <span>Tensorboard</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] bg-surface-base rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <TrendingUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">Tensorboard 시각화</p>
                    <Button onClick={openTensorboard} variant="outline">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Tensorboard 열기
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-gradient">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <PieChart className="w-5 h-5" />
                  <span>히트맵</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] bg-surface-base rounded-lg flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Activity className="w-12 h-12 mx-auto mb-4" />
                    <p>피쳐 상관관계 히트맵</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card className="card-gradient">
            <CardHeader>
              <CardTitle>학습 설정</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">자동 재학습 주기</label>
                    <select className="w-full p-2 border rounded-lg mt-1">
                      <option>매일</option>
                      <option>매주</option>
                      <option>매월</option>
                      <option>수동</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">데이터 분할 비율</label>
                    <select className="w-full p-2 border rounded-lg mt-1">
                      <option>70:20:10 (Train:Val:Test)</option>
                      <option>80:10:10</option>
                      <option>60:20:20</option>
                    </select>
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