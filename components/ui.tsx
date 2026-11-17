"use client";
import { ReactNode } from "react";

export function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>{titulo}</h2>
          <button className="btn sm" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast({ toast }: { toast: { t: string; erro?: boolean } | null }) {
  return toast ? <div className={"toast" + (toast.erro ? " erro" : "")}>{toast.t}</div> : null;
}

export const Spinner = () => <div className="spin" />;

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}

export function Estado({ e }: { e: string }) {
  const t: Record<string, string> = { marcado: "Marcado", concluido: "Concluído", faltou: "Faltou", cancelado: "Cancelado" };
  return <span className={"badge " + e}>{t[e] ?? e}</span>;
}

export function TopBar({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="topbar"><div className="in">
      <div className="brand"><span className="logo">✂</span><span>{titulo}</span></div>
      <div className="row">{children}</div>
    </div></div>
  );
}
