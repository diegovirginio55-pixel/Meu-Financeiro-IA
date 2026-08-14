export type TransactionType = "entrada" | "saida";

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface Card {
  id: string;
  user_id: string;
  name: string;
  credit_limit: number | null;
  closing_day: number | null;
  due_day: number | null;
  current_invoice: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  account_id: string | null;
  card_id: string | null;
  source: "chat" | "manual";
  created_at: string;
}

export interface RecurringItem {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  day_of_month: number;
  active: boolean;
  created_at: string;
}

export interface Debt {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  person: string | null;
  due_date: string | null;
  paid: boolean;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  created_at: string;
}

export interface Investment {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  type: string | null;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  tool_calls: unknown;
  created_at: string;
}
