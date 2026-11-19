"use client";
import { DDIS, TelValue } from "@/lib/ddi";

/** Seletor de indicativo (+ opção Outro) à esquerda e número local à direita, lado a lado. */
export function DdiSelect({ value, onChange, style }: { value: TelValue; onChange: (v: TelValue) => void; style?: React.CSSProperties }) {
  return (
    <>
      <select aria-label="Indicativo do país" value={value.ddi} style={{ flex: "0 0 auto", width: value.ddi === "outro" ? 96 : 138, ...style }}
        onChange={(e) => onChange({ ...value, ddi: e.target.value })}>
        {DDIS.map((d) => <option key={d.code} value={d.code}>+{d.code} ({d.iso})</option>)}
        <option value="outro">Outro</option>
      </select>
      {value.ddi === "outro" && (
        <input className="input" aria-label="Indicativo (outro país)" inputMode="numeric" placeholder="+ código" maxLength={5}
          style={{ flex: "0 0 86px", width: 86 }} value={value.outro ? "+" + value.outro.replace(/\D/g, "") : ""}
          onChange={(e) => onChange({ ...value, outro: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
      )}
    </>
  );
}

export default function TelefoneInput({ label, value, onChange, placeholder = "955 123 456" }: {
  label: string; value: TelValue; onChange: (v: TelValue) => void; placeholder?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="row" style={{ alignItems: "stretch", gap: 8 }}>
        <DdiSelect value={value} onChange={onChange} />
        <input className="input" style={{ flex: 1, minWidth: 0 }} type="tel" inputMode="tel" autoComplete="tel-national" required
          placeholder={placeholder} value={value.numero} onChange={(e) => onChange({ ...value, numero: e.target.value })} />
      </div>
    </div>
  );
}
