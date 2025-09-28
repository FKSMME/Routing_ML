import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  Activity, 
  Database, 
  Route, 
  Settings, 
  TrendingUp,
  Users,
  Clock,
  CheckCircle
} from 'lucide-react';

interface DashboardStats {
  totalProducts: number;
  totalRoutings: number;
  activeModels: number;
  recentActivity: number;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalRoutings: 0,
    activeModels: 0,
    recentActivity: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load statistics from database
      const [productsResult, routingsResult, modelsResult, activityResult] = await Promise.all([
        supabase.from('product_reference_data_2025_09_28_04_25').select('id', { count: 'exact' }),
        supabase.from('routing_configurations_2025_09_28_04_25').select('id', { count: 'exact' }),
        supabase.from('ml_model_data_2025_09_28_04_25').select('id', { count: 'exact' }),
        supabase.from('activity_logs_2025_09_28_04_25')
          .select('id', { count: 'exact' })
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      ]);

      setStats({
        totalProducts: productsResult.count || 0,
        totalRoutings: routingsResult.count || 0,
        activeModels: modelsResult.count || 0,
        recentActivity: activityResult.count || 0
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      title: '새 라우팅 생성',
      description: '제품 데이터를 기반으로 새로운 라우팅을 생성합니다',
      icon: Route,
      href: '/routing-generation',
      color: 'bg-primary'
    },
    {
      title: '기준정보 확인',
      description: '제품 기준 정보와 행렬 데이터를 조회합니다',
      icon: Database,
      href: '/reference-data',
      color: 'bg-secondary'
    },
    {
      title: '알고리즘 설정',
      description: '머신러닝 알고리즘을 시각화하고 설정합니다',
      icon: Settings,
      href: '/algorithm',
      color: 'bg-accent'
    },
    {
      title: '학습 데이터 현황',
      description: '모델 성능과 학습 데이터를 분석합니다',
      icon: TrendingUp,
      href: '/learning-data',
      color: 'bg-chart-3'
    }
  ];

  const recentActivities = [
    { action: '라우팅 생성', item: 'PROD_A_001', time: '5분 전', status: 'success' },
    { action: '모델 학습', item: 'ProductRoutingModel_v2', time: '1시간 전', status: 'success' },
    { action: '데이터 업로드', item: '제품 기준정보', time: '2시간 전', status: 'success' },
    { action: '설정 변경', item: '출력 포맷', time: '3시간 전', status: 'success' }
  ];

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="card-gradient">
              <CardContent className="p-6">
                <div className="skeleton h-16 w-full rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="heading-lg text-foreground">대시보드</h1>
        <p className="body-text text-muted-foreground">
          머신러닝 라우팅 시스템의 전체 현황을 확인하세요
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="card-gradient">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="body-text text-muted-foreground">총 제품 수</p>
                <p className="heading-md text-primary">{stats.totalProducts}</p>
              </div>
              <Database className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-gradient">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="body-text text-muted-foreground">생성된 라우팅</p>
                <p className="heading-md text-secondary">{stats.totalRoutings}</p>
              </div>
              <Route className="w-8 h-8 text-secondary" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-gradient">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="body-text text-muted-foreground">활성 모델</p>
                <p className="heading-md text-accent">{stats.activeModels}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-accent" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-gradient">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="body-text text-muted-foreground">최근 활동</p>
                <p className="heading-md text-chart-3">{stats.recentActivity}</p>
              </div>
              <Activity className="w-8 h-8 text-chart-3" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <h2 className="heading-md text-foreground">빠른 작업</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Card key={index} className="card-gradient hover:shadow-lg transition-all duration-300 cursor-pointer group">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className={`w-12 h-12 rounded-lg ${action.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="heading-md text-foreground mb-2">{action.title}</h3>
                      <p className="body-text text-muted-foreground">{action.description}</p>
                    </div>
                    <Button 
                      className="w-full btn-primary"
                      onClick={() => window.location.href = action.href}
                    >
                      시작하기
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="card-gradient">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="w-5 h-5" />
              <span>최근 활동</span>
            </CardTitle>
            <CardDescription>
              시스템에서 최근 수행된 작업들입니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-surface-base">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <div>
                      <p className="body-text font-medium">{activity.action}</p>
                      <p className="text-sm text-muted-foreground">{activity.item}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{activity.time}</p>
                    <Badge variant="secondary" className="text-xs">
                      완료
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="card-gradient">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5" />
              <span>시스템 상태</span>
            </CardTitle>
            <CardDescription>
              현재 시스템의 전반적인 상태입니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="body-text">데이터베이스 연결</span>
                <Badge className="bg-green-100 text-green-800">정상</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="body-text">ML 모델 상태</span>
                <Badge className="bg-green-100 text-green-800">활성</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="body-text">API 서비스</span>
                <Badge className="bg-green-100 text-green-800">정상</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="body-text">백업 상태</span>
                <Badge className="bg-blue-100 text-blue-800">최신</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};