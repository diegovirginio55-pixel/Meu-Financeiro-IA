import type { Card, Goal, Transaction } from "../types";

let counter = 0;

export function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  counter += 1;
  return {
    id: `tx-${counter}`,
    user_id: "user-1",
    description: "Lançamento de teste",
    amount: 100,
    type: "saida",
    category: "Outros",
    date: "2026-01-15",
    account_id: null,
    card_id: null,
    pluggy_transaction_id: null,
    source: "manual",
    created_at: "2026-01-15T12:00:00.000Z",
    ...overrides,
  };
}

export function makeCard(overrides: Partial<Card> = {}): Card {
  counter += 1;
  return {
    id: `card-${counter}`,
    user_id: "user-1",
    name: "Cartão teste",
    credit_limit: 1000,
    closing_day: 20,
    due_day: 10,
    current_invoice: 0,
    pluggy_account_id: null,
    bank_connection_id: null,
    source: "manual",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeGoal(overrides: Partial<Goal> = {}): Goal {
  counter += 1;
  return {
    id: `goal-${counter}`,
    user_id: "user-1",
    name: "Meta teste",
    target_amount: 1000,
    current_amount: 0,
    deadline: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
