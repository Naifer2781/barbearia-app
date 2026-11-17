"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtime } from "@/lib/hooks";
import type { Barbeiro, Profile } from "@/lib/types";
import { DIAS, hhmm, normTel, waLink } from "@/lib/utils";
import { Empty, Field, Modal } from "../ui";

export default function Equipa({ barbeiros, recarregar, show }: { barbeiros: Barbeiro[]; recarregar: () => void; show: (t: string, e?: boolean) => void }) {
  const [ed, setEd] = useState<Partial<Barbeiro> | null>(null);
  const [perfis, setPerfis] = useState<Profile[]>([]);

  const carregarPerfis = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*").order("criado_em");
    if (data) setPerfis(data as Profile[]);
  }, []);
  useEffect(() => { carregarPerfis(); }, [carregarPerfis]);
  useRealtime(["profiles"], carregarPerfis);

  async function guardar() {
    if (!ed) return;
    const com = Number(ed.comissao_pct);
    if (!ed.nome?.trim() || isNaN(com) || com < 0 || com > 100) return show("Nome e comissão (0–100) são obrigatórios.", true);
    const row = {
      nome: ed.nome.trim(), foto_url: ed.foto_url || null, comissao_pct: com,
      hora_abertura: ed.hora_abertura ?? "09:00", hora_fecho: ed.hora_fecho ?? "19:00",
      dias_trabalho: ed.dias_trabalho ?? [1, 2, 3, 4, 5, 6], ativo: ed.ativo ?? true,
    };
    const { error } = ed.id ? await supabase.from("barbeiros").update(row).eq("id", ed.id) : await supabase.from("barbeiros").insert(row);
    if (error) return show(error.message, true);
    setEd(null); show("Barbeiro guardado"); recarregar();
  }

  async function associar(profileId: string, barbeiroId: string) {
    const upd = barbeiroId ? { role: "barbeiro", barbeiro_id: barbeiroId } : { role: "pendente", barbeiro_id: null };
    const { error } = await supabase.from("profiles").update(upd).eq("id", profileId);
    if (error) return show(error.message, true);
    show(barbeiroId ? "Conta associada ✓" : "Acesso removido"); carregarPerfis();
  }

  const contas = perfis.filter((p) => p.role !== "owner");

  return (
    <div>
      <div className="row between" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Equipa e comissões</h2>
        <button className="btn gold" onClick={() => setEd({ nome: "", comissao_pct: 40, hora_abertura: "09:00", hora_fecho: "19:00", dias_trabalho: [1, 2, 3, 4, 5, 6], ativo: true })}>＋ Novo barbeiro</button>
      </div>
      <div className="grid g2">
        {barbeiros.map((b) => {
          const conta = perfis.find((p) => p.barbeiro_id === b.id);
          return (
            <div className="card" key={b.id} style={{ opacity: b.ativo ? 1 : 0.55 }}>
              <div className="row between"><b>{b.nome}</b><span className="badge marcado">{Number(b.comissao_pct)}% comissão</span></div>
              <div className="muted">{hhmm(b.hora_abertura)}–{hhmm(b.hora_fecho)} · {b.dias_trabalho.map((d) => DIAS[d - 1]).join(", ")}</div>
              <div className="muted">Login: {conta ? `${conta.nome ?? ""} ${conta.email ?? ""}`.trim() : "não associado"}</div>
              <div className="row" style={{ marginTop: 8 }}><button className="btn sm" onClick={() => setEd(b)}>Editar</button></div>
            </div>
          );
        })}
      </div>

      <div className="sp" />
      <h2>Contas de acesso</h2>
      <p className="muted" style={{ marginBottom: 10 }}>Cada barbeiro cria a sua conta em <b>/entrar</b>. Aqui associa-a ao barbeiro correto para dar acesso ao painel.</p>
      {contas.length === 0 ? <Empty>Sem contas pendentes ou de barbeiros.</Empty> : (
        <div className="col">{contas.map((c) => (
          <div className="card row wrap" key={c.id}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <b>{c.nome || "(sem nome)"}</b>
              <div className="muted">{c.email}</div>
              <div className="muted">
                {c.telefone ? <>📱 <a href={waLink(normTel(c.telefone))} target="_blank" rel="noreferrer">{c.telefone}</a></> : "Sem telemóvel"}
                {" · "}{c.role === "pendente" ? "⏳ Pendente" : "✓ Barbeiro"}
              </div>
            </div>
            <select style={{ width: 220 }} value={c.barbeiro_id ?? ""} onChange={(e) => associar(c.id, e.target.value)}>
              <option value="">— sem acesso —</option>
              {barbeiros.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
          </div>
        ))}</div>
      )}

      {ed && (
        <Modal titulo={ed.id ? "Editar barbeiro" : "Novo barbeiro"} onClose={() => setEd(null)}>
          <Field label="Nome"><input className="input" value={ed.nome ?? ""} onChange={(e) => setEd({ ...ed, nome: e.target.value })} /></Field>
          <Field label="Foto (URL, opcional)"><input className="input" value={ed.foto_url ?? ""} onChange={(e) => setEd({ ...ed, foto_url: e.target.value })} /></Field>
          <Field label="Comissão (%)"><input className="input" type="number" min={0} max={100} value={ed.comissao_pct ?? 40} onChange={(e) => setEd({ ...ed, comissao_pct: e.target.value as unknown as number })} /></Field>
          <div className="row">
            <Field label="Abre"><input className="input" type="time" value={hhmm(ed.hora_abertura ?? "09:00")} onChange={(e) => setEd({ ...ed, hora_abertura: e.target.value })} /></Field>
            <Field label="Fecha"><input className="input" type="time" value={hhmm(ed.hora_fecho ?? "19:00")} onChange={(e) => setEd({ ...ed, hora_fecho: e.target.value })} /></Field>
          </div>
          <label>Dias de trabalho</label>
          <div className="row wrap" style={{ marginBottom: 12 }}>
            {DIAS.map((d, i) => {
              const on = (ed.dias_trabalho ?? []).includes(i + 1);
              return <button key={d} type="button" className={"tab" + (on ? " on" : "")} onClick={() => {
                const cur = ed.dias_trabalho ?? [];
                setEd({ ...ed, dias_trabalho: on ? cur.filter((x) => x !== i + 1) : [...cur, i + 1].sort() });
              }}>{d}</button>;
            })}
          </div>
          <label className="chk" style={{ marginBottom: 14 }}><input type="checkbox" checked={ed.ativo ?? true} onChange={(e) => setEd({ ...ed, ativo: e.target.checked })} /> Ativo (aparece para marcações)</label>
          <button className="btn gold block" onClick={guardar}>Guardar</button>
        </Modal>
      )}
    </div>
  );
}
