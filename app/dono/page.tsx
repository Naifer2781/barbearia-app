"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth, useRealtime, useToast } from "@/lib/hooks";
import type { Barbeiro, Promocao, Servico } from "@/lib/types";
import { Spinner, Toast, TopBar } from "@/components/ui";
import AgendaDia from "@/components/AgendaDia";
import Financas from "@/components/dono/Financas";
import Servicos from "@/components/dono/Servicos";
import Equipa from "@/components/dono/Equipa";
import Clientes from "@/components/dono/Clientes";
import Promocoes from "@/components/dono/Promocoes";
import Relatorios from "@/components/dono/Relatorios";
import Definicoes from "@/components/dono/Definicoes";

const TABS = [
  ["agenda", "📅 Agenda"], ["fin", "💶 Finanças"], ["serv", "✂ Serviços"], ["equipa", "👥 Equipa"],
  ["cli", "📇 Clientes"], ["promo", "🏷 Promoções"], ["rel", "📊 Relatórios"], ["cfg", "⚙ Definições"],
] as const;
type Tab = (typeof TABS)[number][0];

export default function PainelDono() {
  const { loading, sair } = useAuth("owner");
  const [tab, setTab] = useState<Tab>("agenda");
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [promos, setPromos] = useState<Promocao[]>([]);
  const { toast, show } = useToast();

  const carregar = useCallback(async () => {
    const [b, s, p] = await Promise.all([
      supabase.from("barbeiros").select("*").order("nome"),
      supabase.from("servicos").select("*").order("ordem").order("nome"),
      supabase.from("promocoes").select("*").order("criado_em", { ascending: false }),
    ]);
    if (b.data) setBarbeiros(b.data as Barbeiro[]);
    if (s.data) setServicos(s.data as Servico[]);
    if (p.data) setPromos(p.data as Promocao[]);
  }, []);
  useEffect(() => { if (!loading) carregar(); }, [loading, carregar]);
  useRealtime(["barbeiros", "servicos", "promocoes"], carregar, 60000);

  if (loading) return <Spinner />;

  return (
    <>
      <TopBar titulo="Painel do Dono"><button className="btn sm" onClick={sair}>Sair</button></TopBar>
      <div className="container">
        <div className="tabs">
          {TABS.map(([k, l]) => <button key={k} className={"tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        {tab === "agenda" && <AgendaDia barbeiros={barbeiros} servicos={servicos} dono show={show} />}
        {tab === "fin" && <Financas barbeiros={barbeiros} show={show} />}
        {tab === "serv" && <Servicos servicos={servicos} recarregar={carregar} show={show} />}
        {tab === "equipa" && <Equipa barbeiros={barbeiros} recarregar={carregar} show={show} />}
        {tab === "cli" && <Clientes show={show} />}
        {tab === "promo" && <Promocoes promos={promos} servicos={servicos} recarregar={carregar} show={show} />}
        {tab === "rel" && <Relatorios barbeiros={barbeiros} />}
        {tab === "cfg" && <Definicoes show={show} />}
      </div>
      <Toast toast={toast} />
    </>
  );
}
