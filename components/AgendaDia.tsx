"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtime } from "@/lib/hooks";
import type { Barbeiro, Bloqueio, Marcacao, Servico } from "@/lib/types";
import { addDays, eur, fmtData, hhmm, hojeISO } from "@/lib/utils";
import { Empty, Estado, Field, Modal } from "./ui";

interface Props {
  barbeiros: Barbeiro[];           // dono: todos; barbeiro: apenas o próprio
  servicos: Servico[];
  dono: boolean;
  show: (t: string, erro?: boolean) => void;
}

export default function AgendaDia({ barbeiros, servicos, dono, show }: Props) {
  const [data, setData] = useState(hojeISO());
  const [marcs, setMarcs] = useState<Marcacao[]>([]);
  const [bloqs, setBloqs] = useState<Bloqueio[]>([]);
  const [modal, setModal] = useState<"encaixe" | "bloqueio" | null>(null);

  const carregar = useCallback(async () => {
    const [m, b] = await Promise.all([
      supabase.from("marcacoes").select("*").eq("data", data).order("hora_inicio"),
      supabase.from("bloqueios").select("*").eq("data", data).order("hora_inicio"),
    ]);
    if (m.data) setMarcs(m.data as Marcacao[]);
    if (b.data) setBloqs(b.data as Bloqueio[]);
  }, [data]);
  useEffect(() => { carregar(); }, [carregar]);
  useRealtime(["marcacoes", "bloqueios"], carregar, 20000);

  async function estado(m: Marcacao, e: Marcacao["estado"]) {
    const { error } = await supabase.from("marcacoes").update({ estado: e }).eq("id", m.id);
    if (error) return show(error.message, true);
    show(e === "concluido" ? "Marcado como concluído ✓" : e === "faltou" ? "Marcado como faltou" : "Atualizado");
    carregar();
  }
  async function apagarBloqueio(id: string) {
    if (!confirm("Remover este bloqueio?")) return;
    const { error } = await supabase.from("bloqueios").delete().eq("id", id);
    if (error) return show(error.message, true);
    carregar();
  }

  const ativos = marcs.filter((m) => m.estado !== "cancelado");
  const totalDia = ativos.filter((m) => m.estado === "concluido").reduce((s, m) => s + Number(m.preco), 0);
  const comissaoDia = ativos.reduce((s, m) => s + Number(m.comissao_valor), 0);

  function Cartao({ m }: { m: Marcacao }) {
    return (
      <div className={"appt" + (m.estado !== "marcado" ? " done" : "")}>
        <div className="t">{hhmm(m.hora_inicio)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row between">
            <b style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{m.cliente_nome}{m.encaixe && " · encaixe"}</b>
            <Estado e={m.estado} />
          </div>
          <div className="muted">{m.servico_nome} · {m.duracao_min} min · {eur(m.preco)}
            {dono && ` · ${barbeiros.find((b) => b.id === m.barbeiro_id)?.nome ?? ""}`}</div>
          {m.cliente_telefone && <div className="muted">📱 {m.cliente_telefone}</div>}
          <div className="row wrap" style={{ marginTop: 8 }}>
            {m.estado === "marcado" ? (
              <>
                <button className="btn ok sm" onClick={() => estado(m, "concluido")}>✓ Concluído</button>
                <button className="btn bad sm" onClick={() => estado(m, "faltou")}>Faltou</button>
                {dono && <button className="btn sm" onClick={() => confirm("Cancelar marcação?") && estado(m, "cancelado")}>Cancelar</button>}
              </>
            ) : m.estado !== "cancelado" || dono ? (
              <button className="btn sm" onClick={() => estado(m, "marcado")}>↺ Reabrir</button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="row wrap between" style={{ marginBottom: 12 }}>
        <div className="row">
          <button className="btn sm" onClick={() => setData(addDays(data, -1))}>‹</button>
          <input className="input" type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} style={{ width: 160 }} />
          <button className="btn sm" onClick={() => setData(addDays(data, 1))}>›</button>
          {data !== hojeISO() && <button className="btn sm" onClick={() => setData(hojeISO())}>Hoje</button>}
        </div>
        <div className="row">
          <button className="btn gold sm" onClick={() => setModal("encaixe")}>＋ Encaixe</button>
          {dono && <button className="btn sm" onClick={() => setModal("bloqueio")}>⛔ Bloquear</button>}
        </div>
      </div>
      <p className="muted" style={{ marginBottom: 12, textTransform: "capitalize" }}>{fmtData(data, true)}</p>

      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="stat"><div className="l">Marcações</div><div className="v">{ativos.length}</div></div>
        <div className="stat"><div className="l">Faturado</div><div className="v">{eur(totalDia)}</div></div>
        <div className="stat"><div className="l">{dono ? "Comissões" : "A minha comissão"}</div><div className="v gold">{eur(comissaoDia)}</div></div>
      </div>

      {bloqs.length > 0 && (
        <div className="col" style={{ marginBottom: 12 }}>
          {bloqs.map((b) => (
            <div key={b.id} className="appt" style={{ borderColor: "var(--bad)" }}>
              <div className="t" style={{ color: "var(--bad)" }}>⛔</div>
              <div style={{ flex: 1 }}>
                <b>Bloqueado {hhmm(b.hora_inicio)}–{hhmm(b.hora_fim)}</b>
                <div className="muted">{b.barbeiro_id ? barbeiros.find((x) => x.id === b.barbeiro_id)?.nome : "Todas as cadeiras"}{b.motivo ? ` · ${b.motivo}` : ""}</div>
              </div>
              {dono && <button className="btn sm bad" onClick={() => apagarBloqueio(b.id)}>Remover</button>}
            </div>
          ))}
        </div>
      )}

      {dono ? (
        <div className="grid g2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", alignItems: "start" }}>
          {barbeiros.filter((b) => b.ativo).map((b) => {
            const lista = marcs.filter((m) => m.barbeiro_id === b.id);
            return (
              <div key={b.id} className="col">
                <h3 className="gold">🪑 {b.nome}</h3>
                {lista.length === 0 ? <Empty>Sem marcações</Empty> : lista.map((m) => <Cartao key={m.id} m={m} />)}
              </div>
            );
          })}
        </div>
      ) : marcs.length === 0 ? <Empty>Sem marcações para este dia.</Empty> : (
        <div className="col">{marcs.map((m) => <Cartao key={m.id} m={m} />)}</div>
      )}

      {modal === "encaixe" && (
        <EncaixeModal barbeiros={barbeiros} servicos={servicos} dono={dono} data={data}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); show("Encaixe adicionado"); carregar(); }} show={show} />
      )}
      {modal === "bloqueio" && (
        <BloqueioModal barbeiros={barbeiros} data={data}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); show("Horário bloqueado"); carregar(); }} show={show} />
      )}
    </div>
  );
}

function EncaixeModal({ barbeiros, servicos, dono, data, onClose, onSaved, show }: {
  barbeiros: Barbeiro[]; servicos: Servico[]; dono: boolean; data: string;
  onClose: () => void; onSaved: () => void; show: (t: string, e?: boolean) => void;
}) {
  const agora = new Date().toTimeString().slice(0, 5);
  const [barbeiroId, setBarbeiroId] = useState(barbeiros[0]?.id ?? "");
  const [servicoId, setServicoId] = useState(servicos.find((s) => s.ativo)?.id ?? "");
  const [hora, setHora] = useState(agora);
  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  const [feito, setFeito] = useState(true);
  const [busy, setBusy] = useState(false);

  async function guardar() {
    const s = servicos.find((x) => x.id === servicoId);
    if (!s || !barbeiroId) return show("Escolha o serviço.", true);
    setBusy(true);
    const { error } = await supabase.from("marcacoes").insert({
      barbeiro_id: barbeiroId, servico_id: servicoId, data, hora_inicio: hora,
      cliente_nome: nome.trim() || "Cliente sem marcação", cliente_telefone: tel.trim() || null,
      encaixe: true, estado: feito ? "concluido" : "marcado",
    });
    setBusy(false);
    if (error) return show(error.message, true);
    onSaved();
  }

  return (
    <Modal titulo="Adicionar encaixe" onClose={onClose}>
      {dono && (
        <Field label="Barbeiro">
          <select value={barbeiroId} onChange={(e) => setBarbeiroId(e.target.value)}>
            {barbeiros.filter((b) => b.ativo).map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
          </select>
        </Field>
      )}
      <Field label="Serviço">
        <select value={servicoId} onChange={(e) => setServicoId(e.target.value)}>
          {servicos.filter((s) => s.ativo).map((s) => <option key={s.id} value={s.id}>{s.nome} — {eur(s.preco)}</option>)}
        </select>
      </Field>
      <div className="row">
        <Field label="Hora"><input className="input" type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></Field>
        <Field label="Nome (opcional)"><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
      </div>
      <Field label="WhatsApp (opcional — conta para a fidelidade)"><input className="input" value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel" /></Field>
      <label className="chk" style={{ marginBottom: 14 }}><input type="checkbox" checked={feito} onChange={(e) => setFeito(e.target.checked)} /> Já atendido (registar como concluído)</label>
      <button className="btn gold block" disabled={busy} onClick={guardar}>Guardar encaixe</button>
    </Modal>
  );
}

function BloqueioModal({ barbeiros, data, onClose, onSaved, show }: {
  barbeiros: Barbeiro[]; data: string; onClose: () => void; onSaved: () => void; show: (t: string, e?: boolean) => void;
}) {
  const [barbeiroId, setBarbeiroId] = useState("");
  const [dia, setDia] = useState(data);
  const [diaTodo, setDiaTodo] = useState(false);
  const [ini, setIni] = useState("12:00");
  const [fim, setFim] = useState("13:00");
  const [motivo, setMotivo] = useState("");

  async function guardar() {
    if (!diaTodo && fim <= ini) return show("A hora de fim tem de ser depois do início.", true);
    const { error } = await supabase.from("bloqueios").insert({
      barbeiro_id: barbeiroId || null, data: dia,
      hora_inicio: diaTodo ? "00:00" : ini, hora_fim: diaTodo ? "23:59" : fim, motivo: motivo.trim() || null,
    });
    if (error) return show(error.message, true);
    onSaved();
  }
  return (
    <Modal titulo="Bloquear horário" onClose={onClose}>
      <Field label="Cadeira / barbeiro">
        <select value={barbeiroId} onChange={(e) => setBarbeiroId(e.target.value)}>
          <option value="">Todas as cadeiras</option>
          {barbeiros.filter((b) => b.ativo).map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
        </select>
      </Field>
      <Field label="Data"><input className="input" type="date" value={dia} onChange={(e) => setDia(e.target.value)} /></Field>
      <label className="chk" style={{ marginBottom: 12 }}><input type="checkbox" checked={diaTodo} onChange={(e) => setDiaTodo(e.target.checked)} /> Dia inteiro</label>
      {!diaTodo && (
        <div className="row">
          <Field label="Das"><input className="input" type="time" value={ini} onChange={(e) => setIni(e.target.value)} /></Field>
          <Field label="Às"><input className="input" type="time" value={fim} onChange={(e) => setFim(e.target.value)} /></Field>
        </div>
      )}
      <Field label="Motivo (opcional)"><input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Almoço, férias, formação…" /></Field>
      <button className="btn gold block" onClick={guardar}>Bloquear</button>
    </Modal>
  );
}
