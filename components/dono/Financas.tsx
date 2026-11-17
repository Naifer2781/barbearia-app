"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtime } from "@/lib/hooks";
import type { Barbeiro, Despesa, Marcacao } from "@/lib/types";
import { eur, hojeISO } from "@/lib/utils";
import { Empty, Field } from "../ui";
import { SeletorPeriodo, usePeriodo } from "./periodo";

const CATEGORIAS = ["Renda", "Produtos", "Salários", "Água/Luz/Internet", "Marketing", "Manutenção", "Outros"];

export default function Financas({ barbeiros, show }: { barbeiros: Barbeiro[]; show: (t: string, e?: boolean) => void }) {
  const p = usePeriodo("mes");
  const [marcs, setMarcs] = useState<Marcacao[]>([]);
  const [desps, setDesps] = useState<Despesa[]>([]);
  const [desc, setDesc] = useState(""); const [valor, setValor] = useState(""); const [cat, setCat] = useState(CATEGORIAS[0]); const [dia, setDia] = useState(hojeISO());

  const carregar = useCallback(async () => {
    const [m, d] = await Promise.all([
      supabase.from("marcacoes").select("*").eq("estado", "concluido").gte("data", p.de).lte("data", p.ate),
      supabase.from("despesas").select("*").gte("data", p.de).lte("data", p.ate).order("data", { ascending: false }),
    ]);
    if (m.data) setMarcs(m.data as Marcacao[]);
    if (d.data) setDesps(d.data as Despesa[]);
  }, [p.de, p.ate]);
  useEffect(() => { carregar(); }, [carregar]);
  useRealtime(["marcacoes", "despesas"], carregar);

  const fat = marcs.reduce((s, m) => s + Number(m.preco), 0);
  const com = marcs.reduce((s, m) => s + Number(m.comissao_valor), 0);
  const dsp = desps.reduce((s, d) => s + Number(d.valor), 0);
  const lucro = fat - com - dsp;

  async function addDespesa() {
    const v = Math.round(parseFloat(valor.replace(/\s/g, "").replace(",", ".")));
    if (!desc.trim() || isNaN(v) || v < 0) return show("Preencha descrição e valor.", true);
    const { error } = await supabase.from("despesas").insert({ descricao: desc.trim(), valor: v, categoria: cat, data: dia });
    if (error) return show(error.message, true);
    setDesc(""); setValor(""); show("Despesa registada"); carregar();
  }
  async function delDespesa(id: string) {
    if (!confirm("Apagar despesa?")) return;
    const { error } = await supabase.from("despesas").delete().eq("id", id);
    if (error) return show(error.message, true);
    carregar();
  }

  return (
    <div>
      <SeletorPeriodo p={p} />
      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="stat"><div className="l">Faturação</div><div className="v">{eur(fat)}</div></div>
        <div className="stat"><div className="l">Comissões</div><div className="v">{eur(com)}</div></div>
        <div className="stat"><div className="l">Despesas</div><div className="v">{eur(dsp)}</div></div>
        <div className="stat" style={{ borderColor: "var(--gold)" }}><div className="l">Lucro</div><div className="v" style={{ color: lucro >= 0 ? "var(--ok)" : "var(--bad)" }}>{eur(lucro)}</div></div>
      </div>

      <h3 style={{ marginBottom: 8 }}>Por barbeiro</h3>
      <div className="card scroll-x" style={{ marginBottom: 20 }}>
        <table className="tbl">
          <thead><tr><th>Barbeiro</th><th>Cortes</th><th>Faturação</th><th>Comissão</th><th>Fica na casa</th></tr></thead>
          <tbody>{barbeiros.map((b) => {
            const l = marcs.filter((m) => m.barbeiro_id === b.id);
            const f = l.reduce((s, m) => s + Number(m.preco), 0), c = l.reduce((s, m) => s + Number(m.comissao_valor), 0);
            return <tr key={b.id}><td>{b.nome}</td><td>{l.length}</td><td>{eur(f)}</td><td>{eur(c)}</td><td className="gold">{eur(f - c)}</td></tr>;
          })}</tbody>
        </table>
      </div>

      <h3 style={{ marginBottom: 8 }}>Despesas</h3>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row wrap" style={{ alignItems: "flex-end" }}>
          <Field label="Descrição"><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
          <Field label="Valor (FCFA)"><input className="input" value={valor} onChange={(e) => setValor(e.target.value)} inputMode="numeric" /></Field>
          <Field label="Categoria"><select value={cat} onChange={(e) => setCat(e.target.value)}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Data"><input className="input" type="date" value={dia} onChange={(e) => setDia(e.target.value)} /></Field>
          <button className="btn gold" style={{ marginBottom: 12 }} onClick={addDespesa}>Adicionar</button>
        </div>
      </div>
      {desps.length === 0 ? <Empty>Sem despesas neste período.</Empty> : (
        <div className="card scroll-x">
          <table className="tbl">
            <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th /></tr></thead>
            <tbody>{desps.map((d) => (
              <tr key={d.id}><td>{d.data.split("-").reverse().join("/")}</td><td>{d.descricao}</td><td>{d.categoria}</td><td>{eur(d.valor)}</td>
                <td><button className="btn bad sm" onClick={() => delDespesa(d.id)}>✕</button></td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
