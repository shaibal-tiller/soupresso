'use client';

import { useState, useRef, useEffect } from 'react';
import { parseLocaleNumber, formatNumber } from '@/lib/numerals';
import { useLang } from './LangProvider';

function seed(value) {
  if (value == null || value === '') return '';
  return String(value);
}

export default function NumberInput({
  value,
  onValueChange,
  placeholder,
  min,
  autoFocus,
  className,
  id,
  disabled,
  ...rest
}) {
  const { lang } = useLang();
  const [text, setText] = useState(() => seed(value));
  const lastExternal = useRef(value);

  // Re-seed when a parent resets the value (e.g. form clear, day switch).
  useEffect(() => {
    if (value !== lastExternal.current) {
      lastExternal.current = value;
      setText(seed(value));
    }
  }, [value]);

  const parsed = parseLocaleNumber(text);
  const invalid = text.trim() !== '' && (parsed == null || (min != null && parsed < Number(min)));

  function handleChange(next) {
    setText(next);
    onValueChange(parseLocaleNumber(next), next);
  }

  function handleBlur() {
    if (parsed != null) setText(formatNumber(parsed, lang));
  }

  return (
    <input
      {...rest}
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      autoFocus={autoFocus}
      disabled={disabled}
      className={className}
      placeholder={placeholder}
      value={text}
      aria-invalid={invalid || undefined}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
    />
  );
}
