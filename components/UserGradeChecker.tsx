'use client';

import { useUser } from '@/contexts/UserContext';
import UpdateProfileModal from './UpdateProfileModal';

export default function UserGradeChecker() {
  const { user, loading, needsUpdate, refreshUser } = useUser();

  const handleSuccess = () => {
    refreshUser();
  };

  // Only show modal when not loading and needs update
  const shouldShowModal = !loading && needsUpdate;

  if (!shouldShowModal) {
    return null;
  }

  return (
    <UpdateProfileModal
      isOpen={shouldShowModal}
      onClose={() => {}} // Modal cannot be closed manually
      onSuccess={handleSuccess}
      currentGradeId={user?.gradeId || null}
      currentLevel={user?.level || null}
      currentDisplayName={user?.displayName || null}
    />
  );
}

