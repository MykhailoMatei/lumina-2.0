import React, { useState, useEffect } from 'react';
import { getJournalImageSignedUrl } from '../services/storageService';

interface Props {
  src?: string;
  alt?: string;
  className?: string;
}

export const JournalImage: React.FC<Props> = ({ src, alt = 'Journal image', className = '' }) => {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setResolvedSrc(null);
      return;
    }
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      setResolvedSrc(src);
      return;
    }
    let isCurrent = true;
    getJournalImageSignedUrl(src).then(signed => {
      if (isCurrent) setResolvedSrc(signed);
    });
    return () => {
      isCurrent = false;
    };
  }, [src]);

  if (!resolvedSrc) {
    return <div className={`bg-slate-100 dark:bg-slate-800 animate-pulse ${className}`} />;
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      loading="lazy"
      onError={(e) => {
        (e.target as HTMLElement).style.display = 'none';
      }}
    />
  );
};
