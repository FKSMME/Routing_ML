import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  SAMPLE_ROUTING_COLUMNS,
  SAMPLE_SIMILARITY_METHOD,
  SAMPLE_STANDARD_DEVIATION,
} from '@/data/sampleData';
import { useToast } from '@/hooks/use-toast';
import { 
  Save, 
  Settings, 
  Database, 
  FileText, 
  BarChart3,
  Plus,
  Trash2,
  AlertTriangle
} from 'lucide-react';

interface SystemOption {
  id: string;
  option_category: string;
  option_name: string;
  option_value: any;
}

export const SystemOptions: React.FC = () => {
  const [options, setOptions] = useState<SystemOption[]>([]);
  const [zScoreValue, setZScoreValue] = useState('2');
  const [similarityMethod, setSimilarityMethod] = useState('코사인 유사도');
  const [routingColumns, setRoutingColumns] = useState<string[]>([]);
  const [newColumn, setNewColumn] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSystemOptions();
  }, []);

  const loadSystemOptions = () => {
    setLoading(true);
    setTimeout(() => {
      const mockOptions: SystemOption[] = [
        {
          id: 'option-standard-deviation',
          option_category: 'standard_deviation',
          option_name: 'selected_z_score',
          option_value: { value: SAMPLE_STANDARD_DEVIATION },
        },
        {
          id: 'option-similarity-method',
          option_category: 'similarity_search',
          option_name: 'selected_method',
          option_value: { method: SAMPLE_SIMILARITY_METHOD },
        },
        {
          id: 'option-routing-columns',
          option_category: 'column_mapping',
          option_name: 'routing_columns',
          option_value: SAMPLE_ROUTING_COLUMNS,
        },
      ];

      setOptions(mockOptions);
      setZScoreValue(String(SAMPLE_STANDARD_DEVIATION));
      setSimilarityMethod(SAMPLE_SIMILARITY_METHOD);
      setRoutingColumns(SAMPLE_ROUTING_COLUMNS);
      setLoading(false);
    }, 200);
  };

  const saveOptions = async () => {
    setLoading(true);
    try {
      toast({
        title: "설정 저장 완료",
        description: "데모 환경에서 선택한 옵션이 저장되었습니다.",
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

  const addColumn = () => {
    if (newColumn.trim() && !routingColumns.includes(newColumn.trim())) {
      setRoutingColumns([...routingColumns, newColumn.trim()]);
      setNewColumn('');
    }
  };

  const removeColumn = (column: string) => {
    setRoutingColumns(routingColumns.filter(col => col !== column));
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="heading-lg text-foreground">시스템 옵션</h1>
        <p className="body-text text-muted-foreground">
          시스템의 전반적인 설정과 옵션을 관리합니다
        </p>
      </div>

      <Tabs defaultValue="prediction" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="prediction">예측 설정</TabsTrigger>
          <TabsTrigger value="columns">컬럼 관리</TabsTrigger>
          <TabsTrigger value="routing">라우팅 설정</TabsTrigger>
          <TabsTrigger value="system">시스템 설정</TabsTrigger>
        </TabsList>

        <TabsContent value="prediction" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="card-gradient">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5" />
                  <span>표준 시간 예측 설정</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="zscore">표준편차 옵션 (Z-Score)</Label>
                  <Select value={zScoreValue} onValueChange={setZScoreValue}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1σ (68.27%)</SelectItem>
                      <SelectItem value="2">2σ (95.45%)</SelectItem>
                      <SelectItem value="3">3σ (99.73%)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground mt-1">
                    선택된 표준편차 범위 내의 데이터를 사용하여 예측합니다
                  </p>
                </div>

                <Separator />

                <div>
                  <Label htmlFor="similarity">유사 품목 검색 방법</Label>
                  <Select value={similarityMethod} onValueChange={setSimilarityMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="코사인 유사도">코사인 유사도</SelectItem>
                      <SelectItem value="유클리드 거리">유클리드 거리</SelectItem>
                      <SelectItem value="맨하탄 거리">맨하탄 거리</SelectItem>
                      <SelectItem value="자카드 유사도">자카드 유사도</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground mt-1">
                    유사한 제품을 찾기 위한 거리 측정 방법을 선택합니다
                  </p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800">충돌 방지</p>
                      <p className="text-sm text-yellow-700">
                        일부 옵션은 동시에 선택할 수 없습니다. 시스템이 자동으로 최적의 조합을 선택합니다.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-gradient">
              <CardHeader>
                <CardTitle>예측 성능 설정</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="confidence">신뢰도 임계값</Label>
                  <Input
                    id="confidence"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    defaultValue="0.85"
                    placeholder="0.85"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    예측 결과의 최소 신뢰도 (0.0 - 1.0)
                  </p>
                </div>

                <div>
                  <Label htmlFor="maxResults">최대 결과 수</Label>
                  <Input
                    id="maxResults"
                    type="number"
                    min="1"
                    max="100"
                    defaultValue="10"
                    placeholder="10"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    유사 품목 검색 시 반환할 최대 결과 수
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>고급 옵션</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="cache" defaultChecked />
                      <Label htmlFor="cache" className="text-sm">예측 결과 캐싱</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="parallel" defaultChecked />
                      <Label htmlFor="parallel" className="text-sm">병렬 처리 활성화</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="logging" defaultChecked />
                      <Label htmlFor="logging" className="text-sm">상세 로깅</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="columns" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="card-gradient">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="w-5 h-5" />
                  <span>라우팅 생성 컬럼</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex space-x-2">
                  <Input
                    placeholder="새 컬럼명 입력"
                    value={newColumn}
                    onChange={(e) => setNewColumn(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addColumn()}
                  />
                  <Button onClick={addColumn} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  {routingColumns.map((column, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-surface-base rounded">
                      <span className="text-sm">{column}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeColumn(column)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="card-gradient">
              <CardHeader>
                <CardTitle>컬럼 매핑 설정</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>학습 데이터 → 라우팅 출력 매핑</Label>
                  <div className="space-y-3 mt-2">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="p-2 bg-surface-base rounded">
                        <span className="font-medium">학습 데이터</span>
                      </div>
                      <div className="p-2 bg-surface-base rounded">
                        <span className="font-medium">출력 데이터</span>
                      </div>
                    </div>
                    
                    {[
                      ['material_type', 'product_material'],
                      ['complexity', 'complexity_level'],
                      ['size', 'product_size'],
                      ['tolerance', 'tolerance_spec']
                    ].map(([source, target], index) => (
                      <div key={index} className="grid grid-cols-2 gap-2 text-sm">
                        <div className="p-2 border rounded">
                          {source}
                        </div>
                        <div className="p-2 border rounded">
                          <Input defaultValue={target} className="h-8" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="routing" className="space-y-6">
          <Card className="card-gradient">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <span>라우팅 요소 관리</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>사용 가능한 공정</Label>
                  <div className="space-y-2 mt-2">
                    {['밀링', '선반', '드릴링', '연삭', '용접', '조립', '검사', '열처리', '표면처리', '포장'].map((operation) => (
                      <div key={operation} className="flex items-center space-x-2">
                        <Checkbox id={operation} defaultChecked />
                        <Label htmlFor={operation} className="text-sm">{operation}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>제품 정보 UI 표시 컬럼</Label>
                  <div className="space-y-2 mt-2">
                    {['product_code', 'product_name', 'material_type', 'complexity', 'size', 'tolerance'].map((column) => (
                      <div key={column} className="flex items-center space-x-2">
                        <Checkbox id={`ui_${column}`} defaultChecked />
                        <Label htmlFor={`ui_${column}`} className="text-sm">{column}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="card-gradient">
              <CardHeader>
                <CardTitle>ERP 인터페이스</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox id="erp_interface" />
                  <Label htmlFor="erp_interface">ERP 인터페이스 활성화</Label>
                </div>
                
                <div>
                  <Label htmlFor="erp_url">ERP 서버 URL</Label>
                  <Input
                    id="erp_url"
                    placeholder="http://erp.company.com/api"
                    disabled
                  />
                </div>

                <div>
                  <Label htmlFor="erp_key">API 키</Label>
                  <Input
                    id="erp_key"
                    type="password"
                    placeholder="ERP API 키"
                    disabled
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="card-gradient">
              <CardHeader>
                <CardTitle>로그 설정</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>로그 레벨</Label>
                  <Select defaultValue="INFO">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEBUG">DEBUG</SelectItem>
                      <SelectItem value="INFO">INFO</SelectItem>
                      <SelectItem value="WARNING">WARNING</SelectItem>
                      <SelectItem value="ERROR">ERROR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="log_retention">로그 보관 기간 (일)</Label>
                  <Input
                    id="log_retention"
                    type="number"
                    defaultValue="30"
                    min="1"
                    max="365"
                  />
                </div>

                <div className="space-y-2">
                  <Label>로그 옵션</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="log_ip" defaultChecked />
                      <Label htmlFor="log_ip" className="text-sm">IP 주소 기록</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="log_actions" defaultChecked />
                      <Label htmlFor="log_actions" className="text-sm">사용자 작업 기록</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="log_performance" />
                      <Label htmlFor="log_performance" className="text-sm">성능 메트릭 기록</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={saveOptions} disabled={loading} className="btn-primary">
          <Save className="w-4 h-4 mr-2" />
          {loading ? '저장 중...' : '모든 설정 저장'}
        </Button>
      </div>
    </div>
  );
};