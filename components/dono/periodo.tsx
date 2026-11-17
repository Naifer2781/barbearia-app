"use client";
import { useMemo, useState } from "react";
import { addDays, hojeISO, parseISO, toISO } from "@/lib/utils";
import { Field } from "../ui";

export type Per = "hoje" | "semana" | "mes" | "mesant" | "custom";

export function usePeriodo(inicial: Per = "mes") {
  const [per, setPer] = useState<Per>(inicial);
  const [cDe, setCDe] = useState(hojeISO());
  const [cAte, setCAte] = useState(hojeISO());
  const { de, ate } = useMemo(() => {
    const h = hojeISO(); const d = parseISO(h);
    if (per === "hoje") return { de: h, ate: h };
    if (per === "semana") { const dow = (d.getDay() + 6) % 7; return { de: addDays(h, -dow), ate: addDays(h, 6 - dow) }; }
    if (per === "mes") return { de: toISO(new Date(d.getFullYear(), d.getMonth(), 1)), ate: toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
    if (per === "mesant") return { de: toISO(new Date(d.getFullYear(), d.getMonth() - 1, 1)), ate: toISO(new Date(d.getFullYear(), d.getMonth(), 0)) };
    return { de: cDe, ate: cAte };
  }, [per, cDe, cAte]);
  return { per, setPer, de, ate, cDe, setCDe, cAte, setCAte };
}

export function SeletorPeriodo({ p }: { p: ReturnType<typeof usePeriodo> }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="tabs" style={{ paddingTop: 0 }}>
        {([["hoje", "Hoje"], ["semana", "Semana"], ["mes", "Este mês"], ["mesant", "Mês passado"], ["custom", "Datas…"]] as const).map(([k, l]) => (
          <button key={k} className={"tab" + (p.per === k ? " on" : "")} onClick={() => p.setPer(k)}>{l}</button>
        ))}
      </div>
      {p.per === "custom" && (
        <div className="row">
          <Field label="De"><input className="input" type="date" value={p.cDe} onChange={(e) => p.setCDe(e.target.value)} /></Field>
          <Field label="Até"><input className="input" type="date" value={p.cAte} onChange={(e) => p.setCAte(e.target.value)} /></Field>
        </div>
      )}
    </div>
  );
}
