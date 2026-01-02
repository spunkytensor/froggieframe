'use client';

import { cn } from '@/lib/utils';
import type { AIStatus } from '@/types';
import { Loader2, Check, AlertCircle, Clock } from 'lucide-react';

interface AIStatusBadgeProps {
  status: AIStatus;
  error?: string | null;
  onRetry?: () => void;
  size?: 'sm' | 'md';
}

export function AIStatusBadge({
  status,
  error,
  onRetry,
  size = 'sm',
}: AIStatusBadgeProps) {
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  if (status === 'complete') {
    return null;
  }

  if (status === 'pending') {
    return (
      <span className={cn('inline-flex items-center gap-1 text-muted-foreground', textSize)}>
        <Clock className={iconSize} />
        <span>Pending</span>
      </span>
    );
  }

  if (status === 'processing') {
    return (
      <span className={cn('inline-flex items-center gap-1 text-blue-500', textSize)}>
        <Loader2 className={cn(iconSize, 'animate-spin')} />
        <span>Analyzing...</span>
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span className={cn('inline-flex items-center gap-1', textSize)}>
        <span className="inline-flex items-center gap-1 text-destructive">
          <AlertCircle className={iconSize} />
          <span>Analysis failed</span>
        </span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-1 text-primary hover:underline"
          >
            Retry
          </button>
        )}
      </span>
    );
  }

  return null;
}
