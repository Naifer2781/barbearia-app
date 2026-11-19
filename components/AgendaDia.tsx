"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtime } from "@/lib/hooks";
import type { Barbeiro, Bloqueio, Marcacao, Servico } from "@/lib/types";
import { addDays, eur, fmtData, hhmm, hojeISO, isoDow } from "@/lib/utils";
import { Empty, Estado, Field, Modal } from "./ui";

interface Props {
  barbeiros: Barbeiro[];           // dono: todos; barbeiro: apenas o próprio
  servicos: Servico[];
  dono: boolean;
  show: (t: string, erro?: boolean) => void;
}

type Vista = "proximas" | "hoje" | "data" | "canceladas";

const SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
function cabecalho(d: string, hoje: string) {
  const dm = `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  if (d === hoje) return `Hoje · ${dm}`;
  if (d === addDays(hoje, 1)) return `Amanhã · ${dm}`;
  if (d === addDays(hoje, -1)) return `Ontem · ${dm}`;
  return `${SEMANA[isoDow(d) - 1]} · ${dm}`;
}
function agrupar<T extends { data: string }>(rows: T[], desc = false) {
  const m = new Map<string, T[]>();
  for (const r of rows) m.set(r.data, [...(m.get(r.data) ?? []), r]);
  return [...m.entries()].sort(([x], [y]) => (desc ? y.localeCompare(x) : x.localeCompare(y)));
}

export default function AgendaDia({ barbeiros, servicos, dono, show }: Props) {
  const hoje = hojeISO();
  const [vista, setVista] = useState<Vista>("proximas");
  const [data, setData] = useState(hoje);               // data escolhida em "Escolher data"
  const [futuras, setFuturas] = useState<Marcacao[]>([]);  // todas as marcações de hoje em diante
  const [dia, setDia] = useState<Marcacao[]>([]);          // vista "Escolher data"
  const [canc, setCanc] = useState<Marcacao[]>([]);        // vista "Canceladas"
  const [nData, setNData] = useState(0);
  const [nCanc, setNCanc] = useState(0);
  const [bloqs, setBloqs] = useState<Bloqueio[]>([]);
  const [modal, setModal] = useState<"encaixe" | "bloqueio" | null>(null);

  const carregar = useCallback(async () => {
    const [f, bf, cc, cd] = await Promise.all([
      supabase.from("marcacoes").select("*").gte("data", hoje).order("data").order("hora_inicio").limit(1000),
      supabase.from("bloqueios").select("*").gte("data", hoje).order("data").order("hora_inicio"),
      supabase.from("marcacoes").select("id", { count: "exact", head: true }).eq("estado", "cancelado"),
      supabase.from("marcacoes").select("id", { count: "exact", head: true }).eq("data", data).neq("estado", "cancelado"),
    ]);
    if (f.data) setFuturas(f.data as Marcacao[]);
    setNCanc(cc.count ?? 0);
    setNData(cd.count ?? 0);
    if (vista === "data") {
      const [m, b] = await Promise.all([
        supabase.from("marcacoes").select("*").eq("data", data).order("hora_inicio"),
        supabase.from("bloqueios").select("*").eq("data", data).order("hora_inicio"),
      ]);
      if (m.data) setDia(m.data as Marcacao[]);
      if (b.data) setBloqs(b.data as Bloqueio[]);
    } else {
      if (bf.data) setBloqs(bf.data as Bloqueio[]);
      if (vista === "canceladas") {
        const c = await supabase.from("marcacoes").select("*").eq("estado", "cancelado")
          .order("data", { ascending: false }).order("hora_inicio").limit(300);
        if (c.data) setCanc(c.data as Marcacao[]);
      }
    }
  }, [hoje, data, vista]);
  useEffect(() => { carregar(); }, [carregar]);
  useRealtime(["marcacoes", "bloqueios"], carregar, 20000);

  async function estado(m: Marcacao, e: Marcacao["estado"]) {
    const upd: Record<string, unknown> = { estado: e };
    if (e === "cancelado") upd.cancelado_por = dono ? "dono" : "barbeiro"; // o servidor confirma pelo papel do utilizador
    const { error } = await supabase.from("marcacoes").update(upd).eq("id", m.id);
    if (error) return show(error.message, true);
    show(e === "concluido" ? "Marcado como concluído ✓" : e === "faltou" ? "Marcado como faltou"
      : e === "cancelado" ? `Cancelado pelo ${dono ? "dono" : "barbeiro"}` : "Atualizado");
    carregar();
  }
  async function apagarBloqueio(id: string) {
    if (!confirm("Remover este bloqueio?")) return;
    const { error } = await supabase.from("bloqueios").delete().eq("id", id);
    if (error) return show(error.message, true);
    carregar();
  }

  const ativasFuturas = futuras.filter((m) => m.estado !== "cancelado");
  const nProx = ativasFuturas.length;
  const nHoje = ativasFuturas.filter((m) => m.data === hoje).length;

  const linhas: Marcacao[] =
    vista === "proximas" ? ativasFuturas
    : vista === "hoje" ? ativasFuturas.filter((m) => m.data === hoje)
    : vista === "data" ? dia.filter((m) => m.estado !== "cancelado")
    : canc;

  const grupos = (() => {
    const g = agrupar(linhas, vista === "canceladas");
    const datas = new Set(g.map(([d]) => d));
    const out = g.map(([d, rows]) => ({ d, rows }));
    if (vista !== "canceladas") {
      for (const b of bloqs) if (!datas.has(b.data)) { datas.add(b.data); out.push({ d: b.data, rows: [] }); }
      if ((vista === "proximas" || vista === "hoje") && !datas.has(hoje)) out.push({ d: hoje, rows: [] });
      if (vista === "data" && !datas.has(data)) out.push({ d: data, rows: [] });
      out.sort((x, y) => x.d.localeCompare(y.d));
    }
    return out;
  })();

  const totalDia = linhas.filter((m) => m.estado === "concluido").reduce((t, m) => t + Number(m.preco), 0);
  const comissaoDia = linhas.reduce((t, m) => t + Number(m.comissao_valor), 0);
  const colunas = dono && (vista === "hoje" || vista === "data");

  const filtros: [Vista, string, number | null][] = [
    ["proximas", "Próximas", nProx], ["hoje", "Hoje", nHoje], ["data", "Escolher data", nData], ["canceladas", "Canceladas", nCanc],
  ];

  return (
    <div>
      <div className="row wrap between" style={{ marginBottom: 4 }}>
        <div className="tabs" style={{ padding: 0 }}>
          {filtros.map(([k, l, n]) => (
            <button key={k} className={"tab" + (vista === k ? " on" : "")} onClick={() => setVista(k)}>
              {l}{n !== null && <span className="n" title={k === "canceladas" ? "Marcações canceladas" : "Marcações ativas"}>{n}</span>}
            </button>
          ))}
        </div>
        <div className="row">
          <button className="btn gold sm" onClick={() => setModal("encaixe")}>＋ Encaixe</button>
          {dono && <button className="btn sm" onClick={() => setModal("bloqueio")}>⛔ Bloquear</button>}
        </div>
      </div>

      {vista === "data" && (
        <div className="row" style={{ margin: "10px 0" }}>
          <button className="btn sm" onClick={() => setData(addDays(data, -1))}>‹</button>
          <input className="input" type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} style={{ width: 160 }} />
          <button className="btn sm" onClick={() => setData(addDays(data, 1))}>›</button>
        </div>
      )}

      {vista !== "canceladas" && (
        <div className="grid g3" style={{ margin: "12px 0 4px" }}>
          <div className="stat"><div className="l">Marcações</div><div className="v">{linhas.length}</div></div>
          <div className="stat"><div className="l">Faturado</div><div className="v">{eur(totalDia)}</div></div>
          <div className="stat"><div className="l">{dono ? "Comissões" : "A minha comissão"}</div><div className="v gold">{eur(comissaoDia)}</div></div>
        </div>
      )}
      {vista === "canceladas" && (
        <p className="muted" style={{ margin: "10px 0" }}>Todas as marcações canceladas, da mais recente para a mais antiga.</p>
      )}

      {grupos.length === 0 && <Empty>{vista === "canceladas" ? "Sem marcações canceladas." : "Sem marcações."}</Empty>}

      {grupos.map(({ d, rows }) => {
        const bl = vista === "canceladas" ? [] : bloqs.filter((b) => b.data === d);
        return (
          <section key={d}>
            <div className={"dayhead" + (d === hoje ? " hoje" : "")}>
              <h3>{cabecalho(d, hoje)}</h3>
              <span className="muted">{rows.length} {vista === "canceladas" ? "cancelada(s)" : "marcação(ões)"}</span>
            </div>
            {bl.length > 0 && (
              <div className="col" style={{ marginBottom: 10 }}>
                {bl.map((b) => (
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
            {colunas ? (
              <div className="grid g2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", alignItems: "start" }}>
                {barbeiros.filter((b) => b.ativo).map((b) => {
                  const lista = rows.filter((m) => m.barbeiro_id === b.id);
                  return (
                    <div key={b.id} className="col">
                      <h3 className="gold">🪑 {b.nome}</h3>
                      {lista.length === 0 ? <Empty>Sem marcações</Empty> : lista.map((m) => <Cartao key={m.id} m={m} dono={dono} barbeiros={barbeiros} onEstado={estado} />)}
                    </div>
                  );
                })}
              </div>
            ) : rows.length === 0 ? (
              <Empty>Sem marcações {d === hoje ? "para hoje" : "neste dia"}.</Empty>
            ) : (
              <div className="col">{rows.map((m) => <Cartao key={m.id} m={m} dono={dono} barbeiros={barbeiros} onEstado={estado} />)}</div>
            )}
          </section>
        );
      })}

      {modal === "encaixe" && (
        <EncaixeModal barbeiros={barbeiros} servicos={servicos} dono={dono} data={vista === "data" ? data : hoje}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); show("Encaixe adicionado"); carregar(); }} show={show} />
      )}
      {modal === "bloqueio" && (
        <BloqueioModal barbeiros={barbeiros} data={vista === "data" ? data : hoje}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); show("Horário bloqueado"); carregar(); }} show={show} />
      )}
    </div>
  );
}

function Cartao({ m, dono, barbeiros, onEstado }: {
  m: Marcacao; dono: boolean; barbeiros: Barbeiro[]; onEstado: (m: Marcacao, e: Marcacao["estado"]) => void;
}) {
  const cancelado = m.estado === "cancelado";
  return (
    <div className={"appt" + (cancelado ? " cancelled" : m.estado !== "marcado" ? " done" : "")}>
      <div className="t">{hhmm(m.hora_inicio)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row between" style={{ alignItems: "flex-start" }}>
          <b style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{m.cliente_nome}{m.encaixe && " · encaixe"}</b>
          <Estado e={m.estado} por={m.cancelado_por} />
        </div>
        <div className="muted">{m.servico_nome} · {m.duracao_min} min · {eur(m.preco)}
          {` · ${barbeiros.find((b) => b.id === m.barbeiro_id)?.nome ?? ""}`}</div>
        {cancelado && <div className="muted">📅 {fmtData(m.data)}</div>}
        {m.cliente_telefone && <div className="muted">📱 {m.cliente_telefone}</div>}
        <div className="row wrap" style={{ marginTop: 8 }}>
          {m.estado === "marcado" ? (
            <>
              <button className="btn ok sm" onClick={() => onEstado(m, "concluido")}>✓ Concluído</button>
              <button className="btn bad sm" onClick={() => onEstado(m, "faltou")}>Faltou</button>
              <button className="btn sm" onClick={() => confirm("Cancelar marcação?") && onEstado(m, "cancelado")}>Cancelar</button>
            </>
          ) : !cancelado || dono ? (
            <button className="btn sm" onClick={() => onEstado(m, "marcado")}>↺ Reabrir</button>
          ) : null}
        </div>
      </div>
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
