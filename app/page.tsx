"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtime, useToast } from "@/lib/hooks";
import type { BarbeiroPublico, Promocao, Servico } from "@/lib/types";
import { addDays, descontoPara, eur, fmtData, fromMin, hhmm, hojeISO, isoDow, parseISO, toMin, waLink } from "@/lib/utils";
import { Empty, Estado, Field, Spinner, Toast, TopBar } from "@/components/ui";

interface MinhaMarcacao {
  id: string; data: string; hora_inicio: string; duracao_min: number; estado: string;
  preco: number; servico_nome: string; barbeiro_nome: string;
}
interface Cartao { nome: string | null; cortes: number; meta: number; progresso: number; gratis: number }
type Cfg = Record<string, string>;

export default function ClienteApp() {
  const [tab, setTab] = useState<"marcar" | "minhas" | "cartao">("marcar");
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [barbeiros, setBarbeiros] = useState<BarbeiroPublico[]>([]);
  const [promos, setPromos] = useState<Promocao[]>([]);
  const [cfg, setCfg] = useState<Cfg>({});
  const [loading, setLoading] = useState(true);
  const { toast, show } = useToast();

  const carregar = useCallback(async () => {
    const hoje = hojeISO();
    const [s, b, p, c] = await Promise.all([
      supabase.from("servicos").select("*").eq("ativo", true).order("ordem").order("nome"),
      supabase.from("barbeiros_publico").select("*").order("nome"),
      supabase.from("promocoes").select("*").eq("ativa", true),
      supabase.from("configuracoes").select("*"),
    ]);
    if (s.data) setServicos(s.data as Servico[]);
    if (b.data) setBarbeiros(b.data as BarbeiroPublico[]);
    if (p.data) setPromos((p.data as Promocao[]).filter((x) => (!x.data_fim || x.data_fim >= hoje) && (!x.data_inicio || x.data_inicio <= hoje)));
    if (c.data) setCfg(Object.fromEntries(c.data.map((r: { chave: string; valor: string }) => [r.chave, r.valor])));
    setLoading(false);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  useRealtime(["servicos", "promocoes", "configuracoes"], carregar, 30000);

  return (
    <>
      <TopBar titulo={cfg.nome_barbearia || "Barbearia"}>
        {cfg.whatsapp && <a className="btn sm" href={waLink(cfg.whatsapp, "Olá! ")} target="_blank" rel="noreferrer">WhatsApp</a>}
      </TopBar>
      <div className="container narrow">
        <div className="hero">
          <h1>Estilo <span className="gold">impecável</span>,<br />sem filas de espera.</h1>
          <p>Marque o seu corte em menos de um minuto{cfg.morada ? ` · ${cfg.morada}` : ""}</p>
        </div>

        {promos.length > 0 && (
          <div className="col" style={{ marginBottom: 16 }}>
            {promos.map((p) => (
              <div className="banner" key={p.id}>
                <div className="pct">-{Number(p.desconto_pct)}%</div>
                <div>
                  <h3>{p.titulo}</h3>
                  {p.descricao && <div className="muted">{p.descricao}</div>}
                  <div className="muted">
                    {p.servico_id ? `Em ${servicos.find((s) => s.id === p.servico_id)?.nome ?? "serviço selecionado"}` : "Em todos os serviços"}
                    {p.data_fim ? ` · até ${fmtData(p.data_fim)}` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="tabs">
          {([["marcar", "Marcar"], ["minhas", "As minhas marcações"], ["cartao", "Fidelidade"]] as const).map(([k, l]) => (
            <button key={k} className={"tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {loading ? <Spinner /> : tab === "marcar" ? (
          <Marcar servicos={servicos} barbeiros={barbeiros} promos={promos} show={show} irMinhas={() => setTab("minhas")} />
        ) : tab === "minhas" ? (
          <Minhas show={show} />
        ) : (
          <Fidelidade />
        )}
      </div>
      <Toast toast={toast} />
    </>
  );
}

/* ---------------------------------------------------------------- */
function usePerfilLocal() {
  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  useEffect(() => {
    try {
      setNome(localStorage.getItem("b_nome") || "");
      setTel(localStorage.getItem("b_tel") || "");
    } catch {}
  }, []);
  const guardar = (n: string, t: string) => {
    setNome(n); setTel(t);
    try { localStorage.setItem("b_nome", n); localStorage.setItem("b_tel", t); } catch {}
  };
  return { nome, tel, guardar };
}

function Marcar({ servicos, barbeiros, promos, show, irMinhas }: {
  servicos: Servico[]; barbeiros: BarbeiroPublico[]; promos: Promocao[];
  show: (t: string, erro?: boolean) => void; irMinhas: () => void;
}) {
  const [step, setStep] = useState(1);
  const [servicoId, setServicoId] = useState<string>("");
  const [barbeiroId, setBarbeiroId] = useState<string>("");
  const [data, setData] = useState<string>("");
  const [hora, setHora] = useState<string>("");
  const perfil = usePerfilLocal();
  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  const [nasc, setNasc] = useState("");
  const [ocupados, setOcupados] = useState<{ hora_inicio: string; duracao_min: number }[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(false);

  useEffect(() => { setNome(perfil.nome); setTel(perfil.tel); }, [perfil.nome, perfil.tel]);

  const servico = servicos.find((s) => s.id === servicoId);
  const barbeiro = barbeiros.find((b) => b.id === barbeiroId);

  const carregarOcupados = useCallback(async () => {
    if (!barbeiroId || !data) return;
    const { data: r } = await supabase.rpc("horarios_ocupados", { p_barbeiro: barbeiroId, p_data: data });
    setOcupados((r as { hora_inicio: string; duracao_min: number }[]) || []);
  }, [barbeiroId, data]);
  useEffect(() => { carregarOcupados(); const i = setInterval(carregarOcupados, 15000); return () => clearInterval(i); }, [carregarOcupados]);

  const dias = useMemo(() => {
    if (!barbeiro) return [];
    const hoje = hojeISO();
    return Array.from({ length: 28 }, (_, i) => addDays(hoje, i)).filter((d) => barbeiro.dias_trabalho.includes(isoDow(d)));
  }, [barbeiro]);

  const slots = useMemo(() => {
    if (!barbeiro || !servico || !data) return [];
    const ini = toMin(barbeiro.hora_abertura), fim = toMin(barbeiro.hora_fecho);
    const now = new Date();
    const agora = data === hojeISO() ? now.getHours() * 60 + now.getMinutes() : -1;
    const out: string[] = [];
    for (let m = ini; m + servico.duracao_min <= fim; m += 30) {
      if (m <= agora) continue;
      const livre = !ocupados.some((o) => toMin(o.hora_inicio) < m + servico.duracao_min && m < toMin(o.hora_inicio) + o.duracao_min);
      if (livre) out.push(fromMin(m));
    }
    return out;
  }, [barbeiro, servico, data, ocupados]);

  const desc = servico && data ? descontoPara(promos, servico.id, data) : 0;
  const preco = servico ? Math.round(Number(servico.preco) * (100 - desc)) / 100 : 0;

  function reset() {
    setStep(1); setServicoId(""); setBarbeiroId(""); setData(""); setHora(""); setFeito(false);
  }

  async function confirmar() {
    setEnviando(true);
    const { error } = await supabase.rpc("criar_marcacao", {
      p_servico: servicoId, p_barbeiro: barbeiroId, p_data: data, p_hora: hora,
      p_nome: nome, p_telefone: tel, p_nascimento: nasc || null,
    });
    setEnviando(false);
    if (error) { show(error.message, true); carregarOcupados(); if (/ocupado|passou/.test(error.message)) setStep(3); return; }
    perfil.guardar(nome, tel);
    setFeito(true);
  }

  if (feito && servico && barbeiro) {
    return (
      <div className="card hl" style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2.4rem" }}>✅</div>
        <h2>Marcação confirmada!</h2>
        <p className="muted" style={{ marginBottom: 14 }}>
          {servico.nome} com {barbeiro.nome}<br />
          <b className="gold">{fmtData(data, true)} às {hora}</b><br />Total: {eur(preco)}
        </p>
        <div className="row wrap" style={{ justifyContent: "center" }}>
          <button className="btn gold" onClick={irMinhas}>Ver as minhas marcações</button>
          <button className="btn" onClick={reset}>Nova marcação</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="steps">{[1, 2, 3, 4].map((i) => <i key={i} className={i <= step ? "on" : ""} />)}</div>

      {step === 1 && (
        <>
          <h2>1. Escolha o serviço</h2>
          {servicos.length === 0 ? <Empty>Sem serviços disponíveis de momento.</Empty> : (
            <div className="col">
              {servicos.map((s) => {
                const d = descontoPara(promos, s.id, hojeISO());
                return (
                  <button key={s.id} className={"opt" + (servicoId === s.id ? " on" : "")}
                    onClick={() => { setServicoId(s.id); setHora(""); setStep(2); }}>
                    <div className="row between">
                      <b>{s.nome}</b>
                      <span className="gold" style={{ fontWeight: 800 }}>
                        {d > 0 && <s style={{ color: "var(--muted)", fontWeight: 400, marginRight: 6 }}>{eur(s.preco)}</s>}
                        {eur(Math.round(Number(s.preco) * (100 - d)) / 100)}
                      </span>
                    </div>
                    {s.descricao && <div className="muted">{s.descricao}</div>}
                    <div className="muted">⏱ {s.duracao_min} min</div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <h2>2. Escolha o barbeiro</h2>
          {barbeiros.length === 0 ? <Empty>Sem barbeiros disponíveis.</Empty> : (
            <div className="col">
              {barbeiros.map((b) => (
                <button key={b.id} className={"opt" + (barbeiroId === b.id ? " on" : "")}
                  onClick={() => { setBarbeiroId(b.id); setData(""); setHora(""); setStep(3); }}>
                  <div className="row">
                    <span className="logo" style={{ width: 42, height: 42, borderRadius: "50%", overflow: "hidden" }}>
                      {b.foto_url ? <img src={b.foto_url} alt="" width={42} height={42} style={{ objectFit: "cover" }} /> : b.nome[0]}
                    </span>
                    <div><b>{b.nome}</b><div className="muted">{hhmm(b.hora_abertura)} – {hhmm(b.hora_fecho)}</div></div>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="sp" /><button className="btn" onClick={() => setStep(1)}>← Voltar</button>
        </>
      )}

      {step === 3 && barbeiro && servico && (
        <>
          <h2>3. Data e hora</h2>
          <div className="days">
            {dias.map((d) => {
              const dt = parseISO(d);
              return (
                <button key={d} className={"day" + (data === d ? " on" : "")} onClick={() => { setData(d); setHora(""); }}>
                  <small>{dt.toLocaleDateString("pt-PT", { weekday: "short" })}</small>
                  <b>{dt.getDate()}</b>
                  <small>{dt.toLocaleDateString("pt-PT", { month: "short" })}</small>
                </button>
              );
            })}
          </div>
          <div className="sp" />
          {data ? (slots.length === 0 ? <Empty>Sem horários livres neste dia. Escolha outra data.</Empty> : (
            <div className="slots">
              {slots.map((h) => (
                <button key={h} className={"slot" + (hora === h ? " on" : "")} onClick={() => setHora(h)}>{h}</button>
              ))}
            </div>
          )) : <p className="muted">Escolha um dia para ver os horários livres.</p>}
          <div className="sp" />
          <div className="row">
            <button className="btn" onClick={() => setStep(2)}>← Voltar</button>
            <button className="btn gold right" disabled={!hora} onClick={() => setStep(4)}>Continuar →</button>
          </div>
        </>
      )}

      {step === 4 && servico && barbeiro && (
        <>
          <h2>4. Os seus dados</h2>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="row between"><b>{servico.nome}</b><b className="gold">{eur(preco)}</b></div>
            <div className="muted">{barbeiro.nome} · {fmtData(data, true)} às {hora}</div>
            {desc > 0 && <div className="muted" style={{ color: "var(--ok)" }}>Promoção aplicada: -{desc}%</div>}
          </div>
          <Field label="Nome"><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="O seu nome" autoComplete="name" /></Field>
          <Field label="WhatsApp"><input className="input" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="912 345 678" inputMode="tel" autoComplete="tel" /></Field>
          <Field label="Data de nascimento (opcional — para prendas de aniversário)"><input className="input" type="date" value={nasc} onChange={(e) => setNasc(e.target.value)} max={hojeISO()} /></Field>
          <div className="row">
            <button className="btn" onClick={() => setStep(3)}>← Voltar</button>
            <button className="btn gold right" disabled={enviando || nome.trim().length < 2 || tel.replace(/\D/g, "").length < 9} onClick={confirmar}>
              {enviando ? "A confirmar…" : "Confirmar marcação"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
function Minhas({ show }: { show: (t: string, erro?: boolean) => void }) {
  const perfil = usePerfilLocal();
  const [tel, setTel] = useState("");
  const [lista, setLista] = useState<MinhaMarcacao[] | null>(null);
  const [telAtivo, setTelAtivo] = useState("");

  useEffect(() => { if (perfil.tel && !tel) setTel(perfil.tel); }, [perfil.tel, tel]);

  const buscar = useCallback(async (t: string) => {
    const { data, error } = await supabase.rpc("minhas_marcacoes", { p_telefone: t });
    if (error) { show(error.message, true); return; }
    setLista(data as MinhaMarcacao[]);
    setTelAtivo(t);
  }, [show]);

  useEffect(() => { if (perfil.tel) buscar(perfil.tel); }, [perfil.tel, buscar]);
  useEffect(() => {
    if (!telAtivo) return;
    const i = setInterval(() => buscar(telAtivo), 20000);
    return () => clearInterval(i);
  }, [telAtivo, buscar]);

  async function cancelar(id: string) {
    if (!confirm("Cancelar esta marcação?")) return;
    const { error } = await supabase.rpc("cancelar_marcacao", { p_id: id, p_telefone: telAtivo });
    if (error) return show(error.message, true);
    show("Marcação cancelada.");
    buscar(telAtivo);
  }

  const hoje = hojeISO();
  const agora = new Date().toTimeString().slice(0, 5);
  const futura = (m: MinhaMarcacao) => m.estado === "marcado" && (m.data > hoje || (m.data === hoje && hhmm(m.hora_inicio) > agora));

  return (
    <div>
      <h2>Consulte as suas marcações</h2>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <Field label="O seu WhatsApp"><input className="input" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="912 345 678" inputMode="tel" /></Field>
        <button className="btn gold" style={{ marginBottom: 12 }} disabled={tel.replace(/\D/g, "").length < 9} onClick={() => { perfil.guardar(perfil.nome, tel); buscar(tel); }}>Ver</button>
      </div>
      {lista && (lista.length === 0 ? <Empty>Não encontrámos marcações para este número.</Empty> : (
        <div className="col">
          {lista.map((m) => (
            <div className="card" key={m.id}>
              <div className="row between">
                <b>{m.servico_nome}</b><Estado e={m.estado} />
              </div>
              <div className="muted">{m.barbeiro_nome} · {fmtData(m.data, true)} às {hhmm(m.hora_inicio)}</div>
              <div className="row between" style={{ marginTop: 8 }}>
                <span className="gold" style={{ fontWeight: 800 }}>{eur(m.preco)}</span>
                {futura(m) && <button className="btn bad sm" onClick={() => cancelar(m.id)}>Cancelar</button>}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */
function Fidelidade() {
  const perfil = usePerfilLocal();
  const [tel, setTel] = useState("");
  const [c, setC] = useState<Cartao | null>(null);
  const [erro, setErro] = useState("");

  const buscar = useCallback(async (t: string) => {
    const { data, error } = await supabase.rpc("cartao_fidelidade", { p_telefone: t });
    if (error) { setErro(error.message); return; }
    setErro(""); setC(data as Cartao);
  }, []);
  useEffect(() => { if (perfil.tel) { setTel(perfil.tel); buscar(perfil.tel); } }, [perfil.tel, buscar]);

  return (
    <div>
      <h2>Cartão de fidelidade</h2>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <Field label="O seu WhatsApp"><input className="input" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="912 345 678" inputMode="tel" /></Field>
        <button className="btn gold" style={{ marginBottom: 12 }} disabled={tel.replace(/\D/g, "").length < 9} onClick={() => { perfil.guardar(perfil.nome, tel); buscar(tel); }}>Ver</button>
      </div>
      {erro && <p className="muted" style={{ color: "var(--bad)" }}>{erro}</p>}
      {c && (
        <div className="loyal">
          <div className="row between">
            <div><div className="muted">CARTÃO DE FIDELIDADE</div><h2 style={{ margin: 0 }}>{c.nome || "Cliente"}</h2></div>
            <span style={{ fontSize: "1.8rem" }}>✂</span>
          </div>
          <div className="stamps" style={{ gridTemplateColumns: `repeat(${Math.min(5, c.meta)}, 1fr)` }}>
            {Array.from({ length: c.meta }, (_, i) => (
              <div key={i} className={"stamp" + (i < c.progresso ? " on" : "")}>{i === c.meta - 1 ? "🎁" : i < c.progresso ? "✓" : ""}</div>
            ))}
          </div>
          <div className="row between">
            <span><b className="gold">{c.progresso}</b> / {c.meta} cortes</span>
            <span className="muted">Total: {c.cortes} cortes concluídos</span>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            {c.meta - c.progresso === 1 ? "O seu próximo corte é GRÁTIS! 🎉" : `Faltam ${c.meta - c.progresso} cortes para o próximo corte grátis.`}
            {c.gratis > 0 && ` Já ganhou ${c.gratis} brinde(s) — fale com o barbeiro.`}
          </p>
        </div>
      )}
    </div>
  );
}
