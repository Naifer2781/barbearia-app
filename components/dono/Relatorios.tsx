"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Barbeiro, Marcacao } from "@/lib/types";
import { downloadCSV, eur, parseISO } from "@/lib/utils";
import { SeletorPeriodo, usePeriodo } from "./periodo";

export default function Relatorios({ barbeiros }: { barbeiros: Barbeiro[] }) {
  const p = usePeriodo("mes");
  const [marcs, setMarcs] = useState<Marcacao[]>([]);

  const carregar = useCallback(async () => {
    const { data } = await supabase.from("marcacoes").select("*").gte("data", p.de).lte("data", p.ate);
    if (data) setMarcs(data as Marcacao[]);
  }, [p.de, p.ate]);
  useEffect(() => { carregar(); }, [carregar]);

  const r = useMemo(() => {
    const conc = marcs.filter((m) => m.estado === "concluido");
    const porServ = new Map<string, { n: number; v: number }>();
    const porDia = new Map<string, number>();
    const porHora = new Map<string, number>();
    for (const m of conc) {
      const k = m.servico_nome ?? "—";
      const s = porServ.get(k) ?? { n: 0, v: 0 }; s.n++; s.v += Number(m.preco); porServ.set(k, s);
      porDia.set(m.data, (porDia.get(m.data) ?? 0) + Number(m.preco));
      const h = m.hora_inicio.slice(0, 2) + "h"; porHora.set(h, (porHora.get(h) ?? 0) + 1);
    }
    return {
      conc, porServ: [...porServ.entries()].sort((a, b) => b[1].v - a[1].v),
      dias: [...porDia.entries()].sort(), horas: [...porHora.entries()].sort(),
      faltas: marcs.filter((m) => m.estado === "faltou").length,
      cancel: marcs.filter((m) => m.estado === "cancelado").length,
      total: marcs.length,
    };
  }, [marcs]);

  const fat = r.conc.reduce((s, m) => s + Number(m.preco), 0);
  const max = Math.max(1, ...r.dias.map(([, v]) => v));
  const maxH = Math.max(1, ...r.horas.map(([, v]) => v));
  const ticket = r.conc.length ? fat / r.conc.length : 0;

  return (
    <div>
      <div className="row between wrap">
        <SeletorPeriodo p={p} />
        <button className="btn sm" style={{ marginBottom: 12 }} onClick={() => downloadCSV(`relatorio_${p.de}_${p.ate}.csv`, [
          ["Data", "Hora", "Barbeiro", "Cliente", "Serviço", "Estado", "Cancelado por", "Preço", "Comissão"],
          ...marcs.map((m) => [m.data, m.hora_inicio.slice(0, 5), barbeiros.find((b) => b.id === m.barbeiro_id)?.nome ?? "", m.cliente_nome, m.servico_nome ?? "", m.estado, m.cancelado_por ?? "", m.preco, m.comissao_valor]),
        ])}>⬇ Exportar CSV</button>
      </div>

      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="stat"><div className="l">Marcações</div><div className="v">{r.total}</div></div>
        <div className="stat"><div className="l">Concluídas</div><div className="v">{r.conc.length}</div></div>
        <div className="stat"><div className="l">Ticket médio</div><div className="v">{eur(ticket)}</div></div>
        <div className="stat"><div className="l">Faltas</div><div className="v" style={{ color: "var(--bad)" }}>{r.faltas}</div></div>
        <div className="stat"><div className="l">Cancelamentos</div><div className="v">{r.cancel}</div></div>
        <div className="stat"><div className="l">Taxa de faltas</div><div className="v">{r.total ? Math.round((r.faltas / r.total) * 100) : 0}%</div></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12 }}>Faturação por dia</h3>
        {r.dias.length === 0 ? <p className="muted">Sem dados.</p> : (
          <div style={{ overflowX: "auto" }}><div style={{ minWidth: Math.max(r.dias.length * 26, 280) }}>
            <div className="bars">{r.dias.map(([d, v]) => <div key={d} style={{ height: `${(v / max) * 100}%` }} title={`${d}: ${eur(v)}`} />)}</div>
            <div className="barlbl">{r.dias.map(([d]) => <span key={d}>{parseISO(d).getDate()}</span>)}</div>
          </div></div>
        )}
      </div>

      <div className="grid g2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <div className="card scroll-x">
          <h3 style={{ marginBottom: 8 }}>Serviços mais vendidos</h3>
          <table className="tbl"><thead><tr><th>Serviço</th><th>Qtd</th><th>Receita</th></tr></thead>
            <tbody>{r.porServ.map(([k, s]) => <tr key={k}><td>{k}</td><td>{s.n}</td><td>{eur(s.v)}</td></tr>)}</tbody></table>
        </div>
        <div className="card scroll-x">
          <h3 style={{ marginBottom: 8 }}>Barbeiros</h3>
          <table className="tbl"><thead><tr><th>Nome</th><th>Cortes</th><th>Receita</th><th>Faltas</th></tr></thead>
            <tbody>{barbeiros.map((b) => {
              const l = r.conc.filter((m) => m.barbeiro_id === b.id);
              return <tr key={b.id}><td>{b.nome}</td><td>{l.length}</td><td>{eur(l.reduce((s, m) => s + Number(m.preco), 0))}</td><td>{marcs.filter((m) => m.barbeiro_id === b.id && m.estado === "faltou").length}</td></tr>;
            })}</tbody></table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 12 }}>Horas de maior procura</h3>
        {r.horas.length === 0 ? <p className="muted">Sem dados.</p> : (<>
          <div className="bars">{r.horas.map(([h, v]) => <div key={h} style={{ height: `${(v / maxH) * 100}%` }} title={`${h}: ${v}`} />)}</div>
          <div className="barlbl">{r.horas.map(([h]) => <span key={h}>{h}</span>)}</div>
        </>)}
      </div>
    </div>
  );
}
