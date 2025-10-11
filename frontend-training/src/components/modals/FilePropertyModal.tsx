import React from 'react';
import { X, FileCode, FolderOpen, Calendar, Weight, Code2, Brackets } from 'lucide-react';

interface FileInfo {
  name: string;
  path?: string;
  type: string;
  size?: string;
  lastModified?: string;
  functions?: string[];
  classes?: string[];
  imports?: string[];
  sourceCode?: string;
  params?: string[];
  returns?: string;
  docstring?: string;
  lineStart?: number;
  lineEnd?: number;
}

interface FilePropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileInfo: FileInfo | null;
}

export function FilePropertyModal({ isOpen, onClose, fileInfo }: FilePropertyModalProps) {
  if (!isOpen || !fileInfo) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
              <FileCode className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">{fileInfo.name}</h2>
              <p className="text-sm text-slate-400">파일 속성</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              기본 정보
            </h3>
            <div className="bg-slate-800/50 rounded-lg p-4 space-y-2 border border-slate-700/50">
              <div className="flex justify-between">
                <span className="text-sm text-slate-400">파일명:</span>
                <span className="text-sm text-slate-200 font-mono">{fileInfo.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-400">경로:</span>
                <span className="text-sm text-slate-200 font-mono">{fileInfo.path}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-400">타입:</span>
                <span className="text-sm text-slate-200 capitalize">{fileInfo.type}</span>
              </div>
              {fileInfo.size && (
                <div className="flex justify-between">
                  <span className="text-sm text-slate-400">크기:</span>
                  <span className="text-sm text-slate-200">{fileInfo.size}</span>
                </div>
              )}
              {fileInfo.lastModified && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    최종 수정:
                  </span>
                  <span className="text-sm text-slate-200">{fileInfo.lastModified}</span>
                </div>
              )}
            </div>
          </div>

          {/* Functions */}
          {fileInfo.functions && fileInfo.functions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Brackets className="w-4 h-4" />
                함수 목록 ({fileInfo.functions.length})
              </h3>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                <div className="grid grid-cols-2 gap-2">
                  {fileInfo.functions.map((func, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm font-mono text-blue-300"
                    >
                      {func}()
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Classes */}
          {fileInfo.classes && fileInfo.classes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Code2 className="w-4 h-4" />
                클래스 목록 ({fileInfo.classes.length})
              </h3>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                <div className="grid grid-cols-2 gap-2">
                  {fileInfo.classes.map((cls, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm font-mono text-emerald-300"
                    >
                      {cls}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Imports */}
          {fileInfo.imports && fileInfo.imports.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Weight className="w-4 h-4" />
                Import 목록 ({fileInfo.imports.length})
              </h3>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                <div className="space-y-1">
                  {fileInfo.imports.map((imp, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-1.5 text-xs font-mono text-slate-400 bg-slate-900/50 rounded border border-slate-700/30"
                    >
                      {imp}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Source Code */}
          {fileInfo.sourceCode && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Code2 className="w-4 h-4" />
                소스 코드 {fileInfo.lineStart && `(Lines ${fileInfo.lineStart}-${fileInfo.lineEnd})`}
              </h3>
              {fileInfo.docstring && (
                <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3 mb-3">
                  <p className="text-xs text-blue-200 whitespace-pre-wrap">{fileInfo.docstring}</p>
                </div>
              )}
              {fileInfo.params && fileInfo.params.length > 0 && (
                <div className="bg-slate-800/30 rounded-lg p-3 mb-3">
                  <p className="text-xs font-semibold text-slate-400 mb-2">Parameters:</p>
                  <div className="space-y-1">
                    {fileInfo.params.map((param, idx) => (
                      <div key={idx} className="text-xs font-mono text-sky-300">• {param}</div>
                    ))}
                  </div>
                </div>
              )}
              {fileInfo.returns && (
                <div className="bg-slate-800/30 rounded-lg p-3 mb-3">
                  <p className="text-xs font-semibold text-slate-400 mb-1">Returns:</p>
                  <div className="text-xs font-mono text-emerald-300">{fileInfo.returns}</div>
                </div>
              )}
              <div className="bg-slate-950 rounded-lg p-4 border border-slate-700/50 overflow-x-auto max-h-96">
                <pre className="text-xs text-slate-300 font-mono leading-relaxed whitespace-pre">
                  {fileInfo.sourceCode}
                </pre>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!fileInfo.functions?.length && !fileInfo.classes?.length && !fileInfo.imports?.length && !fileInfo.sourceCode && (
            <div className="text-center py-8 text-slate-500">
              <Code2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">파일 분석 정보가 없습니다</p>
              <p className="text-xs mt-1">Backend API를 통해 파일을 분석하세요</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-2 bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-200 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
