"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { codigoDe, telInicial, TelValue } from "@/lib/ddi";
import { DdiSelect } from "../TelefoneInput";
import { Field } from "../ui";

export default function Definicoes({ show }: { show: (t: string, e?: boolean) => void }) {
  const [ddi, setDdi] = useState<TelValue>(telInicial("245"));
  const [nome, setNome] = useState("");
  const [hero, setHero] = useState("");
  const [pronto, setPronto] = useState(false);
  const [busy, setBusy] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from("configuracoes").select("*");
    if (error) return show(error.message, true);
    const c = Object.fromEntries((data ?? []).map((r: { chave: string; valor: string }) => [r.chave, r.valor]));
    setDdi(telInicial(c.ddi_padrao));
    setNome(c.nome_barbearia ?? "");
    setHero(c.hero_url ?? "");
    setPronto(true);
  }, [show]);
  useEffect(() => { carregar(); }, [carregar]);

  async function guardar() {
    const codigo = codigoDe(ddi);
    if (!/^\d{1,4}$/.test(codigo)) return show("Indique um indicativo válido (1 a 4 dígitos).", true);
    if (nome.trim().length < 2) return show("Indique o nome da barbearia.", true);
    if (hero.trim() && !/^https:\/\//i.test(hero.trim())) return show("O endereço da fotografia tem de começar por https://", true);
    setBusy(true);
    const { error } = await supabase.from("configuracoes").upsert([
      { chave: "ddi_padrao", valor: codigo },
      { chave: "nome_barbearia", valor: nome.trim() },
      { chave: "hero_url", valor: hero.trim() },
    ], { onConflict: "chave" });
    setBusy(false);
    if (error) return show(error.message, true);
    show("Definições guardadas ✓");
  }

  return (
    <div className="narrow" style={{ maxWidth: 560 }}>
      <h2>Definições</h2>
      <div className="card">
        <div className="field">
          <label>Indicativo padrão do WhatsApp</label>
          <div className="row" style={{ alignItems: "stretch", gap: 8 }}>
            <DdiSelect value={ddi} onChange={setDdi} />
          </div>
          <p className="muted" style={{ marginTop: 6 }}>
            Aparece pré-selecionado aos clientes na marcação e nos encaixes. O cliente pode escolher outro país.
          </p>
        </div>
        <Field label="Nome da barbearia (usado nas mensagens de lembrete)">
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        <Field label="Fotografia do topo da página inicial (endereço https://…, opcional)">
          <input className="input" value={hero} onChange={(e) => setHero(e.target.value)} placeholder="https://…/barbearia.jpg" inputMode="url" />
        </Field>
        <button className="btn gold" disabled={!pronto || busy} onClick={guardar}>Guardar definições</button>
      </div>
    </div>
  );
}
