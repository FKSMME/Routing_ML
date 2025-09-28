import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Save, 
  Download, 
  Upload, 
  GripVertical, 
  X, 
  Search,
  Settings,
  Play
} from 'lucide-react';

interface ProductItem {
  id: string;
  name: string;
  code: string;
  matrixData: any;
}

interface RoutingStep {
  id: string;
  operation: string;
  time: number;
  machine: string;
  description?: string;
}

interface RoutingTab {
  id: string;
  productCode: string;
  productName: string;
  steps: RoutingStep[];
}

export const RoutingGeneration: React.FC = () => {
  const [productItems, setProductItems] = useState<string>('');
  const [searchResults, setSearchResults] = useState<ProductItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [routingTabs, setRoutingTabs] = useState<RoutingTab[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');
  const [availableOperations, setAvailableOperations] = useState<string[]>([]);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadAvailableOperations();
  }, []);

  const loadAvailableOperations = async () => {
    try {
      const { data, error } = await supabase
        .from('system_options_2025_09_28_04_25')
        .select('option_value')
        .eq('option_category', 'routing_elements')
        .eq('option_name', 'available_operations')
        .single();

      if (error) throw error;
      
      if (data?.option_value) {
        setAvailableOperations(data.option_value);
      }
    } catch (error) {
      console.error('Error loading operations:', error);
    }
  };

  const searchProducts = async () => {
    if (!productItems.trim()) return;

    setLoading(true);
    try {
      const productCodes = productItems.split('\n').map(item => item.trim()).filter(Boolean);
      
      const { data, error } = await supabase
        .from('product_reference_data_2025_09_28_04_25')
        .select('*')
        .in('product_code', productCodes);

      if (error) throw error;

      setSearchResults(data || []);
      
      // Create routing tabs for found products
      const newTabs = (data || []).map(product => ({
        id: product.id,
        productCode: product.product_code,
        productName: product.product_name,
        steps: []
      }));
      
      setRoutingTabs(newTabs);
      if (newTabs.length > 0) {
        setActiveTab(newTabs[0].id);
        setSelectedProduct(data?.[0] || null);
      }

      toast({
        title: "검색 완료",
        description: `${data?.length || 0}개의 제품을 찾았습니다.`,
      });
    } catch (error: any) {
      toast({
        title: "검색 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateRouting = async () => {
    if (!selectedProduct) return;

    setLoading(true);
    try {
      // Simulate ML prediction - in real implementation, this would call an ML model
      const predictedSteps: RoutingStep[] = [
        { id: '1', operation: '밀링', time: 15, machine: 'CNC-001', description: '외형 가공' },
        { id: '2', operation: '드릴링', time: 8, machine: 'DRILL-002', description: '구멍 가공' },
        { id: '3', operation: '연삭', time: 12, machine: 'GRIND-001', description: '표면 마감' },
        { id: '4', operation: '검사', time: 5, machine: 'CMM-001', description: '치수 검사' }
      ];

      setRoutingTabs(prev => prev.map(tab => 
        tab.id === activeTab 
          ? { ...tab, steps: predictedSteps }
          : tab
      ));

      toast({
        title: "라우팅 생성 완료",
        description: "ML 모델을 통해 최적 라우팅을 생성했습니다.",
      });
    } catch (error: any) {
      toast({
        title: "라우팅 생성 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addOperationToRouting = (operation: string) => {
    const newStep: RoutingStep = {
      id: Date.now().toString(),
      operation,
      time: 10,
      machine: 'AUTO-ASSIGN',
      description: ''
    };

    setRoutingTabs(prev => prev.map(tab => 
      tab.id === activeTab 
        ? { ...tab, steps: [...tab.steps, newStep] }
        : tab
    ));
  };

  const removeStep = (stepId: string) => {
    setRoutingTabs(prev => prev.map(tab => 
      tab.id === activeTab 
        ? { ...tab, steps: tab.steps.filter(step => step.id !== stepId) }
        : tab
    ));
  };

  const moveStep = (fromIndex: number, toIndex: number) => {
    setRoutingTabs(prev => prev.map(tab => {
      if (tab.id === activeTab) {
        const newSteps = [...tab.steps];
        const [movedStep] = newSteps.splice(fromIndex, 1);
        newSteps.splice(toIndex, 0, movedStep);
        return { ...tab, steps: newSteps };
      }
      return tab;
    }));
  };

  const saveRouting = async () => {
    const currentTab = routingTabs.find(tab => tab.id === activeTab);
    if (!currentTab) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('routing_configurations_2025_09_28_04_25')
        .insert({
          name: `${currentTab.productName} 라우팅`,
          product_items: [currentTab.productCode],
          routing_sequence: { sequence: currentTab.steps },
          settings: { auto_save: true, format: 'CSV' }
        });

      if (error) throw error;

      toast({
        title: "저장 완료",
        description: "라우팅이 성공적으로 저장되었습니다.",
      });
    } catch (error: any) {
      toast({
        title: "저장 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const currentTab = routingTabs.find(tab => tab.id === activeTab);

  return (
    <div className="container mx-auto p-6 h-screen flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="heading-lg text-foreground">라우팅 생성</h1>
        <p className="body-text text-muted-foreground">
          제품 정보를 기반으로 최적의 가공 라우팅을 생성합니다
        </p>
      </div>

      {/* Main Layout - 3 Columns */}
      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
        {/* Left Panel - 20% */}
        <div className="col-span-12 lg:col-span-2 space-y-4">
          {/* Product Input */}
          <Card className="card-gradient">
            <CardHeader>
              <CardTitle className="text-sm">품목명 입력</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="품목 코드를 입력하세요&#10;(여러 줄 입력 가능)"
                value={productItems}
                onChange={(e) => setProductItems(e.target.value)}
                className="min-h-[120px] resize-none"
              />
              <Button 
                onClick={searchProducts} 
                disabled={loading}
                className="w-full btn-primary"
              >
                <Search className="w-4 h-4 mr-2" />
                {loading ? '검색 중...' : '검색'}
              </Button>
            </CardContent>
          </Card>

          {/* Matrix Data */}
          {selectedProduct && (
            <Card className="card-gradient">
              <CardHeader>
                <CardTitle className="text-sm">행렬 구조</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {selectedProduct.matrix_data && Object.entries(selectedProduct.matrix_data).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center p-2 bg-surface-base rounded">
                        <span className="text-sm font-medium">{key}</span>
                        <span className="text-sm text-muted-foreground">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Center Panel - 60% */}
        <div className="col-span-12 lg:col-span-7 space-y-4">
          {/* Product Tabs */}
          {routingTabs.length > 0 && (
            <div className="flex space-x-2 overflow-x-auto">
              {routingTabs.map((tab) => (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setActiveTab(tab.id);
                    const product = searchResults.find(p => p.id === tab.id);
                    setSelectedProduct(product || null);
                  }}
                  className={activeTab === tab.id ? 'tab-active' : ''}
                >
                  {tab.productCode}
                </Button>
              ))}
            </div>
          )}

          {/* Workflow Visualization */}
          <Card className="card-gradient flex-1">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>워크플로우</CardTitle>
              <Button onClick={generateRouting} disabled={loading} className="btn-primary">
                <Play className="w-4 h-4 mr-2" />
                라우팅 생성
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {currentTab && currentTab.steps.length > 0 ? (
                  <div className="space-y-3">
                    {currentTab.steps.map((step, index) => (
                      <div
                        key={step.id}
                        className="flex items-center space-x-4 p-4 bg-white rounded-lg border-2 border-border hover:border-secondary transition-colors drag-item"
                        draggable
                        onDragStart={() => setDraggedItem(step.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedItem) {
                            const fromIndex = currentTab.steps.findIndex(s => s.id === draggedItem);
                            moveStep(fromIndex, index);
                            setDraggedItem(null);
                          }
                        }}
                      >
                        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                        <div className="flex-1 grid grid-cols-4 gap-4">
                          <div>
                            <p className="font-medium">{step.operation}</p>
                            <p className="text-sm text-muted-foreground">공정 {index + 1}</p>
                          </div>
                          <div>
                            <p className="text-sm">시간: {step.time}분</p>
                            <p className="text-sm text-muted-foreground">{step.machine}</p>
                          </div>
                          <div>
                            <p className="text-sm">{step.description}</p>
                          </div>
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeStep(step.id)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                    <div className="text-center">
                      <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>라우팅을 생성하거나 우측에서 공정을 추가하세요</p>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - 20% */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          {/* Available Operations */}
          <Card className="card-gradient">
            <CardHeader>
              <CardTitle className="text-sm">라우팅 요소</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {availableOperations.map((operation, index) => (
                    <div
                      key={index}
                      className="p-3 bg-surface-base rounded-lg cursor-pointer hover:bg-secondary/10 transition-colors drag-item"
                      draggable
                      onClick={() => addOperationToRouting(operation)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{operation}</span>
                        <Plus className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card className="card-gradient">
            <CardContent className="p-4 space-y-3">
              <Button onClick={saveRouting} disabled={loading} className="w-full btn-primary">
                <Save className="w-4 h-4 mr-2" />
                저장
              </Button>
              
              <Select defaultValue="CSV">
                <SelectTrigger>
                  <SelectValue placeholder="저장 형식" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CSV">CSV</SelectItem>
                  <SelectItem value="XML">XML</SelectItem>
                  <SelectItem value="JSON">JSON</SelectItem>
                  <SelectItem value="Excel">Excel</SelectItem>
                  <SelectItem value="ACCESS">ACCESS</SelectItem>
                </SelectContent>
              </Select>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-1" />
                  로컬
                </Button>
                <Button variant="outline" size="sm">
                  <Upload className="w-4 h-4 mr-1" />
                  클립보드
                </Button>
              </div>

              <Button variant="outline" className="w-full" disabled>
                <Settings className="w-4 h-4 mr-2" />
                INTERFACE
                <Badge variant="secondary" className="ml-2 text-xs">비활성</Badge>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};