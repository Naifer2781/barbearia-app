"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Servico } from "@/lib/types";
import { eur } from "@/lib/utils";
import { Empty, Field, Modal } from "../ui";

export default function Servicos({ servicos, recarregar, show }: { servicos: Servico[]; recarregar: () => void; show: (t: string, e?: boolean) => void }) {
  const [ed, setEd] = useState<Partial<Servico> | null>(null);

  async function guardar() {
    if (!ed) return;
    const preco = Math.round(Number(String(ed.preco).replace(/\s/g, "").replace(",", ".")));
    if (!ed.nome?.trim() || isNaN(preco)) return show("Nome e preço são obrigatórios.", true);
    const row = { nome: ed.nome.trim(), descricao: ed.descricao || null, preco, duracao_min: Number(ed.duracao_min) || 30, ativo: ed.ativo ?? true, ordem: Number(ed.ordem) || 0 };
    const { error } = ed.id ? await supabase.from("servicos").update(row).eq("id", ed.id) : await supabase.from("servicos").insert(row);
    if (error) return show(error.message, true);
    setEd(null); show("Serviço guardado"); recarregar();
  }
  async function apagar(s: Servico) {
    if (!confirm(`Apagar "${s.nome}"? As marcações antigas mantêm o nome do serviço.`)) return;
    const { error } = await supabase.from("servicos").delete().eq("id", s.id);
    if (error) return show(error.message, true);
    recarregar();
  }

  return (
    <div>
      <div className="row between" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Serviços e preços</h2>
        <button className="btn gold" onClick={() => setEd({ nome: "", preco: 3000, duracao_min: 30, ativo: true, ordem: servicos.length + 1 })}>＋ Novo</button>
      </div>
      {servicos.length === 0 ? <Empty>Ainda sem serviços.</Empty> : (
        <div className="col">{servicos.map((s) => (
          <div className="card" key={s.id} style={{ opacity: s.ativo ? 1 : 0.55 }}>
            <div className="row between"><b>{s.nome}</b><b className="gold">{eur(s.preco)}</b></div>
            <div className="muted">{s.descricao} · {s.duracao_min} min {!s.ativo && "· inativo"}</div>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn sm" onClick={() => setEd(s)}>Editar</button>
              <button className="btn sm bad" onClick={() => apagar(s)}>Apagar</button>
            </div>
          </div>
        ))}</div>
      )}
      {ed && (
        <Modal titulo={ed.id ? "Editar serviço" : "Novo serviço"} onClose={() => setEd(null)}>
          <Field label="Nome"><input className="input" value={ed.nome ?? ""} onChange={(e) => setEd({ ...ed, nome: e.target.value })} /></Field>
          <Field label="Descrição"><input className="input" value={ed.descricao ?? ""} onChange={(e) => setEd({ ...ed, descricao: e.target.value })} /></Field>
          <div className="row">
            <Field label="Preço (FCFA)"><input className="input" inputMode="numeric" value={String(ed.preco ?? "")} onChange={(e) => setEd({ ...ed, preco: e.target.value as unknown as number })} /></Field>
            <Field label="Duração (min)"><input className="input" type="number" step={15} min={15} value={ed.duracao_min ?? 30} onChange={(e) => setEd({ ...ed, duracao_min: Number(e.target.value) })} /></Field>
            <Field label="Ordem"><input className="input" type="number" value={ed.ordem ?? 0} onChange={(e) => setEd({ ...ed, ordem: Number(e.target.value) })} /></Field>
          </div>
          <label className="chk" style={{ marginBottom: 14 }}><input type="checkbox" checked={ed.ativo ?? true} onChange={(e) => setEd({ ...ed, ativo: e.target.checked })} /> Visível para os clientes</label>
          <button className="btn gold block" onClick={guardar}>Guardar</button>
        </Modal>
      )}
    </div>
  );
}
