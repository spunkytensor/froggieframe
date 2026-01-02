'use client';

import { cn } from '@/lib/utils';
import type { Mood } from '@/types';
import { 
  CloudSun, 
  Moon, 
  Sparkles, 
  Coffee, 
  Zap, 
  Circle 
} from 'lucide-react';

interface MoodIndicatorProps {
  mood: Mood;
  confidence?: number | null;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const moodConfig: Record<Mood, { icon: typeof CloudSun; color: string; label: string }> = {
  calmer: {
    icon: CloudSun,
    color: 'text-sky-500',
    label: 'Calmer',
  },
  darker: {
    icon: Moon,
    color: 'text-slate-500',
    label: 'Darker',
  },
  vibrant: {
    icon: Sparkles,
    color: 'text-pink-500',
    label: 'Vibrant',
  },
  relaxing: {
    icon: Coffee,
    color: 'text-amber-500',
    label: 'Relaxing',
  },
  energetic: {
    icon: Zap,
    color: 'text-orange-500',
    label: 'Energetic',
  },
  neutral: {
    icon: Circle,
    color: 'text-gray-500',
    label: 'Neutral',
  },
};

const sizeClasses = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export function MoodIndicator({
  mood,
  confidence,
  showLabel = true,
  size = 'md',
}: MoodIndicatorProps) {
  const config = moodConfig[mood];
  const Icon = config.icon;

  return (
    <span className={cn('inline-flex items-center gap-1', config.color)}>
      <Icon className={sizeClasses[size]} />
      {showLabel && (
        <span className="text-sm font-medium">
          {config.label}
          {confidence != null && (
            <span className="ml-1 opacity-70 text-xs">
              ({Math.round(confidence * 100)}%)
            </span>
          )}
        </span>
      )}
    </span>
  );
}
