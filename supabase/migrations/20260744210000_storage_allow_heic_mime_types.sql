-- Allow HEIC uploads as a fallback (iOS camera/library). Client prefers JPEG via image picker + MIME normalize.

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif'
]
where id = 'job-photos';

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf'
]
where id = 'technician-documents';
