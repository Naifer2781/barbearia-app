export type Estado = "marcado" | "concluido" | "faltou" | "cancelado";

export interface Servico {
  id: string; nome: string; descricao: string | null; preco: number;
  duracao_min: number; ativo: boolean; ordem: number;
}
export interface BarbeiroPublico {
  id: string; nome: string; foto_url: string | null;
  hora_abertura: string; hora_fecho: string; dias_trabalho: number[];
}
export interface Barbeiro extends BarbeiroPublico {
  comissao_pct: number; ativo: boolean;
}
export interface Promocao {
  id: string; titulo: string; descricao: string | null; desconto_pct: number;
  servico_id: string | null; data_inicio: string | null; data_fim: string | null; ativa: boolean;
}
export interface Marcacao {
  id: string; cliente_id: string | null; cliente_nome: string; cliente_telefone: string | null;
  barbeiro_id: string; servico_id: string | null; servico_nome: string | null;
  data: string; hora_inicio: string; duracao_min: number; preco: number;
  desconto_pct: number; comissao_pct: number; comissao_valor: number;
  estado: Estado; encaixe: boolean; cancelado_por: "cliente" | "barbeiro" | "dono" | null;
}
export interface Bloqueio {
  id: string; barbeiro_id: string | null; data: string;
  hora_inicio: string; hora_fim: string; motivo: string | null;
}
export interface Cliente {
  id: string; nome: string; telefone: string | null; data_nascimento: string | null;
  notas: string | null; criado_em: string;
}
export interface Despesa {
  id: string; descricao: string; categoria: string; valor: number; data: string;
}
export interface Profile {
  id: string; email: string | null; nome: string | null; telefone: string | null; role: "owner" | "barbeiro" | "pendente";
  barbeiro_id: string | null;
}
