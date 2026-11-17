"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtime } from "@/lib/hooks";
import type { Cliente } from "@/lib/types";
import { addDays, downloadCSV, fmtData, hojeISO, waLink } from "@/lib/utils";
import { Empty } from "../ui";

interface Visita { cliente_id: string | null; data: string }

export default function Clientes({ show }: { show: (t: string, e?: boolean) => void }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [filtro, setFiltro] = useState<"todos" | "inativos" | "aniv">("todos");
  const [q, setQ] = useState("");

  const carregar = useCallback(async () => {
    const [c, v] = await Promise.all([
      supabase.from("clientes").select("*").order("nome"),
      supabase.from("marcacoes").select("cliente_id,data").eq("estado", "concluido"),
    ]);
    if (c.error) return show(c.error.message, true);
    setClientes((c.data as Cliente[]) || []);
    setVisitas((v.data as Visita[]) || []);
  }, [show]);
  useEffect(() => { carregar(); }, [carregar]);
  useRealtime(["clientes", "marcacoes"], carregar, 60000);

  const linhas = useMemo(() => {
    const mapa = new Map<string, { n: number; ultima: string }>();
    for (const v of visitas) {
      if (!v.cliente_id) continue;
      const cur = mapa.get(v.cliente_id) ?? { n: 0, ultima: "" };
      cur.n++; if (v.data > cur.ultima) cur.ultima = v.data;
      mapa.set(v.cliente_id, cur);
    }
    return clientes.map((c) => ({ ...c, visitas: mapa.get(c.id)?.n ?? 0, ultima: mapa.get(c.id)?.ultima ?? "" }));
  }, [clientes, visitas]);

  const hoje = hojeISO();
  const limite = addDays(hoje, -30);
  const mes = hoje.slice(5, 7);

  const filtradas = linhas.filter((c) => {
    if (q && !(c.nome.toLowerCase().includes(q.toLowerCase()) || (c.telefone ?? "").includes(q.replace(/\D/g, "") || "§"))) return false;
    if (filtro === "inativos") return (c.ultima || c.criado_em.slice(0, 10)) < limite;
    if (filtro === "aniv") return c.data_nascimento?.slice(5, 7) === mes;
    return true;
  }).sort((a, b) => filtro === "aniv" ? (a.data_nascimento ?? "").slice(5).localeCompare((b.data_nascimento ?? "").slice(5)) : 0);

  const msg = (c: { nome: string }, tipo: typeof filtro) =>
    tipo === "aniv" ? `Parabéns, ${c.nome.split(" ")[0]}! 🎂 A nossa barbearia tem uma surpresa para si no seu aniversário. Marque a sua visita!`
    : `Olá ${c.nome.split(" ")[0]}! Já não o vemos há algum tempo. 💈 Venha pôr o visual em dia — marque online quando quiser!`;

  return (
    <div>
      <div className="row wrap between" style={{ marginBottom: 12 }}>
        <div className="tabs" style={{ padding: 0 }}>
          {([["todos", `Todos (${linhas.length})`], ["inativos", "Inativos +30 dias"], ["aniv", "Aniversariantes do mês"]] as const).map(([k, l]) => (
            <button key={k} className={"tab" + (filtro === k ? " on" : "")} onClick={() => setFiltro(k)}>{l}</button>
          ))}
        </div>
        <button className="btn sm" onClick={() => downloadCSV("clientes.csv", [["Nome", "Telefone", "Nascimento", "Visitas", "Última visita"], ...filtradas.map((c) => [c.nome, c.telefone ?? "", c.data_nascimento ?? "", c.visitas, c.ultima])])}>⬇ CSV</button>
      </div>
      <input className="input" placeholder="Pesquisar por nome ou telefone…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />
      {filtradas.length === 0 ? <Empty>Nenhum cliente neste filtro.</Empty> : (
        <div className="card scroll-x">
          <table className="tbl">
            <thead><tr><th>Cliente</th><th>Visitas</th><th>Última visita</th><th className="hide-sm">Nascimento</th><th /></tr></thead>
            <tbody>{filtradas.map((c) => (
              <tr key={c.id}>
                <td><b>{c.nome}</b><div className="muted">{c.telefone}</div></td>
                <td>{c.visitas}</td>
                <td>{c.ultima ? fmtData(c.ultima) : "—"}</td>
                <td className="hide-sm">{c.data_nascimento ? c.data_nascimento.split("-").reverse().join("/") : "—"}</td>
                <td>{c.telefone && <a className="btn sm ok" href={waLink(c.telefone, msg(c, filtro))} target="_blank" rel="noreferrer">WhatsApp</a>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
