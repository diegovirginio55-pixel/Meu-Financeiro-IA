export type TransactionType = "entrada" | "saida";

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: string;
  balance: number;
  pluggy_account_id: string | null;
  bank_connection_id: string | null;
  source: "manual" | "pluggy";
  created_at: string;
  updated_at: string;
  institution_name?: string | null;
}

export interface Card {
  id: string;
  user_id: string;
  name: string;
  credit_limit: number | null;
  closing_day: number | null;
  due_day: number | null;
  current_invoice: number;
  pluggy_account_id: string | null;
  bank_connection_id: string | null;
  source: "manual" | "pluggy";
  created_at: string;
  updated_at: string;
  institution_name?: string | null;
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
  pluggy_transaction_id: string | null;
  source: "chat" | "manual" | "pluggy";
  created_at: string;
}

export interface BankConnection {
  id: string;
  user_id: string;
  pluggy_item_id: string;
  institution_name: string;
  institution_image_url: string | null;
  status: string;
  status_detail: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
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
  amount_profit?: number | null;
  amount_original?: number | null;
  last_month_rate?: number | null;
  pluggy_investment_id?: string | null;
  bank_connection_id?: string | null;
  source?: "manual" | "pluggy";
  updated_at: string;
}

export interface InvestmentSnapshot {
  id: string;
  investment_id: string;
  bank_connection_id: string | null;
  snapshot_date: string;
  amount: number;
  amount_profit: number | null;
}

export interface InvestmentTxn {
  id: string;
  investment_id: string | null;
  bank_connection_id: string | null;
  type: string;
  amount: number;
  date: string;
}

export interface ChatMessageRow {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  tool_calls: unknown;
  created_at: string;
}
