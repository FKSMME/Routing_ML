import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  username?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ data: AuthUser | null; error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    userData?: { username?: string; full_name?: string }
  ) => Promise<{ data: AuthUser | null; error: Error | null }>;
  signOut: () => Promise<void>;
}

const STORAGE_KEY = 'ml-routing-sample-user';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const storedUser = window.localStorage.getItem(STORAGE_KEY);
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      }
    } catch (error) {
      console.warn('Failed to load stored user', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      if (!email || !password) {
        throw new Error('이메일과 비밀번호를 모두 입력해주세요.');
      }

      const mockUser: AuthUser = {
        id: 'demo-user',
        email,
        fullName: 'Demo Operator',
      };

      setUser(mockUser);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mockUser));
      }

      toast({
        title: '로그인 성공',
        description: '머신러닝 라우팅 시스템에 오신 것을 환영합니다.',
      });

      return { data: mockUser, error: null };
    } catch (error: any) {
      toast({
        title: '로그인 실패',
        description: error.message,
        variant: 'destructive',
      });
      return { data: null, error };
    }
  };

  const signUp = async (email: string, password: string, userData?: { username?: string; full_name?: string }) => {
    try {
      if (!email || !password) {
        throw new Error('이메일과 비밀번호를 모두 입력해주세요.');
      }

      const mockUser: AuthUser = {
        id: 'demo-user',
        email,
        fullName: userData?.full_name,
        username: userData?.username,
      };

      setUser(mockUser);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mockUser));
      }

      toast({
        title: '회원가입 성공',
        description: '데모 계정이 생성되었습니다. 바로 로그인되었습니다.',
      });

      return { data: mockUser, error: null };
    } catch (error: any) {
      toast({
        title: '회원가입 실패',
        description: error.message,
        variant: 'destructive',
      });
      return { data: null, error };
    }
  };

  const signOut = async () => {
    try {
      setUser(null);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(STORAGE_KEY);
      }

      toast({
        title: '로그아웃 완료',
        description: '안전하게 로그아웃되었습니다.',
      });
    } catch (error: any) {
      toast({
        title: '로그아웃 실패',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};