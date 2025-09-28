import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Save, FileOutput, Settings, Plus, Trash2 } from 'lucide-react';

interface OutputColumn {
  id: string;
  name: string;
  type: string;
  required: boolean;
}

export const DataOutputSettings: React.FC = () => {
  const [outputColumns, setOutputColumns] = useState<OutputColumn[]>([
    { id: '1', name: 'product_code', type: 'string', required: true },
    { id: '2', name: 'operation', type: 'string', required: true },
    { id: '3', name: 'time', type: 'number', required: true },
    { id: '4', name: 'machine', type: 'string', required: false },
  ]);
  const [selectedFormat, setSelectedFormat] = useState('CSV');
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [includeTimestamp, setIncludeTimestamp] = useState(true);
  const { toast } = useToast();

  const addColumn = () => {
    const newColumn: OutputColumn = {
      id: Date.now().toString(),
      name: '',
      type: 'string',
      required: false
    };
    setOutputColumns([...outputColumns, newColumn]);
  };

  const removeColumn = (id: string) => {
    setOutputColumns(outputColumns.filter(col => col.id !== id));
  };

  const updateColumn = (id: string, field: keyof OutputColumn, value: any) => {
    setOutputColumns(outputColumns.map(col => 
      col.id === id ? { ...col, [field]: value } : col
    ));
  };

  const saveSettings = () => {
    toast({
      title: "설정 저장 완료",
      description: "데이터 출력 설정이 성공적으로 저장되었습니다.",
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="heading-lg text-foreground">데이터 출력 설정</h1>
        <p className="body-text text-muted-foreground">
          라우팅 생성 후 출력될 데이터의 구조와 형식을 설정합니다
        </p>
      </div>

      <Tabs defaultValue="columns" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="columns">컬럼 설정</TabsTrigger>
          <TabsTrigger value="format">출력 형식</TabsTrigger>
          <TabsTrigger value="preview">미리보기</TabsTrigger>
        </TabsList>

        <TabsContent value="columns" className="space-y-6">
          <Card className="card-gradient">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>출력 컬럼 구성</span>
                <Button onClick={addColumn} size="sm" className="btn-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  컬럼 추가
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {outputColumns.map((column) => (
                  <div key={column.id} className="flex items-center space-x-4 p-4 bg-surface-base rounded-lg">
                    <div className="flex-1 grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor={`name-${column.id}`}>컬럼명</Label>
                        <Input
                          id={`name-${column.id}`}
                          value={column.name}
                          onChange={(e) => updateColumn(column.id, 'name', e.target.value)}
                          placeholder="컬럼명 입력"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`type-${column.id}`}>데이터 타입</Label>
                        <Select value={column.type} onValueChange={(value) => updateColumn(column.id, 'type', value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="string">문자열</SelectItem>
                            <SelectItem value="number">숫자</SelectItem>
                            <SelectItem value="date">날짜</SelectItem>
                            <SelectItem value="boolean">불린</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`required-${column.id}`}
                          checked={column.required}
                          onCheckedChange={(checked) => updateColumn(column.id, 'required', checked)}
                        />
                        <Label htmlFor={`required-${column.id}`}>필수</Label>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeColumn(column.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="format" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="card-gradient">
              <CardHeader>
                <CardTitle>출력 형식 설정</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="format">파일 형식</Label>
                  <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CSV">CSV</SelectItem>
                      <SelectItem value="XML">XML</SelectItem>
                      <SelectItem value="JSON">JSON</SelectItem>
                      <SelectItem value="Excel">Excel</SelectItem>
                      <SelectItem value="ACCESS">ACCESS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="headers"
                      checked={includeHeaders}
                      onCheckedChange={setIncludeHeaders}
                    />
                    <Label htmlFor="headers">헤더 포함</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="timestamp"
                      checked={includeTimestamp}
                      onCheckedChange={setIncludeTimestamp}
                    />
                    <Label htmlFor="timestamp">타임스탬프 포함</Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-gradient">
              <CardHeader>
                <CardTitle>고급 설정</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="delimiter">구분자 (CSV용)</Label>
                  <Select defaultValue=",">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=",">쉼표 (,)</SelectItem>
                      <SelectItem value=";">세미콜론 (;)</SelectItem>
                      <SelectItem value="\t">탭</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="encoding">인코딩</Label>
                  <Select defaultValue="UTF-8">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTF-8">UTF-8</SelectItem>
                      <SelectItem value="EUC-KR">EUC-KR</SelectItem>
                      <SelectItem value="ASCII">ASCII</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <Card className="card-gradient">
            <CardHeader>
              <CardTitle>출력 미리보기</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-surface-base rounded-lg p-4 font-mono text-sm">
                {selectedFormat === 'CSV' && (
                  <div>
                    {includeHeaders && (
                      <div className="text-muted-foreground mb-2">
                        {outputColumns.map(col => col.name).join(',')}
                      </div>
                    )}
                    <div>PROD_A_001,밀링,15,CNC-001</div>
                    <div>PROD_A_001,드릴링,8,DRILL-002</div>
                    <div>PROD_A_001,검사,5,CMM-001</div>
                  </div>
                )}
                {selectedFormat === 'JSON' && (
                  <pre>{JSON.stringify([
                    {
                      product_code: "PROD_A_001",
                      operation: "밀링",
                      time: 15,
                      machine: "CNC-001"
                    }
                  ], null, 2)}</pre>
                )}
                {selectedFormat === 'XML' && (
                  <div>
                    <div>&lt;routing&gt;</div>
                    <div className="ml-4">&lt;step&gt;</div>
                    <div className="ml-8">&lt;product_code&gt;PROD_A_001&lt;/product_code&gt;</div>
                    <div className="ml-8">&lt;operation&gt;밀링&lt;/operation&gt;</div>
                    <div className="ml-8">&lt;time&gt;15&lt;/time&gt;</div>
                    <div className="ml-8">&lt;machine&gt;CNC-001&lt;/machine&gt;</div>
                    <div className="ml-4">&lt;/step&gt;</div>
                    <div>&lt;/routing&gt;</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={saveSettings} className="btn-primary">
          <Save className="w-4 h-4 mr-2" />
          설정 저장
        </Button>
      </div>
    </div>
  );
};