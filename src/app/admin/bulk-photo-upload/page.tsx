'use client';

import PageShell from '@/components/PageShell';
import AdminNav from '@/components/admin/AdminNav';
import BulkPhotoUploadPanel from '@/components/admin/BulkPhotoUploadPanel';

export default function AdminBulkPhotoUploadPage() {
  return (
    <PageShell
      title="Bulk Photo Upload"
      subtitle="Drag and drop admin uploads — unpublished, rights hold by default (#4709)"
    >
      <AdminNav />
      <BulkPhotoUploadPanel />
    </PageShell>
  );
}
