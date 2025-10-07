import React, { useState, useEffect } from 'react';
import { Check, X, UserCheck, Clock, Shield } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

interface PendingUser {
  username: string;
  full_name?: string;
  email?: string;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected';
}

export const UserApprovalPanel: React.FC = () => {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPendingUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/auth/admin/pending-users');
      setPendingUsers(response.data.users || []);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || '회원 목록을 불러오는데 실패했습니다');
      console.error('Failed to fetch pending users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (username: string, makeAdmin: boolean = false) => {
    try {
      await apiClient.post('/api/auth/admin/approve', {
        username,
        make_admin: makeAdmin,
      });

      alert(`${username}님을 ${makeAdmin ? '관리자로' : '일반 사용자로'} 승인했습니다.`);
      fetchPendingUsers();
    } catch (err: any) {
      alert(err.response?.data?.detail || '승인에 실패했습니다');
    }
  };

  const handleReject = async (username: string) => {
    if (!confirm(`${username}님의 가입을 거부하시겠습니까?`)) return;

    try {
      await apiClient.post('/api/auth/admin/reject', { username });
      alert(`${username}님의 가입을 거부했습니다.`);
      fetchPendingUsers();
    } catch (err: any) {
      alert(err.response?.data?.detail || '거부에 실패했습니다');
    }
  };

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-lg">
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchPendingUsers}
          className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-300"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="user-approval-panel space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
          <UserCheck className="w-5 h-5" />
          회원 승인 관리
        </h3>
        <button
          onClick={fetchPendingUsers}
          className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg text-sm text-slate-300"
        >
          새로고침
        </button>
      </div>

      {pendingUsers.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>대기 중인 회원이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingUsers.map((user) => (
            <div
              key={user.username}
              className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg hover:border-slate-600/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-base font-medium text-slate-200">{user.username}</h4>
                    {user.full_name && (
                      <span className="text-sm text-slate-400">({user.full_name})</span>
                    )}
                    <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                      대기 중
                    </span>
                  </div>
                  {user.email && (
                    <p className="text-sm text-slate-400">{user.email}</p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    가입 요청: {new Date(user.created_at).toLocaleString('ko-KR')}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApprove(user.username, true)}
                    className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 rounded-lg text-purple-300 text-sm flex items-center gap-1.5 transition-colors"
                    title="관리자로 승인"
                  >
                    <Shield className="w-4 h-4" />
                    관리자
                  </button>
                  <button
                    onClick={() => handleApprove(user.username, false)}
                    className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 rounded-lg text-emerald-300 text-sm flex items-center gap-1.5 transition-colors"
                    title="일반 사용자로 승인"
                  >
                    <Check className="w-4 h-4" />
                    승인
                  </button>
                  <button
                    onClick={() => handleReject(user.username)}
                    className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg text-red-300 text-sm flex items-center gap-1.5 transition-colors"
                    title="가입 거부"
                  >
                    <X className="w-4 h-4" />
                    거부
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-sm text-blue-300">
          💡 <strong>관리자</strong>는 모든 시스템 관리 권한을, <strong>일반 사용자</strong>는 기본 기능만 사용할 수 있습니다.
        </p>
      </div>
    </div>
  );
};
