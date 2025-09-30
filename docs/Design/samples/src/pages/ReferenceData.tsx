import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { SAMPLE_PRODUCTS } from '@/data/sampleData';
import { useToast } from '@/hooks/use-toast';
import { 
  Search, 
  Upload, 
  Download, 
  Database, 
  Filter,
  RefreshCw,
  FileText
} from 'lucide-react';

interface ProductData {
  id: string;
  product_name: string;
  product_code: string;
  matrix_data: any;
  created_at: string;
}

export const ReferenceData: React.FC = () => {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [searchTerm, products]);

  const loadProducts = () => {
    setLoading(true);
    setTimeout(() => {
      setProducts([...SAMPLE_PRODUCTS]);
      setLoading(false);
      toast({
        title: '데이터 로드 완료',
        description: '샘플 제품 데이터가 갱신되었습니다.',
      });
    }, 200);
  };

  const filterProducts = () => {
    if (!searchTerm.trim()) {
      setFilteredProducts(products);
      return;
    }

    const filtered = products.filter(product => 
      product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.product_code.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredProducts(filtered);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Simulate file processing - in real implementation, this would parse Access DB or CSV
    setLoading(true);
    try {
      // Mock data insertion
      const mockData = {
        product_name: `업로드된 제품 ${Date.now()}`,
        product_code: `UPLOAD_${Date.now()}`,
        matrix_data: {
          material_type: "업로드 데이터",
          complexity: "중간",
          size: "중형",
          tolerance: "±0.1mm",
          surface_finish: "Ra 1.6"
        }
      };

      toast({
        title: "파일 업로드 성공",
        description: "제품 데이터가 성공적으로 업로드되었습니다.",
      });
      setProducts(prev => [
        {
          id: `upload-${Date.now()}`,
          product_name: mockData.product_name,
          product_code: mockData.product_code,
          matrix_data: mockData.matrix_data,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (error: any) {
      toast({
        title: "파일 업로드 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportData = () => {
    const csvContent = [
      ['제품명', '제품코드', '재질', '복잡도', '크기', '공차', '표면조도'],
      ...filteredProducts.map(product => [
        product.product_name,
        product.product_code,
        product.matrix_data?.material_type || '',
        product.matrix_data?.complexity || '',
        product.matrix_data?.size || '',
        product.matrix_data?.tolerance || '',
        product.matrix_data?.surface_finish || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'product_reference_data.csv';
    link.click();

    toast({
      title: "데이터 내보내기 완료",
      description: "CSV 파일이 다운로드되었습니다.",
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="heading-lg text-foreground">기준정보 확인</h1>
          <p className="body-text text-muted-foreground">
            제품 기준 정보와 행렬 데이터를 조회하고 관리합니다
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={loadProducts} disabled={loading} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            새로고침
          </Button>
          <Button onClick={exportData} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            내보내기
          </Button>
          <label className="cursor-pointer">
            <Button variant="outline" asChild>
              <span>
                <Upload className="w-4 h-4 mr-2" />
                파일 업로드
              </span>
            </Button>
            <input
              type="file"
              accept=".csv,.xlsx,.mdb,.accdb"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Search and Filter */}
      <Card className="card-gradient">
        <CardContent className="p-4">
          <div className="flex space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="제품명 또는 제품코드로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              필터
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product List */}
        <div className="lg:col-span-2">
          <Card className="card-gradient">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="w-5 h-5" />
                <span>제품 목록</span>
                <Badge variant="secondary">{filteredProducts.length}개</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>제품명</TableHead>
                      <TableHead>제품코드</TableHead>
                      <TableHead>재질</TableHead>
                      <TableHead>복잡도</TableHead>
                      <TableHead>크기</TableHead>
                      <TableHead>등록일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><div className="skeleton h-4 w-24 rounded"></div></TableCell>
                          <TableCell><div className="skeleton h-4 w-20 rounded"></div></TableCell>
                          <TableCell><div className="skeleton h-4 w-16 rounded"></div></TableCell>
                          <TableCell><div className="skeleton h-4 w-12 rounded"></div></TableCell>
                          <TableCell><div className="skeleton h-4 w-12 rounded"></div></TableCell>
                          <TableCell><div className="skeleton h-4 w-20 rounded"></div></TableCell>
                        </TableRow>
                      ))
                    ) : filteredProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <div className="flex flex-col items-center space-y-2">
                            <FileText className="w-8 h-8 text-muted-foreground" />
                            <p className="text-muted-foreground">검색 결과가 없습니다</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProducts.map((product) => (
                        <TableRow 
                          key={product.id}
                          className="cursor-pointer hover:bg-surface-base"
                          onClick={() => setSelectedProduct(product)}
                        >
                          <TableCell className="font-medium">{product.product_name}</TableCell>
                          <TableCell>{product.product_code}</TableCell>
                          <TableCell>{product.matrix_data?.material_type || '-'}</TableCell>
                          <TableCell>{product.matrix_data?.complexity || '-'}</TableCell>
                          <TableCell>{product.matrix_data?.size || '-'}</TableCell>
                          <TableCell>{new Date(product.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Product Details */}
        <div>
          <Card className="card-gradient">
            <CardHeader>
              <CardTitle>제품 상세정보</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedProduct ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="heading-md text-foreground mb-2">{selectedProduct.product_name}</h3>
                    <p className="body-text text-muted-foreground">코드: {selectedProduct.product_code}</p>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="font-medium text-foreground">행렬 데이터</h4>
                    {selectedProduct.matrix_data ? (
                      Object.entries(selectedProduct.matrix_data).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center p-3 bg-surface-base rounded-lg">
                          <span className="text-sm font-medium capitalize">
                            {key.replace(/_/g, ' ')}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {String(value)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">행렬 데이터가 없습니다</p>
                    )}
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      등록일: {new Date(selectedProduct.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                  <Database className="w-12 h-12 mb-4 opacity-50" />
                  <p>제품을 선택하여 상세정보를 확인하세요</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};