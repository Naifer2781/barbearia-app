"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Field } from "@/components/ui";

export default function Entrar() {
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState<{ t: string; erro: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendente, setPendente] = useState(false);

  async function destino() {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    const { data } = await supabase.from("profiles").select("role").eq("id", s.session.user.id).maybeSingle();
    if (data?.role === "owner") router.replace("/dono");
    else if (data?.role === "barbeiro") router.replace("/barbeiro");
    else setPendente(true);
  }
  useEffect(() => { destino(); /* eslint-disable-next-line */ }, []);

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    if (modo === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) setMsg({ t: error.message === "Invalid login credentials" ? "Email ou palavra-passe incorretos." : error.message, erro: true });
      else await destino();
    } else {
      if (nome.trim().length < 3) { setMsg({ t: "Indique o seu nome completo.", erro: true }); setBusy(false); return; }
      if (tel.replace(/\D/g, "").length < 9) { setMsg({ t: "Indique um número de telemóvel (WhatsApp) válido.", erro: true }); setBusy(false); return; }
      const { data, error } = await supabase.auth.signUp({
        email, password: pass,
        options: { data: { nome: nome.trim(), telefone: tel.trim() } },
      });
      if (error) setMsg({ t: error.message, erro: true });
      else if (!data.session) setMsg({ t: "Conta criada! Confirme o seu email (se pedido) e depois entre.", erro: false });
      else await destino();
    }
    setBusy(false);
  }

  return (
    <div className="container narrow" style={{ paddingTop: 48 }}>
      <div className="brand" style={{ marginBottom: 20 }}><span className="logo">✂</span> Acesso da equipa</div>
      {pendente ? (
        <div className="card hl">
          <h2>À espera de aprovação</h2>
          <p className="muted">A sua conta foi criada, mas ainda não está associada a um barbeiro. Peça ao dono para a ativar em <b>Equipa</b>.</p>
          <div className="sp" />
          <div className="row">
            <button className="btn" onClick={destino}>Verificar novamente</button>
            <button className="btn" onClick={async () => { await supabase.auth.signOut(); setPendente(false); }}>Sair</button>
          </div>
        </div>
      ) : (
        <form className="card" onSubmit={submeter}>
          <div className="tabs" style={{ paddingTop: 0 }}>
            <button type="button" className={"tab" + (modo === "entrar" ? " on" : "")} onClick={() => setModo("entrar")}>Entrar</button>
            <button type="button" className={"tab" + (modo === "criar" ? " on" : "")} onClick={() => setModo("criar")}>Criar conta</button>
          </div>
          {modo === "criar" && (
            <>
              <Field label="Nome completo"><input className="input" required value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" /></Field>
              <Field label="Telemóvel (WhatsApp)"><input className="input" required value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="Ex.: 77 123 45 67" /></Field>
            </>
          )}
          <Field label="Email"><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
          <Field label="Palavra-passe"><input className="input" type="password" required minLength={6} value={pass} onChange={(e) => setPass(e.target.value)} autoComplete={modo === "entrar" ? "current-password" : "new-password"} /></Field>
          {msg && <p style={{ color: msg.erro ? "var(--bad)" : "var(--ok)", marginBottom: 12 }}>{msg.t}</p>}
          <button className="btn gold block" disabled={busy}>{busy ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Criar conta"}</button>
          {modo === "criar" && <p className="muted" style={{ marginTop: 10 }}>A primeira conta criada torna-se o Dono. As seguintes ficam pendentes até o dono as associar a um barbeiro.</p>}
        </form>
      )}
      <p style={{ marginTop: 18 }}><a href="/">← Voltar à app de marcações</a></p>
    </div>
  );
}
