"use client";

import { useState, type CSSProperties } from "react";
import { Icon, type IconName } from "./Icon";

export type InputProps = {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  icon?: IconName;
  type?: string;
  name?: string;
  id?: string;
  variant?: "standalone" | "attached";
  tone?: "light" | "transparent";
  disabled?: boolean;
  style?: CSSProperties;
  inputStyle?: CSSProperties;
};

/** Pill text field. `variant="attached"` shares one pill with a trailing button. */
export function Input({
  value,
  onChange,
  placeholder = "",
  icon,
  type = "text",
  name,
  id,
  variant = "standalone",
  tone = "light",
  disabled = false,
  style,
  inputStyle,
}: InputProps) {
  const [focus, setFocus] = useState(false);
  const bordered = variant === "standalone";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: bordered ? "13px 20px" : "0 4px 0 20px",
        background: tone === "light" ? "var(--ink-000)" : "transparent",
        border: bordered
          ? `1px solid ${focus ? "var(--border-focus)" : "var(--border-strong)"}`
          : "none",
        borderRadius: "var(--radius-control)",
        flex: 1,
        minWidth: 0,
        transition: "var(--transition-control)",
        ...style,
      }}
    >
      {icon ? <Icon name={icon} size={16} strokeAlpha={0.45} /> : null}
      <input
        type={type}
        name={name}
        id={id}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={onChange}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          flex: 1,
          minWidth: 0,
          border: "none",
          outline: "none",
          background: "transparent",
          font: "var(--type-body-sm)",
          color: "var(--text-primary)",
          padding: bordered ? 0 : "15px 0",
          ...inputStyle,
        }}
      />
    </div>
  );
}
