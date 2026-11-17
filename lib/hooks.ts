"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabase";
import type { Profile } from "./types";

/** Volta a carregar dados sempre que alguma das tabelas mudar (Supabase Realtime) + polling de segurança. */
export function useRealtime(tables: string[], onChange: () => void, pollMs = 30000) {
  const cb = useRef(onChange);
  cb.current = onChange;
  const key = tables.join(",");
  useEffect(() => {
    const ch = supabase.channel("rt-" + key + "-" + Math.random().toString(36).slice(2));
    let t: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => cb.current(), 150);
    };
    for (const table of key.split(",")) {
      ch.on("postgres_changes", { event: "*", schema: "public", table }, fire);
    }
    ch.subscribe();
    const iv = setInterval(() => cb.current(), pollMs);
    return () => {
      if (t) clearTimeout(t);
      clearInterval(iv);
      supabase.removeChannel(ch);
    };
  }, [key, pollMs]);
}

/** Garante sessão e papel. Redireciona para /entrar se necessário. */
export function useAuth(papel: "owner" | "barbeiro") {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    async function carregar() {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) { router.replace("/entrar"); return; }
      const { data } = await supabase.from("profiles").select("*").eq("id", s.session.user.id).maybeSingle();
      if (!vivo) return;
      if (!data || data.role === "pendente") { router.replace("/entrar"); return; }
      if (data.role !== papel) { router.replace(data.role === "owner" ? "/dono" : "/barbeiro"); return; }
      setProfile(data as Profile);
      setLoading(false);
    }
    carregar();
    const { data: sub } = supabase.auth.onAuthStateChange((ev) => {
      if (ev === "SIGNED_OUT") router.replace("/entrar");
    });
    return () => { vivo = false; sub.subscription.unsubscribe(); };
  }, [papel, router]);

  const sair = useCallback(async () => { await supabase.auth.signOut(); router.replace("/entrar"); }, [router]);
  return { profile, loading, sair };
}

export function useToast() {
  const [msg, setMsg] = useState<{ t: string; erro?: boolean } | null>(null);
  const show = useCallback((t: string, erro = false) => {
    setMsg({ t, erro });
    setTimeout(() => setMsg(null), 3500);
  }, []);
  return { toast: msg, show };
}
