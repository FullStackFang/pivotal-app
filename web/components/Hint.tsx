"use client";
import { useEffect, useId, useRef, useState } from "react";

interface HintProps {
  text: string;
}

/**
 * Inline "?" trigger that reveals a popover with the field description.
 * Click to pin, click outside or press Escape to dismiss. Hover/focus also opens.
 */
export function Hint({ text }: HintProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (e.target instanceof Node && ref.current.contains(e.target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="hint" ref={ref}>
      <button
        type="button"
        className={`hint-trigger ${open ? "is-on" : ""}`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((s) => !s)}
        onMouseEnter={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          // Keep open when focus shifts inside the popover.
          if (!ref.current?.contains(e.relatedTarget as Node)) setOpen(false);
        }}
      >
        ?
      </button>
      {open && (
        <span role="tooltip" id={id} className="hint-pop">
          {text}
        </span>
      )}
    </span>
  );
}
