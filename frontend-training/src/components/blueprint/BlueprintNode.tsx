// @ts-nocheck - ReactFlow v12 type compatibility issues
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Database,
  Filter,
  Sparkles,
  Brain,
  GraduationCap,
  LineChart,
  CheckCircle,
  Save,
  FileOutput,
  Package,
} from 'lucide-react';

export interface BlueprintNodeData {
  label: string;
  type: 'data_input' | 'preprocessing' | 'feature_engineering' | 'model_inference' | 'model_training' | 'statistical_analysis' | 'validation' | 'model_persistence' | 'output' | 'cache';
  description?: string;
  parameters?: Record<string, unknown>;
  status?: 'idle' | 'running' | 'success' | 'error';
}

const NODE_CONFIG = {
  data_input: {
    color: '#4A90E2',
    icon: Database,
    label: '데이터 입력',
  },
  preprocessing: {
    color: '#F5A623',
    icon: Filter,
    label: '전처리',
  },
  feature_engineering: {
    color: '#7ED321',
    icon: Sparkles,
    label: '피처 엔지니어링',
  },
  model_inference: {
    color: '#BD10E0',
    icon: Brain,
    label: '모델 추론',
  },
  model_training: {
    color: '#D0021B',
    icon: GraduationCap,
    label: '모델 학습',
  },
  statistical_analysis: {
    color: '#50E3C2',
    icon: LineChart,
    label: '통계 분석',
  },
  validation: {
    color: '#F8E71C',
    icon: CheckCircle,
    label: '검증',
  },
  model_persistence: {
    color: '#9013FE',
    icon: Save,
    label: '모델 저장',
  },
  output: {
    color: '#417505',
    icon: FileOutput,
    label: '출력',
  },
  cache: {
    color: '#8B572A',
    icon: Package,
    label: '캐시',
  },
};

export const BlueprintNode = memo(({ data, selected }: NodeProps<BlueprintNodeData>) => {
  const config = NODE_CONFIG[data.type];
  const Icon = config.icon;

  const getStatusColor = () => {
    switch (data.status) {
      case 'running':
        return 'border-primary-500 shadow-glow';
      case 'success':
        return 'border-cyber-500 shadow-glow-green';
      case 'error':
        return 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]';
      default:
        return 'border-dark-border';
    }
  };

  return (
    <div
      className={`
        relative min-w-[200px] rounded-lg border-2
        glass-morphism holographic
        transition-all duration-300 ease-in-out
        hover:shadow-lg hover:scale-105 bounce-hover
        ${selected ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-dark-bg pulse-glow' : ''}
        ${getStatusColor()}
      `}
    >
      {/* Top Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-primary-500 !border-2 !border-dark-surface"
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-md border-b border-dark-border"
        style={{ backgroundColor: `${config.color}20` }}
      >
        <div
          className="p-1.5 rounded-md"
          style={{ backgroundColor: config.color }}
        >
          <Icon size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-muted uppercase tracking-wide">
            {config.label}
          </div>
        </div>
        {data.status === 'running' && (
          <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
        )}
      </div>

      {/* Content */}
      <div className="px-3 py-2">
        <div className="text-sm font-medium text-foreground mb-1">
          {data.label}
        </div>
        {data.description && (
          <div className="text-xs text-muted line-clamp-2">
            {data.description}
          </div>
        )}
        {data.parameters && Object.keys(data.parameters).length > 0 && (
          <div className="mt-2 pt-2 border-t border-dark-border">
            <div className="text-xs text-muted">
              {Object.keys(data.parameters).length} parameter(s)
            </div>
          </div>
        )}
      </div>

      {/* Bottom Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-primary-500 !border-2 !border-dark-surface"
      />
    </div>
  );
});

BlueprintNode.displayName = 'BlueprintNode';
