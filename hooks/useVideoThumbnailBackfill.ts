import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Post } from '@/types';
import { getPostPreviewURL, needsVideoThumbnailRegen } from '@/utils/posts';
import { scheduleVideoThumbnailBackfill } from '@/services/firebase/videoThumbnails';

export function useVideoThumbnailBackfill(post: Post): string {
  const queryClient = useQueryClient();
  const [previewURL, setPreviewURL] = useState(() => getPostPreviewURL(post));

  useEffect(() => {
    setPreviewURL(getPostPreviewURL(post));
  }, [post.imageURL]);

  useEffect(() => {
    if (!needsVideoThumbnailRegen(post)) return;

    let cancelled = false;

    void scheduleVideoThumbnailBackfill(post).then((imageURL) => {
      if (cancelled || !imageURL) return;

      setPreviewURL(imageURL);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['post', post.id] });
      queryClient.invalidateQueries({ queryKey: ['myPosts'] });
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
    });

    return () => {
      cancelled = true;
    };
  }, [post.id, post.imageURL, post.videoURL, post.mediaType, queryClient]);

  return previewURL;
}
