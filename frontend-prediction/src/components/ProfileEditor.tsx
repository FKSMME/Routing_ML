import { useState, useEffect } from 'react';
import { Save, X, Search, Filter } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { MappingRuleEditor } from './MappingRuleEditor';
import type { DataMappingProfile, DataMappingRule } from '../types';

interface ProfileEditorProps {
  profile: DataMappingProfile;
  onSave: (updatedProfile: DataMappingProfile) => void;
  onCancel: () => void;
}

export function ProfileEditor({ profile, onSave, onCancel }: ProfileEditorProps) {
  const [mappings, setMappings] = useState<DataMappingRule[]>(profile.mappings || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('all');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredMappings = mappings.filter((mapping) => {
    const matchesSearch =
      searchTerm === '' ||
      mapping.db_column.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mapping.routing_field.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (mapping.display_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());

    const matchesFilter =
      sourceTypeFilter === 'all' || mapping.source_type === sourceTypeFilter;

    return matchesSearch && matchesFilter;
  });

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await apiClient.patch(`/api/data-mapping/profiles/${profile.id}`, {
        mappings,
      });

      onSave(response.data);
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      setError(err.response?.data?.detail || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateMapping = (index: number, updatedMapping: DataMappingRule) => {
    const newMappings = [...mappings];
    newMappings[index] = updatedMapping;
    setMappings(newMappings);
  };

  const sourceTypeCounts = {
    all: mappings.length,
    ml_prediction: mappings.filter((m) => m.source_type === 'ml_prediction').length,
    admin_input: mappings.filter((m) => m.source_type === 'admin_input').length,
    external_source: mappings.filter((m) => m.source_type === 'external_source').length,
    constant: mappings.filter((m) => m.source_type === 'constant').length,
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{profile.name}</h2>
          {profile.description && (
            <p className="text-sm text-gray-600 mt-1">{profile.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            <X size={18} />
            Cancel
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search
            size={20}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by field name, db column, or display name..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Source Type Filter */}
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filter by source:</span>
          <div className="flex gap-2">
            {[
              { value: 'all', label: 'All', color: 'gray' },
              { value: 'ml_prediction', label: 'ML Prediction', color: 'blue' },
              { value: 'admin_input', label: 'Admin Input', color: 'green' },
              { value: 'external_source', label: 'External Source', color: 'purple' },
              { value: 'constant', label: 'Constant', color: 'yellow' },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setSourceTypeFilter(filter.value)}
                className={`
                  px-3 py-1 rounded-lg text-sm font-medium transition-colors
                  ${
                    sourceTypeFilter === filter.value
                      ? `bg-${filter.color}-100 text-${filter.color}-700 border-${filter.color}-300 border`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }
                `}
              >
                {filter.label} ({sourceTypeCounts[filter.value as keyof typeof sourceTypeCounts]})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-5 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Total Fields:</span>
            <span className="ml-2 font-semibold text-gray-900">{mappings.length}</span>
          </div>
          <div>
            <span className="text-gray-600">ML Prediction:</span>
            <span className="ml-2 font-semibold text-blue-600">
              {sourceTypeCounts.ml_prediction}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Admin Input:</span>
            <span className="ml-2 font-semibold text-green-600">
              {sourceTypeCounts.admin_input}
            </span>
          </div>
          <div>
            <span className="text-gray-600">External Source:</span>
            <span className="ml-2 font-semibold text-purple-600">
              {sourceTypeCounts.external_source}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Constant:</span>
            <span className="ml-2 font-semibold text-yellow-600">
              {sourceTypeCounts.constant}
            </span>
          </div>
        </div>
      </div>

      {/* Mapping Rules List */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {filteredMappings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No fields match your search criteria.
          </div>
        ) : (
          filteredMappings.map((mapping, index) => {
            const originalIndex = mappings.findIndex(
              (m) => m.db_column === mapping.db_column && m.routing_field === mapping.routing_field
            );
            return (
              <MappingRuleEditor
                key={`${mapping.db_column}-${mapping.routing_field}-${index}`}
                mapping={mapping}
                onUpdate={(updated) => handleUpdateMapping(originalIndex, updated)}
              />
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-6 pt-4 border-t border-gray-200 text-sm text-gray-600">
        <p>
          Showing {filteredMappings.length} of {mappings.length} fields
        </p>
      </div>
    </div>
  );
}
