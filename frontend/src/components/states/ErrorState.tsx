import { AlertCircle } from 'lucide-react';
import { MotionButton } from '@/components/motion/MotionButton';

type Props = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  errorCode?: string;
};

export function ErrorState({
  title = 'Something went wrong',
  description = 'Failed to load data. Please try again.',
  onRetry,
  errorCode,
}: Props) {
  return (
    <div
      className="flex flex-col items-center justify-center p-12 text-center"
      role="alert"
      aria-live="polite"
    >
      <div className="mb-4 rounded-full bg-rose-500/10 p-4 border border-rose-500/20">
        <AlertCircle className="h-8 w-8 text-rose-400" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      {errorCode && (
        <p className="mt-2 font-mono text-xs text-foreground/50">{errorCode}</p>
      )}
      {onRetry && (
        <MotionButton
          onClick={onRetry}
          variant="outline"
          size="sm"
          className="mt-4 hover:shadow-glow transition-shadow"
        >
          Try again
        </MotionButton>
      )}
    </div>
  );
}
