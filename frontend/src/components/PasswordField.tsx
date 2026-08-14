import { useState } from 'react';

const iconCommon = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  width: 18,
  height: 18,
};

function IconEye() {
  return (
    <svg {...iconCommon}>
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg {...iconCommon}>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c7 0 10.5 7 10.5 7a13.2 13.2 0 0 1-3.1 4.1M6.5 6.6C3.4 8.5 1.5 12 1.5 12S5 19 12 19a10.6 10.6 0 0 0 4.2-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
}

/** A password `<input>` with a show/hide toggle — used anywhere a password is
 * typed in (login, change-password), never for the read-only fields showing
 * an already-generated temporary password. */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  minLength,
  required,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="field">
      <span>{label}</span>
      <div className="password-field">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          minLength={minLength}
          required={required}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {visible ? <IconEyeOff /> : <IconEye />}
        </button>
      </div>
    </label>
  );
}
