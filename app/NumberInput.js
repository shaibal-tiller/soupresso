'use client';

import { useState, useEffect } from 'react';
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

  // Re-seed local text only when the incoming value differs from what the
  // field already represents — i.e. a genuine external change (day switch,
  // form reset), not the echo of the user's own keystroke.
  useEffect(() => {
    const incoming = value == null || value === '' ? null : Number(value);
    const shown = parseLocaleNumber(text);
    if (incoming !== shown) {
      setText(seed(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
