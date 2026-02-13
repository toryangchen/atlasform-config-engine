import React, { useMemo, useState } from "react";
import { Input, Select } from "antd";

export const StringArrayField: React.FC<{
  value?: string[];
  onChange?: (value: string[]) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => {
  return (
    <Select
      mode="tags"
      style={{ width: "100%" }}
      placeholder={placeholder ?? "Input and press Enter"}
      value={value ?? []}
      onChange={(v) => onChange?.(v)}
    />
  );
};

export const JsonObjectField: React.FC<{
  value?: Record<string, unknown>;
  onChange?: (value: Record<string, unknown>) => void;
}> = ({ value, onChange }) => {
  const initial = useMemo(() => JSON.stringify(value ?? {}, null, 2), [value]);
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string>("");

  return (
    <>
      <Input.TextArea
        autoSize={{ minRows: 5, maxRows: 10 }}
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          try {
            const parsed = JSON.parse(next || "{}");
            if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
              setError("Must be a JSON object");
              return;
            }
            setError("");
            onChange?.(parsed as Record<string, unknown>);
          } catch {
            setError("Invalid JSON");
          }
        }}
      />
      {error ? <div style={{ color: "#ff4d4f", marginTop: 8 }}>{error}</div> : null}
    </>
  );
};

export const JsonArrayObjectField: React.FC<{
  value?: Array<Record<string, unknown>>;
  onChange?: (value: Array<Record<string, unknown>>) => void;
}> = ({ value, onChange }) => {
  const initial = useMemo(() => JSON.stringify(value ?? [], null, 2), [value]);
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string>("");

  return (
    <>
      <Input.TextArea
        autoSize={{ minRows: 6, maxRows: 14 }}
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          try {
            const parsed = JSON.parse(next || "[]");
            if (!Array.isArray(parsed) || parsed.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
              setError("Must be JSON array<object>");
              return;
            }
            setError("");
            onChange?.(parsed as Array<Record<string, unknown>>);
          } catch {
            setError("Invalid JSON");
          }
        }}
      />
      {error ? <div style={{ color: "#ff4d4f", marginTop: 8 }}>{error}</div> : null}
    </>
  );
};
