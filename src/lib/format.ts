export const money = (amount: number | undefined, digits = 2) =>
  `\u00a3${new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(amount) || 0)}`;

export const compactMoney = (amount: number | undefined) => money(amount, 0);

export const initials = (name?: string, fallback = "O") =>
  (name || fallback).trim().slice(0, 1).toUpperCase();
