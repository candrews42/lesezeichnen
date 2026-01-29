'use client';

import { Reflection } from '@/lib/supabase';

interface ReflectionListProps {
  reflections: Reflection[];
  compact?: boolean;
}

export function ReflectionList({ reflections, compact = false }: ReflectionListProps) {
  if (!reflections || reflections.length === 0) {
    return (
      <p className="text-gray-500 italic">No reflections yet.</p>
    );
  }

  const sorted = [...reflections].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const displayReflections = compact ? sorted.slice(0, 3) : sorted;

  return (
    <div className="space-y-3">
      {displayReflections.map((reflection) => {
        const date = new Date(reflection.created_at);
        const formattedDate = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
        });

        const typeIcon = {
          text: '📝',
          voice_transcript: '🎙️',
          drawing_note: '🎨',
        }[reflection.content_type] || '📝';

        return (
          <div key={reflection.id} className="border-l-2 border-amber-600/50 pl-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <span>{typeIcon}</span>
              <span>{formattedDate}</span>
            </div>
            <p className={`text-gray-300 ${compact ? 'line-clamp-2' : ''}`}>
              &quot;{reflection.content}&quot;
            </p>
          </div>
        );
      })}
      {compact && reflections.length > 3 && (
        <p className="text-xs text-gray-500">
          +{reflections.length - 3} more reflections
        </p>
      )}
    </div>
  );
}
