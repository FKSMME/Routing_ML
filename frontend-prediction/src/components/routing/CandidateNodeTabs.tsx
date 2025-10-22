/**
 * CandidateNodeTabs - Displays similar item candidates as clickable node tabs
 *
 * Phase 3.2 - Candidate Node UI Component
 * Phase 3.3 - Enhanced Styling, Responsiveness, and Accessibility
 */

import React from 'react';
import type { CandidateRouting } from '@app-types/routing';
import { useRoutingStore } from '../../store/routingStore';

interface CandidateNodeCardProps {
  candidate: CandidateRouting;
  index: number;
  isActive: boolean;
  onClick: () => void;
}

const CandidateNodeCard: React.FC<CandidateNodeCardProps> = ({
  candidate,
  index,
  isActive,
  onClick,
}) => {
  const similarityPercent = Math.round(candidate.SIMILARITY_SCORE * 100);

  // Tooltip text for similarity score
  const getSimilarityTooltip = () => {
    if (similarityPercent >= 90) return 'Very High Similarity - Strong match';
    if (similarityPercent >= 80) return 'High Similarity - Good match';
    if (similarityPercent >= 70) return 'Medium Similarity - Moderate match';
    return 'Low Similarity - Weak match';
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`
        candidate-node-card
        px-3 py-2 sm:px-4 sm:py-3 rounded-lg border-2 transition-all duration-200
        flex flex-col items-start gap-2 min-w-[140px] sm:min-w-[160px]
        hover:shadow-lg hover:scale-105 active:scale-95
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${isActive
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg scale-105'
          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-500'
        }
      `}
      aria-label={`Candidate item ${candidate.CANDIDATE_ITEM_CD}, rank ${candidate.RANK}, ${similarityPercent}% similarity${isActive ? ', currently selected' : ''}`}
      aria-pressed={isActive}
      role="tab"
      tabIndex={0}
      title={`Click to view routing for ${candidate.CANDIDATE_ITEM_CD}`}
    >
      <div className="flex items-center justify-between w-full">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Rank #{candidate.RANK}
        </span>
        <span
          className={`
            text-xs font-bold px-2 py-0.5 rounded transition-colors
            ${similarityPercent >= 90 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
              similarityPercent >= 80 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
              similarityPercent >= 70 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
              'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}
          `}
          title={getSimilarityTooltip()}
          aria-label={getSimilarityTooltip()}
        >
          {similarityPercent}%
        </span>
      </div>

      <div className="w-full">
        <div className="font-mono text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
          {candidate.CANDIDATE_ITEM_CD}
        </div>
        {candidate.PROCESS_COUNT && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {candidate.PROCESS_COUNT} processes
          </div>
        )}
        {(candidate.WORK_ORDER_COUNT || candidate.WORK_ORDER_CONFIDENCE !== undefined) && (
          <div className="text-[11px] text-gray-500 dark:text-gray-400">
            {candidate.WORK_ORDER_COUNT ? `샘플 ${candidate.WORK_ORDER_COUNT}` : null}
            {candidate.WORK_ORDER_CONFIDENCE !== undefined && candidate.WORK_ORDER_CONFIDENCE !== null ? (
              <span className="ml-1">신뢰 {Math.round(candidate.WORK_ORDER_CONFIDENCE * 100)}%</span>
            ) : null}
          </div>
        )}
        {candidate.OUTSOURCING_REPLACED ? (
          <div className="inline-flex items-center px-2 py-0.5 mt-1 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 text-[10px] font-semibold">사내전환</div>
        ) : null}
      </div>

      {candidate.HAS_ROUTING === 'Y' && (
        <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 transition-colors">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span>Has routing</span>
        </div>
      )}
    </button>
  );
};

interface CandidateNodeTabsProps {
  className?: string;
}

export const CandidateNodeTabs: React.FC<CandidateNodeTabsProps> = ({ className = '' }) => {
  const candidates = useRoutingStore((state) => state.candidates);
  const activeCandidateIndex = useRoutingStore((state) => state.activeCandidateIndex);
  const selectCandidate = useRoutingStore((state) => state.selectCandidate);

  // Keyboard navigation handler
  const handleKeyNavigation = React.useCallback((e: React.KeyboardEvent, currentIndex: number) => {
    if (e.key === 'ArrowRight' && currentIndex < candidates.length - 1) {
      e.preventDefault();
      const nextButton = document.querySelector(`[data-candidate-index="${currentIndex + 1}"]`) as HTMLButtonElement;
      nextButton?.focus();
    } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
      e.preventDefault();
      const prevButton = document.querySelector(`[data-candidate-index="${currentIndex - 1}"]`) as HTMLButtonElement;
      prevButton?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      const firstButton = document.querySelector('[data-candidate-index="0"]') as HTMLButtonElement;
      firstButton?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      const lastButton = document.querySelector(`[data-candidate-index="${candidates.length - 1}"]`) as HTMLButtonElement;
      lastButton?.focus();
    }
  }, [candidates.length]);

  if (!candidates || candidates.length === 0) {
    return null;
  }

  return (
    <div className={`candidate-node-tabs ${className}`} role="region" aria-label="Similar item candidates">
      <div className="mb-2 sm:mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
          Similar Items
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Click a candidate to view its routing (Total: {candidates.length})
        </p>
      </div>

      <div
        className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scroll-smooth"
        role="tablist"
        aria-label="Candidate items"
      >
        {candidates.map((candidate, index) => (
          <div key={`${candidate.CANDIDATE_ITEM_CD}-${index}`} data-candidate-index={index}>
            <CandidateNodeCard
              candidate={candidate}
              index={index}
              isActive={activeCandidateIndex === index}
              onClick={() => selectCandidate(index)}
            />
          </div>
        ))}
      </div>

      {activeCandidateIndex !== null && candidates[activeCandidateIndex] && (
        <div
          className="mt-2 sm:mt-3 p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800 transition-all duration-200"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="flex items-start justify-between flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Viewing: {candidates[activeCandidateIndex].CANDIDATE_ITEM_CD}
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Similarity: {Math.round(candidates[activeCandidateIndex].SIMILARITY_SCORE * 100)}% •
                Rank: #{candidates[activeCandidateIndex].RANK}
                {candidates[activeCandidateIndex].PROCESS_COUNT && ` • ${candidates[activeCandidateIndex].PROCESS_COUNT} processes`}
              </div>
            </div>
            <button
              type="button"
              onClick={() => selectCandidate(null)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 transition-colors whitespace-nowrap"
              aria-label="Clear candidate selection"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CandidateNodeTabs;
