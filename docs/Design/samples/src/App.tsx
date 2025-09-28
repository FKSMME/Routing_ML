import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { Navigation } from '@/components/Navigation';
import { AuthPage } from '@/pages/AuthPage';
import { Dashboard } from '@/pages/Dashboard';
import { ReferenceData } from '@/pages/ReferenceData';
import { RoutingGeneration } from '@/pages/RoutingGeneration';
import { AlgorithmVisualization } from '@/pages/AlgorithmVisualization';
import { DataOutputSettings } from '@/pages/DataOutputSettings';
import { LearningDataStatus } from '@/pages/LearningDataStatus';
import { SystemOptions } from '@/pages/SystemOptions';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="skeleton w-32 h-8 rounded"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthProvider>
        <AuthPage />
        <Toaster />
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen">
          <Navigation />
          <main className="pt-16">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/reference-data" element={<ReferenceData />} />
              <Route path="/routing-generation" element={<RoutingGeneration />} />
              <Route path="/algorithm" element={<AlgorithmVisualization />} />
              <Route path="/data-output" element={<DataOutputSettings />} />
              <Route path="/learning-data" element={<LearningDataStatus />} />
              <Route path="/options" element={<SystemOptions />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
        <Toaster />
      </Router>
    </AuthProvider>
  );
}

export default App;