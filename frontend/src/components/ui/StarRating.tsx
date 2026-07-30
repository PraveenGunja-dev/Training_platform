import { useState } from 'react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number;
  onChange?: (val: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
} as const;

const GAP_MAP = {
  sm: 'gap-0.5',
  md: 'gap-1',
  lg: 'gap-1.5',
} as const;

function StarSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('shrink-0', className)} aria-hidden="true">
      <polygon
        points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function StarRating({ value, onChange, readOnly = false, size = 'md' }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const displayValue = hoverValue ?? value;
  const sizeClass = SIZE_MAP[size];
  const gapClass = GAP_MAP[size];

  return (
    <div
      className={cn('flex items-center', gapClass)}
      onMouseLeave={() => !readOnly && setHoverValue(null)}
      role={readOnly ? undefined : 'radiogroup'}
      aria-label={readOnly ? `Rating: ${value} out of 5` : 'Rating'}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fill: 'full' | 'half' | 'empty' =
          displayValue >= star ? 'full' : displayValue >= star - 0.5 ? 'half' : 'empty';

        return (
          <div key={star} className={cn('relative', sizeClass)}>
            {/* Base layer — always a gray outline star */}
            <StarSvg
              className={cn(sizeClass, 'absolute inset-0 fill-transparent stroke-gray-300')}
            />

            {/* Amber layer — full star for 'full', left-half only for 'half'.
                clip-path inset(0 50% 0 0) hides the right 50%, revealing only
                the left half of the amber star over the gray base. */}
            {fill !== 'empty' && (
              <div
                className={cn('absolute inset-0', sizeClass)}
                style={fill === 'half' ? { clipPath: 'inset(0 50% 0 0)' } : undefined}
              >
                <StarSvg className={cn(sizeClass, 'fill-amber-400 stroke-amber-400')} />
              </div>
            )}

            {/* Invisible click / hover zones split at the star's midpoint */}
            {!readOnly && (
              <>
                <button
                  type="button"
                  className="absolute inset-y-0 left-0 w-1/2 focus:outline-none"
                  aria-label={`${star - 0.5} stars`}
                  onMouseEnter={() => setHoverValue(star - 0.5)}
                  onClick={() => onChange?.(star - 0.5)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 w-1/2 focus:outline-none"
                  aria-label={`${star} stars`}
                  onMouseEnter={() => setHoverValue(star)}
                  onClick={() => onChange?.(star)}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
