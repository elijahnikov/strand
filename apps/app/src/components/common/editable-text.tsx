import { cn } from "@strand/ui";
import { useCallback, useEffect, useRef, useState } from "react";

interface EditableTextProps {
  className?: string;
  inputClassName?: string;
  onClick?: () => void;
  onSave: (value: string) => void;
  value: string;
}

export function EditableText({
  value,
  onSave,
  onClick,
  className,
  inputClassName,
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleClick = useCallback(() => {
    if (clickTimer.current) {
      return;
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      onClick?.();
    }, 200);
  }, [onClick]);

  const handleDoubleClick = useCallback(() => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    setIsEditing(true);
  }, []);

  if (isEditing) {
    return (
      <input
        autoComplete="off"
        className={cn(
          "relative z-20 m-0 w-full truncate border-none bg-transparent p-0 outline-none",
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
        "relative z-20 cursor-text truncate border-none bg-transparent p-0 text-left",
        className
      )}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      type="button"
    >
      {value}
    </button>
  );
}
