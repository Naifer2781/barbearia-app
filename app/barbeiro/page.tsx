"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth, useRealtime, useToast } from "@/lib/hooks";
import type { Barbeiro, Marcacao, Servico } from "@/lib/types";
import { addDays, eur, hojeISO, parseISO, toISO } from "@/lib/utils";
import { Spinner, Toast, TopBar } from "@/components/ui";
import AgendaDia from "@/components/AgendaDia";

export default function PainelBarbeiro() {
  const { profile, loading, sair } = useAuth("barbeiro");
  const [tab, setTab] = useState<"agenda" | "fat">("agenda");
  const [eu, setEu] = useState<Barbeiro | null>(null);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const { toast, show } = useToast();

  useEffect(() => {
    if (!profile?.barbeiro_id) return;
    supabase.from("barbeiros").select("*").eq("id", profile.barbeiro_id).maybeSingle().then(({ data }) => data && setEu(data as Barbeiro));
    supabase.from("servicos").select("*").eq("ativo", true).order("ordem").then(({ data }) => data && setServicos(data as Servico[]));
  }, [profile]);

  if (loading || !eu) return <Spinner />;

  return (
    <>
      <TopBar titulo={`Olá, ${eu.nome.split(" ")[0]}`}><button className="btn sm" onClick={sair}>Sair</button></TopBar>
      <div className="container">
        <div className="tabs">
          <button className={"tab" + (tab === "agenda" ? " on" : "")} onClick={() => setTab("agenda")}>A minha agenda</button>
          <button className={"tab" + (tab === "fat" ? " on" : "")} onClick={() => setTab("fat")}>Faturação & comissão</button>
        </div>
        {tab === "agenda" ? <AgendaDia barbeiros={[eu]} servicos={servicos} dono={false} show={show} /> : <Faturacao eu={eu} />}
      </div>
      <Toast toast={toast} />
    </>
  );
}

function Faturacao({ eu }: { eu: Barbeiro }) {
  const [per, setPer] = useState<"hoje" | "semana" | "mes">("mes");
  const [lista, setLista] = useState<Marcacao[]>([]);

  const { de, ate } = useMemo(() => {
    const h = hojeISO(); const d = parseISO(h);
    if (per === "hoje") return { de: h, ate: h };
    if (per === "semana") { const dow = (d.getDay() + 6) % 7; return { de: addDays(h, -dow), ate: addDays(h, 6 - dow) }; }
    return { de: toISO(new Date(d.getFullYear(), d.getMonth(), 1)), ate: toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
  }, [per]);

  const carregar = useCallback(async () => {
    const { data } = await supabase.from("marcacoes").select("*").eq("estado", "concluido").gte("data", de).lte("data", ate).order("data", { ascending: false }).order("hora_inicio", { ascending: false });
    if (data) setLista(data as Marcacao[]);
  }, [de, ate]);
  useEffect(() => { carregar(); }, [carregar]);
  useRealtime(["marcacoes"], carregar);

  const fat = lista.reduce((s, m) => s + Number(m.preco), 0);
  const com = lista.reduce((s, m) => s + Number(m.comissao_valor), 0);

  return (
    <div>
      <div className="tabs" style={{ paddingTop: 0 }}>
        {([["hoje", "Hoje"], ["semana", "Esta semana"], ["mes", "Este mês"]] as const).map(([k, l]) => (
          <button key={k} className={"tab" + (per === k ? " on" : "")} onClick={() => setPer(k)}>{l}</button>
        ))}
      </div>
      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="stat"><div className="l">Cortes</div><div className="v">{lista.length}</div></div>
        <div className="stat"><div className="l">Faturação</div><div className="v">{eur(fat)}</div></div>
        <div className="stat"><div className="l">Comissão ({Number(eu.comissao_pct)}%)</div><div className="v gold">{eur(com)}</div></div>
      </div>
      <h3 style={{ marginBottom: 8 }}>Detalhe</h3>
      {lista.length === 0 ? <div className="empty">Sem cortes concluídos neste período.</div> : (
        <div className="card scroll-x">
          <table className="tbl">
            <thead><tr><th>Data</th><th>Cliente</th><th>Serviço</th><th>Valor</th><th>Comissão</th></tr></thead>
            <tbody>{lista.map((m) => (
              <tr key={m.id}><td>{m.data.slice(5).split("-").reverse().join("/")} {m.hora_inicio.slice(0, 5)}</td><td>{m.cliente_nome}</td><td>{m.servico_nome}</td><td>{eur(m.preco)}</td><td className="gold">{eur(m.comissao_valor)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
