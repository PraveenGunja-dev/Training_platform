import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usersApi } from '@/api/users';

interface Props {
  photoUrl: string | null | undefined;
  fallback: string;
  className?: string;
  fallbackClassName?: string;
  fallbackStyle?: React.CSSProperties;
  imageClassName?: string;
}

export function AuthenticatedAvatar({
  photoUrl,
  fallback,
  className,
  fallbackClassName,
  fallbackStyle,
  imageClassName,
}: Props) {
  const [blobSrc, setBlobSrc] = useState<string | undefined>();

  useEffect(() => {
    if (!photoUrl) return;
    // Local blob URLs (e.g., from file upload preview) are already accessible
    if (photoUrl.startsWith('blob:')) {
      setBlobSrc(photoUrl);
      return;
    }
    let objectUrl: string;
    const pk = photoUrl.replace(/.*\/users\/([^/]+)\/photo.*/, '$1');
    usersApi.getPhoto(pk)
      .then(url => { objectUrl = url; setBlobSrc(url); })
      .catch(() => setBlobSrc(undefined));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [photoUrl]);

  return (
    <Avatar className={className}>
      <AvatarImage src={blobSrc} className={imageClassName} />
      <AvatarFallback className={fallbackClassName} style={fallbackStyle}>
        {fallback}
      </AvatarFallback>
    </Avatar>
  );
}
