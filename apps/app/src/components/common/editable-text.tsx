import { cn } from "@strand/ui";
import { useCallback, useEffect, useRef, useState } from "react";

interface EditableTextProps {
  className?: string;
  inputClassName?: string;
  onSave: (value: string) => void;
  value: string;
}

export function EditableText({
  value,
  onSave,
  className,
  inputClassName,
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
      // Don't setIsEditing(false) here — the parent will unmount us
      // and replace with a shimmer/pending state. Exiting edit mode
      // before that causes a flash of the old value.
    } else {
      setEditValue(value);
      setIsEditing(false);
    }
  }, [editValue, value, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setEditValue(value);
        setIsEditing(false);
      }
    },
    [handleSave, value]
  );

  if (isEditing) {
    return (
      <input
        autoComplete="off"
        className={cn(
          "m-0 w-full truncate border-none bg-transparent p-0 outline-none",
          inputClassName ?? className
        )}
        onBlur={handleSave}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        ref={inputRef}
        spellCheck={false}
        type="text"
        value={editValue}
      />
    );
  }

  return (
    <button
      className={cn(
        "cursor-text truncate border-none bg-transparent p-0 text-left",
        className
      )}
      onClick={() => setIsEditing(true)}
      type="button"
    >
      {value}
    </button>
  );
}
