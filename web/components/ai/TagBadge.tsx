'use client';

import { cn } from '@/lib/utils';
import type { TagCategory } from '@/types';

interface TagBadgeProps {
  tag: string;
  category: TagCategory;
  confidence?: number | null;
  showConfidence?: boolean;
  size?: 'sm' | 'md';
}

const categoryColors: Record<TagCategory, string> = {
  person: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  place: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  object: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  event: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

export function TagBadge({
  tag,
  category,
  confidence,
  showConfidence = false,
  size = 'sm',
}: TagBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        categoryColors[category],
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      )}
    >
      {tag}
      {showConfidence && confidence != null && (
        <span className="ml-1 opacity-70">({Math.round(confidence * 100)}%)</span>
      )}
    </span>
  );
}
