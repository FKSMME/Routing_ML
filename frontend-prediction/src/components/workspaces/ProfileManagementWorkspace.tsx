import { useState } from 'react';
import { ProfileManagement } from '../ProfileManagement';
import { ProfileEditor } from '../ProfileEditor';
import type { DataMappingProfile } from '../../types/routing';

export function ProfileManagementWorkspace() {
  const [selectedProfile, setSelectedProfile] = useState<DataMappingProfile | null>(null);
  const [editingProfile, setEditingProfile] = useState<DataMappingProfile | null>(null);

  const handleSelectProfile = (profile: DataMappingProfile) => {
    setSelectedProfile(profile);
    setEditingProfile(profile);
  };

  const handleSaveProfile = (updatedProfile: DataMappingProfile) => {
    setSelectedProfile(updatedProfile);
    setEditingProfile(null);
    // Refresh the profile list
    window.location.reload();
  };

  const handleCancelEdit = () => {
    setEditingProfile(null);
  };

  return (
    <div className="h-full flex flex-col p-6 gap-6">
      {editingProfile ? (
        <ProfileEditor
          profile={editingProfile}
          onSave={handleSaveProfile}
          onCancel={handleCancelEdit}
        />
      ) : (
        <ProfileManagement
          onSelectProfile={handleSelectProfile}
          selectedProfileId={selectedProfile?.id}
        />
      )}
    </div>
  );
}
