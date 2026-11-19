/** Indicativos disponíveis no seletor. "outro" permite digitar um código diferente. */
export const DDIS: { code: string; iso: string }[] = [
  { code: "245", iso: "GNB" }, { code: "221", iso: "SEN" }, { code: "351", iso: "PRT" },
  { code: "238", iso: "CPV" }, { code: "244", iso: "AGO" }, { code: "33", iso: "FRA" }, { code: "55", iso: "BRA" },
];
export const DDI_PADRAO = "245";

export interface TelValue { ddi: string; outro: string; numero: string }

const soDigitos = (s: string) => s.replace(/\D/g, "");

/** Valor inicial a partir do indicativo configurado (pode ser um código fora da lista). */
export function telInicial(ddiPadrao?: string | null): TelValue {
  const d = soDigitos(ddiPadrao || DDI_PADRAO) || DDI_PADRAO;
  return DDIS.some((x) => x.code === d) ? { ddi: d, outro: "", numero: "" } : { ddi: "outro", outro: d, numero: "" };
}

export const codigoDe = (v: TelValue) => (v.ddi === "outro" ? soDigitos(v.outro) : v.ddi);

/**
 * Número local limpo: sem espaços, traços, parênteses, pontos, "+" e sem zeros à esquerda.
 * Se o cliente colar o número já com "+indicativo" ou "00indicativo", o indicativo é removido
 * (para não ficar duplicado).
 */
export function limparLocal(raw: string, codigo = "") {
  const t = raw.trim();
  let d = soDigitos(t);
  if ((t.startsWith("+") || t.startsWith("00")) && codigo) {
    d = d.replace(/^00/, "");
    if (d.startsWith(codigo)) d = d.slice(codigo.length);
  }
  return d.replace(/^0+/, "");
}

/** Número internacional limpo, ex.: 245955123456. Vazio se faltar indicativo ou número. */
export function telefoneFinal(v: TelValue) {
  const c = codigoDe(v);
  const l = limparLocal(v.numero, c);
  return c && l ? c + l : "";
}

export function telefoneValido(v: TelValue) {
  const c = codigoDe(v);
  const l = limparLocal(v.numero, c);
  return c.length >= 1 && c.length <= 4 && l.length >= 6 && (c + l).length >= 9 && (c + l).length <= 15;
}

const CHAVES = { ddi: "b_ddi", outro: "b_outro", numero: "b_num", legado: "b_tel" };

export function lerTelGuardado(ddiPadrao?: string | null): TelValue | null {
  try {
    const numero = localStorage.getItem(CHAVES.numero);
    if (numero) {
      return { ddi: localStorage.getItem(CHAVES.ddi) || telInicial(ddiPadrao).ddi, outro: localStorage.getItem(CHAVES.outro) || "", numero };
    }
    const legado = soDigitos(localStorage.getItem(CHAVES.legado) || "");  // versão antiga: número guardado todo junto
    if (legado) {
      if (legado.length === 12 && legado.startsWith("351")) return { ddi: "351", outro: "", numero: legado.slice(3) };
      return { ...telInicial(ddiPadrao), numero: legado };
    }
  } catch {}
  return null;
}

export function guardarTel(v: TelValue) {
  try {
    localStorage.setItem(CHAVES.ddi, v.ddi); localStorage.setItem(CHAVES.outro, v.outro);
    localStorage.setItem(CHAVES.numero, v.numero);
  } catch {}
}
