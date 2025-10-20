import { Edit2, Plus, Save, Trash2, X } from 'lucide-react';
import { useEffect,useState } from 'react';

import apiClient from '../lib/apiClient';
import type { DataMappingProfile } from '../types';

interface ProfileManagementProps {
  onSelectProfile?: (profile: DataMappingProfile) => void;
  selectedProfileId?: string;
}

export function ProfileManagement({ onSelectProfile, selectedProfileId }: ProfileManagementProps) {
  const [profiles, setProfiles] = useState<DataMappingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDesc, setNewProfileDesc] = useState('');

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/data-mapping/profiles');
      setProfiles(response.data.profiles || []);
    } catch (err) {
      console.error('Failed to load profiles:', err);
      setError('Failed to load profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) {
      setError('Profile name is required');
      return;
    }

    try {
      setError(null);
      const response = await apiClient.post('/data-mapping/profiles', {
        name: newProfileName.trim(),
        description: newProfileDesc.trim() || undefined,
        mappings: [], // Empty mappings, will be edited later
      });

      setProfiles([response.data, ...profiles]);
      setIsCreating(false);
      setNewProfileName('');
      setNewProfileDesc('');

      // Automatically select the newly created profile
      if (onSelectProfile) {
        onSelectProfile(response.data);
      }
    } catch (err: any) {
      console.error('Failed to create profile:', err);
      setError(err.response?.data?.detail || 'Failed to create profile');
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm('Are you sure you want to delete this profile?')) {
      return;
    }

    try {
      await apiClient.delete(`/data-mapping/profiles/${profileId}`);
      setProfiles(profiles.filter((p) => p.id !== profileId));
    } catch (err: any) {
      console.error('Failed to delete profile:', err);
      setError(err.response?.data?.detail || 'Failed to delete profile');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading profiles...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Data Mapping Profiles</h2>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            New Profile
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Create Profile Form */}
      {isCreating && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Profile</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Profile Name *
              </label>
              <input
                type="text"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder="e.g., FKSM Production Profile"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={newProfileDesc}
                onChange={(e) => setNewProfileDesc(e.target.value)}
                placeholder="Optional description..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateProfile}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save size={18} />
                Create
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewProfileName('');
                  setNewProfileDesc('');
                  setError(null);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                <X size={18} />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile List */}
      <div className="space-y-3">
        {profiles.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No profiles found. Create one to get started.
          </div>
        ) : (
          profiles.map((profile) => (
            <div
              key={profile.id}
              className={`
                p-4 border rounded-lg transition-all cursor-pointer
                ${
                  selectedProfileId === profile.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }
              `}
              onClick={() => onSelectProfile?.(profile)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{profile.name}</h3>
                  {profile.description && (
                    <p className="text-sm text-gray-600 mt-1">{profile.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>{profile.mappings.length} fields</span>
                    <span>Created: {new Date(profile.created_at).toLocaleDateString()}</span>
                    {!profile.is_active && (
                      <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectProfile?.(profile);
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                    title="Edit profile"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProfile(profile.id);
                    }}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                    title="Delete profile"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
