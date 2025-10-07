import React, { useState } from 'react';
import { FileCode, Play, Save, RotateCcw } from 'lucide-react';

interface PythonFile {
  id: string;
  name: string;
  path: string;
  type: 'training' | 'prediction' | 'preprocessing' | 'utility';
}

const PYTHON_FILES: PythonFile[] = [
  { id: '1', name: 'train_model.py', path: 'backend/training/train_model.py', type: 'training' },
  { id: '2', name: 'prediction.py', path: 'backend/api/prediction.py', type: 'prediction' },
  { id: '3', name: 'preprocessing.py', path: 'backend/data/preprocessing.py', type: 'preprocessing' },
  { id: '4', name: 'feature_engineering.py', path: 'backend/data/feature_engineering.py', type: 'preprocessing' },
  { id: '5', name: 'model_utils.py', path: 'backend/utils/model_utils.py', type: 'utility' },
  { id: '6', name: 'data_loader.py', path: 'backend/data/data_loader.py', type: 'utility' },
];

export const AlgorithmVisualizationWorkspace: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const getFileTypeColor = (type: PythonFile['type']) => {
    switch (type) {
      case 'training':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      case 'prediction':
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
      case 'preprocessing':
        return 'bg-purple-500/10 border-purple-500/30 text-purple-400';
      case 'utility':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      default:
        return 'bg-slate-500/10 border-slate-500/30 text-slate-400';
    }
  };

  return (
    <div
      className="algorithm-visualization-workspace flex w-full bg-slate-950"
      style={{ height: 'calc(100vh - 150px)', minHeight: '600px' }}
      data-version="v3"
    >
      {/* 좌측 패널: 파일 목록 (20% 너비) */}
      <div className="file-panel w-1/5 min-w-[250px] border-r border-slate-700/50 bg-slate-900/50 p-4 overflow-y-auto flex-shrink-0">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
            <FileCode className="w-4 h-4" />
            Python Files
          </h3>
          <input
            type="text"
            placeholder="Search files..."
            className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700/50 rounded-lg
                     text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        <div className="space-y-2">
          {PYTHON_FILES.map((file) => (
            <button
              key={file.id}
              onClick={() => setSelectedFile(file.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all duration-200
                ${
                  selectedFile === file.id
                    ? 'bg-blue-500/20 border-blue-500/50 shadow-lg shadow-blue-500/20'
                    : `${getFileTypeColor(file.type)} hover:bg-opacity-20`
                }`}
            >
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{file.name}</div>
                  <div className="text-xs text-slate-500 truncate">{file.path}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-700/50">
          <div className="text-xs text-slate-500 space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500/30"></div>
              <span>Training</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500/30"></div>
              <span>Prediction</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500/30"></div>
              <span>Preprocessing</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500/30"></div>
              <span>Utility</span>
            </div>
          </div>
        </div>
      </div>

      {/* 우측 캔버스: 노드 시각화 (80% 너비) */}
      <div className="canvas-panel flex-1 flex flex-col bg-slate-950/50">
        {/* 툴바 */}
        <div className="toolbar flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-900/30">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-300">
              {selectedFile
                ? PYTHON_FILES.find((f) => f.id === selectedFile)?.name
                : 'Select a file to visualize'}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 text-sm bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50
                       rounded-lg text-slate-300 transition-colors flex items-center gap-2"
              title="Run analysis"
            >
              <Play className="w-4 h-4" />
              Analyze
            </button>
            <button
              className="px-3 py-1.5 text-sm bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50
                       rounded-lg text-blue-400 transition-colors flex items-center gap-2"
              title="Save layout"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
            <button
              className="px-3 py-1.5 text-sm bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50
                       rounded-lg text-slate-300 transition-colors flex items-center gap-2"
              title="Reset layout"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>

        {/* 캔버스 영역 */}
        <div className="canvas-container flex-1 relative bg-gradient-to-br from-slate-950 to-slate-900">
          {selectedFile ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-slate-500">
                <FileCode className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Algorithm Flow Canvas</p>
                <p className="text-sm">
                  Node visualization will appear here
                  <br />
                  (React Flow integration coming next)
                </p>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-slate-500">
                <FileCode className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-2">No File Selected</p>
                <p className="text-sm">Select a Python file from the left panel to visualize its algorithm flow</p>
              </div>
            </div>
          )}

          {/* 그리드 배경 (옵션) */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgb(148 163 184) 1px, transparent 1px),
                linear-gradient(to bottom, rgb(148 163 184) 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px',
            }}
          ></div>
        </div>
      </div>
    </div>
  );
};
