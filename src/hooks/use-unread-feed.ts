'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/auth-client';
import { getUnreadFeedCount } from '@/app/actions/posts';

export function useUnreadFeed() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    const fetchCount = async () => {
      try {
        const token = await getAuthToken();
        if (!token) return;
        const result = await getUnreadFeedCount(token);
        if (mounted && result.count > 0) {
          setCount(result.count);
        }
      } catch {
        // silently fail — badge is non-critical
      }
    };

    fetchCount();

    return () => { mounted = false; };
  }, []);

  const resetCount = () => setCount(0);

  return { count, resetCount };
}
