import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ReminderOffsetsInputProps {
  value: number[];
  onChange: (offsets: number[]) => void;
  error?: string;
}

export function ReminderOffsetsInput({ value, onChange, error }: ReminderOffsetsInputProps) {
  const [inputVal, setInputVal] = useState('');
  const [inputError, setInputError] = useState('');

  function addOffset() {
    const n = parseInt(inputVal.trim(), 10);
    if (isNaN(n) || n <= 0) {
      setInputError('Enter a positive integer.');
      return;
    }
    if (n > 1440) {
      setInputError('Max 1440 minutes (24h).');
      return;
    }
    if (value.includes(n)) {
      setInputError('Offset already added.');
      return;
    }
    onChange([...value, n].sort((a, b) => b - a));
    setInputVal('');
    setInputError('');
  }

  function removeOffset(offset: number) {
    onChange(value.filter(o => o !== offset));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addOffset();
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          type="number"
          min={1}
          max={1440}
          value={inputVal}
          onChange={e => { setInputVal(e.target.value); setInputError(''); }}
          onKeyDown={handleKeyDown}
          placeholder="e.g. 60"
          className="w-32"
        />
        <Button type="button" variant="outline" size="sm" onClick={addOffset}>
          Add
        </Button>
      </div>

      {(inputError || error) && (
        <p className="text-xs text-rose-600">{inputError || error}</p>
      )}

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(offset => (
            <span
              key={offset}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
            >
              {offset} min
              <button
                type="button"
                onClick={() => removeOffset(offset)}
                className="hover:text-indigo-900 ml-0.5"
                aria-label={`Remove ${offset} minute reminder`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {value.length === 0 && (
        <p className="text-xs text-muted-foreground/70">No reminder offsets added. Enter minutes before deadline.</p>
      )}
    </div>
  );
}
