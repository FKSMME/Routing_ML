import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  Database,
  Route,
  Settings,
  FileOutput,
  BarChart3,
  Cog,
  LogOut,
  Menu,
  X
} from 'lucide-react';

const menuItems = [
  { path: '/', label: '대시보드', icon: BarChart3 },
  { path: '/reference-data', label: '기준정보 확인', icon: Database },
  { path: '/routing-generation', label: '라우팅 생성', icon: Route },
  { path: '/algorithm', label: '알고리즘', icon: Settings },
  { path: '/data-output', label: '데이터 출력 설정', icon: FileOutput },
  { path: '/learning-data', label: '학습 데이터 현황', icon: BarChart3 },
  { path: '/options', label: '옵션', icon: Cog },
];

export const Navigation: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { signOut, user } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-overlay border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="heading-md text-primary font-bold">
              ML 라우팅 시스템
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`menu-item flex items-center space-x-2 ${
                    isActive ? 'active' : ''
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="body-text">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            <span className="body-text text-muted-foreground">
              {user?.email}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              className="flex items-center space-x-2"
            >
              <LogOut className="w-4 h-4" />
              <span>로그아웃</span>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden py-4 border-t">
            <div className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`menu-item flex items-center space-x-3 w-full ${
                      isActive ? 'active' : ''
                    }`}
                    onClick={() => setIsOpen(false)}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="body-text">{item.label}</span>
                  </Link>
                );
              })}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="body-text text-muted-foreground">
                    {user?.email}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={signOut}
                    className="flex items-center space-x-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>로그아웃</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};