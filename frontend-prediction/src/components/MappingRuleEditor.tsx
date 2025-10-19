import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { DataMappingRule, DataMappingSourceType } from '../types';

interface MappingRuleEditorProps {
  mapping: DataMappingRule;
  onUpdate: (updated: DataMappingRule) => void;
}

export function MappingRuleEditor({ mapping, onUpdate }: MappingRuleEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const sourceTypeColors: Record<DataMappingSourceType, { bg: string; border: string; text: string }> = {
    ml_prediction: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
    admin_input: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
    external_source: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-700',
    },
    constant: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
  };

  const colors = sourceTypeColors[mapping.source_type] ?? sourceTypeColors.ml_prediction;

  const handleFieldChange = (field: keyof DataMappingRule, value: any) => {
    onUpdate({
      ...mapping,
      [field]: value,
    });
  };

  return (
    <div
      className={`
        border rounded-lg transition-all
        ${colors.border} ${isExpanded ? colors.bg : 'bg-white hover:bg-gray-50'}
      `}
    >
      {/* Header */}
      <div
        className="p-3 cursor-pointer flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 flex-1">
          <button className="text-gray-400 hover:text-gray-600">
            {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-medium text-gray-900">
                {mapping.db_column}
              </span>
              <span
                className={`
                  px-2 py-0.5 text-xs font-medium rounded
                  ${colors.bg} ${colors.text}
                `}
              >
                {mapping.source_type.replace('_', ' ')}
              </span>
              {mapping.is_required && (
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700">
                  Required
                </span>
              )}
            </div>
            {!isExpanded && mapping.display_name && (
              <div className="text-xs text-gray-500 mt-1">{mapping.display_name}</div>
            )}
          </div>
          {!isExpanded && mapping.default_value && (
            <div className="text-xs text-gray-600">
              Default: <span className="font-mono">{mapping.default_value}</span>
            </div>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 mt-4">
            {/* Column 1 */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  DB Column Name
                </label>
                <input
                  type="text"
                  value={mapping.db_column}
                  onChange={(e) => handleFieldChange('db_column', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Routing Field
                </label>
                <input
                  type="text"
                  value={mapping.routing_field}
                  onChange={(e) => handleFieldChange('routing_field', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={mapping.display_name || ''}
                  onChange={(e) => handleFieldChange('display_name', e.target.value || undefined)}
                  placeholder="Optional"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Data Type</label>
                <select
                  value={mapping.data_type}
                  onChange={(e) =>
                    handleFieldChange(
                      'data_type',
                      e.target.value as 'string' | 'number' | 'boolean' | 'date'
                    )
                  }
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="string">String</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="date">Date</option>
                </select>
              </div>
            </div>

            {/* Column 2 */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Source Type
                </label>
                <select
                  value={mapping.source_type}
                  onChange={(e) =>
                    handleFieldChange(
                      'source_type',
                      e.target.value as
                        | 'ml_prediction'
                        | 'admin_input'
                        | 'external_source'
                        | 'constant'
                    )
                  }
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="ml_prediction">ML Prediction</option>
                  <option value="admin_input">Admin Input</option>
                  <option value="external_source">External Source</option>
                  <option value="constant">Constant</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Default Value
                </label>
                <input
                  type="text"
                  value={mapping.default_value || ''}
                  onChange={(e) => handleFieldChange('default_value', e.target.value || undefined)}
                  placeholder={
                    mapping.source_type === 'ml_prediction'
                      ? 'From ML predictions'
                      : 'Enter default value'
                  }
                  disabled={mapping.source_type === 'ml_prediction'}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Transform Rule
                </label>
                <select
                  value={mapping.transform_rule || ''}
                  onChange={(e) => handleFieldChange('transform_rule', e.target.value || undefined)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">None</option>
                  <option value="uppercase">Uppercase</option>
                  <option value="lowercase">Lowercase</option>
                  <option value="trim">Trim</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id={`required-${mapping.db_column}`}
                  checked={mapping.is_required}
                  onChange={(e) => handleFieldChange('is_required', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor={`required-${mapping.db_column}`}
                  className="ml-2 text-xs font-medium text-gray-700"
                >
                  Required Field
                </label>
              </div>
            </div>
          </div>

          {/* External Source Config */}
          {mapping.source_type === 'external_source' && (
            <div className="pt-4 border-t border-gray-200">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                External Source Configuration
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Source Type</label>
                  <input
                    type="text"
                    value={mapping.source_config?.type || ''}
                    onChange={(e) =>
                      handleFieldChange('source_config', {
                        ...(mapping.source_config || {}),
                        type: e.target.value,
                      })
                    }
                    placeholder="e.g., process_group"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Field</label>
                  <input
                    type="text"
                    value={mapping.source_config?.field || ''}
                    onChange={(e) =>
                      handleFieldChange('source_config', {
                        ...(mapping.source_config || {}),
                        field: e.target.value,
                      })
                    }
                    placeholder="e.g., resource_code"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={mapping.description || ''}
              onChange={(e) => handleFieldChange('description', e.target.value || undefined)}
              placeholder="Optional description..."
              rows={2}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}
