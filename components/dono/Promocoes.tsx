"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Promocao, Servico } from "@/lib/types";
import { addDays, fmtData, hojeISO } from "@/lib/utils";
import { Empty, Field, Modal } from "../ui";

export default function Promocoes({ promos, servicos, recarregar, show }: { promos: Promocao[]; servicos: Servico[]; recarregar: () => void; show: (t: string, e?: boolean) => void }) {
  const [ed, setEd] = useState<Partial<Promocao> | null>(null);

  async function guardar() {
    if (!ed) return;
    const pct = Number(ed.desconto_pct);
    if (!ed.titulo?.trim() || !(pct > 0 && pct <= 100)) return show("Título e desconto (1–100%) são obrigatórios.", true);
    if (ed.data_inicio && ed.data_fim && ed.data_fim < ed.data_inicio) return show("A data final é anterior à inicial.", true);
    const row = { titulo: ed.titulo.trim(), descricao: ed.descricao || null, desconto_pct: pct, servico_id: ed.servico_id || null, data_inicio: ed.data_inicio || null, data_fim: ed.data_fim || null, ativa: ed.ativa ?? true };
    const { error } = ed.id ? await supabase.from("promocoes").update(row).eq("id", ed.id) : await supabase.from("promocoes").insert(row);
    if (error) return show(error.message, true);
    setEd(null); show("Promoção guardada"); recarregar();
  }
  async function alternar(p: Promocao) {
    const { error } = await supabase.from("promocoes").update({ ativa: !p.ativa }).eq("id", p.id);
    if (error) return show(error.message, true);
    recarregar();
  }
  async function apagar(p: Promocao) {
    if (!confirm("Apagar promoção?")) return;
    const { error } = await supabase.from("promocoes").delete().eq("id", p.id);
    if (error) return show(error.message, true);
    recarregar();
  }
  const hoje = hojeISO();
  const vigente = (p: Promocao) => p.ativa && (!p.data_inicio || p.data_inicio <= hoje) && (!p.data_fim || p.data_fim >= hoje);

  return (
    <div>
      <div className="row between" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Promoções</h2>
        <button className="btn gold" onClick={() => setEd({ titulo: "", desconto_pct: 10, ativa: true, data_inicio: hoje, data_fim: addDays(hoje, 14) })}>＋ Nova promoção</button>
      </div>
      <p className="muted" style={{ marginBottom: 10 }}>As promoções ativas aparecem como banner na app do cliente e o desconto é aplicado automaticamente na marcação.</p>
      {promos.length === 0 ? <Empty>Ainda sem promoções.</Empty> : (
        <div className="col">{promos.map((p) => (
          <div className="card" key={p.id}>
            <div className="row between">
              <b>{p.titulo} <span className="gold">-{Number(p.desconto_pct)}%</span></b>
              <span className={"badge " + (vigente(p) ? "concluido" : "")}>{vigente(p) ? "A decorrer" : p.ativa ? "Agendada/Expirada" : "Desativada"}</span>
            </div>
            <div className="muted">{p.descricao}</div>
            <div className="muted">{p.servico_id ? servicos.find((s) => s.id === p.servico_id)?.nome : "Todos os serviços"} · {p.data_inicio ? fmtData(p.data_inicio) : "sempre"} → {p.data_fim ? fmtData(p.data_fim) : "sem fim"}</div>
            <div className="row wrap" style={{ marginTop: 8 }}>
              <button className="btn sm" onClick={() => setEd(p)}>Editar</button>
              <button className="btn sm" onClick={() => alternar(p)}>{p.ativa ? "Desativar" : "Ativar"}</button>
              <button className="btn sm bad" onClick={() => apagar(p)}>Apagar</button>
            </div>
          </div>
        ))}</div>
      )}
      {ed && (
        <Modal titulo={ed.id ? "Editar promoção" : "Nova promoção"} onClose={() => setEd(null)}>
          <Field label="Título"><input className="input" value={ed.titulo ?? ""} onChange={(e) => setEd({ ...ed, titulo: e.target.value })} /></Field>
          <Field label="Descrição"><input className="input" value={ed.descricao ?? ""} onChange={(e) => setEd({ ...ed, descricao: e.target.value })} /></Field>
          <div className="row">
            <Field label="Desconto (%)"><input className="input" type="number" min={1} max={100} value={ed.desconto_pct ?? 10} onChange={(e) => setEd({ ...ed, desconto_pct: e.target.value as unknown as number })} /></Field>
            <Field label="Serviço">
              <select value={ed.servico_id ?? ""} onChange={(e) => setEd({ ...ed, servico_id: e.target.value || null })}>
                <option value="">Todos</option>{servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </Field>
          </div>
          <div className="row">
            <Field label="Início"><input className="input" type="date" value={ed.data_inicio ?? ""} onChange={(e) => setEd({ ...ed, data_inicio: e.target.value || null })} /></Field>
            <Field label="Fim"><input className="input" type="date" value={ed.data_fim ?? ""} onChange={(e) => setEd({ ...ed, data_fim: e.target.value || null })} /></Field>
          </div>
          <label className="chk" style={{ marginBottom: 14 }}><input type="checkbox" checked={ed.ativa ?? true} onChange={(e) => setEd({ ...ed, ativa: e.target.checked })} /> Ativa</label>
          <button className="btn gold block" onClick={guardar}>Guardar</button>
        </Modal>
      )}
    </div>
  );
}
