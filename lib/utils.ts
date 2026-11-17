import type { Promocao } from "./types";

export const eur = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(Number(n || 0));

export const pad = (n: number) => String(n).padStart(2, "0");

export function toISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const hojeISO = () => toISO(new Date());
export function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(s: string, n: number) {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
/** 1=Segunda ... 7=Domingo */
export function isoDow(s: string) {
  const w = parseISO(s).getDay();
  return w === 0 ? 7 : w;
}
export function fmtData(s: string, long = false) {
  return parseISO(s).toLocaleDateString("pt-PT", long
    ? { weekday: "long", day: "numeric", month: "long" }
    : { weekday: "short", day: "numeric", month: "short" });
}
export const hhmm = (t: string) => t.slice(0, 5);
export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
export const fromMin = (n: number) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;

export const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function normTel(t: string) {
  let d = t.replace(/\D/g, "").replace(/^00/, "");
  if (d.length === 9) d = "351" + d;
  return d;
}

export function descontoPara(promos: Promocao[], servicoId: string, data: string) {
  let best = 0;
  for (const p of promos) {
    if (!p.ativa) continue;
    if (p.data_inicio && data < p.data_inicio) continue;
    if (p.data_fim && data > p.data_fim) continue;
    if (p.servico_id && p.servico_id !== servicoId) continue;
    best = Math.max(best, Number(p.desconto_pct));
  }
  return best;
}

export function waLink(tel: string | null, msg = "") {
  if (!tel) return "#";
  return `https://wa.me/${tel}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;
}

export function downloadCSV(nome: string, linhas: (string | number)[][]) {
  const csv = linhas
    .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  URL.revokeObjectURL(a.href);
}
