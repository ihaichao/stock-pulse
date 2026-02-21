/**
 * API client for Stock Pulse backend.
 *
 * In development, Next.js rewrites /api/* to the Python backend.
 * The auth token is stored in localStorage and sent as Bearer token.
 */

const API_BASE = "/api";

function getToken(): string {
  if (typeof window === "undefined") return "";
  let token = localStorage.getItem("sp_token");
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem("sp_token", token);
  }
  return token;
}

async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
    ...(opts.headers as Record<string, string>),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  return res.json();
}

// --- Types ---

export interface PortfolioItem {
  ticker: string;
  notes: string | null;
  added_at: string;
}

export interface StockEvent {
  id: string;
  ticker: string | null;
  event_type: string;
  event_date: string;
  title: string;
  description: string | null;
  importance: string;
  status: string;
  eps_estimate: number | null;
  eps_actual: number | null;
  revenue_estimate: number | null;
  revenue_actual: number | null;
  report_time: string | null;
  macro_event_name: string | null;
  consensus: string | null;
  actual_value: string | null;
  previous_value: string | null;
  filing_type: string | null;
  filing_url: string | null;
  analyst_firm: string | null;
  from_rating: string | null;
  to_rating: string | null;
  target_price: number | null;
  ai_summary: string | null;
  ai_detail?: string | null;
}

export interface DailySummary {
  date: string;
  total_events: number;
  high_importance: number;
  events: StockEvent[];
  macro_events: StockEvent[];
  portfolio_events: StockEvent[];
}

export interface StockProfile {
  ticker: string;
  company_name: string;
  long_name: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
  website: string | null;
  description: string | null;
  current_price: number | null;
  previous_close: number | null;
  market_cap: number | null;
  currency: string;
  price_change: number | null;
  price_change_percent: number | null;
  pe_ratio: number | null;
  forward_pe: number | null;
  eps_ttm: number | null;
  dividend_yield: number | null;
  beta: number | null;
  fifty_two_week_high: number | null;
  fifty_two_week_low: number | null;
  avg_volume: number | null;
  earnings_date: string | null;
}

export interface EarningsHistoryItem {
  event_date: string;
  eps_estimate: number | null;
  eps_actual: number | null;
  revenue_estimate: number | null;
  revenue_actual: number | null;
  beat: boolean | null;
  surprise_percent: number | null;
  status: string;
}

export interface EarningsHistory {
  ticker: string;
  history: EarningsHistoryItem[];
  beat_rate: number | null;
  total_quarters: number;
}

// --- API calls ---

export const api = {
  // Portfolio
  getPortfolio: () => apiFetch<PortfolioItem[]>("/portfolio"),
  addTicker: (ticker: string) =>
    apiFetch<PortfolioItem>("/portfolio", {
      method: "POST",
      body: JSON.stringify({ ticker }),
    }),
  removeTicker: (ticker: string) =>
    apiFetch<void>(`/portfolio/${ticker}`, { method: "DELETE" }),

  // Events
  getUpcoming: () => apiFetch<StockEvent[]>("/events/upcoming"),
  getToday: () => apiFetch<StockEvent[]>("/events/today"),
  getYesterday: () => apiFetch<StockEvent[]>("/events/yesterday"),
  getStockEvents: (ticker: string) => apiFetch<StockEvent[]>(`/events/stock/${ticker}`),
  getEventDetail: (id: string) => apiFetch<StockEvent>(`/events/${id}`),

  // Daily summary
  getDailySummary: () => apiFetch<DailySummary>("/daily-summary"),

  // Macro
  getMacroCalendar: (month?: string) =>
    apiFetch<StockEvent[]>(`/macro/calendar${month ? `?month=${month}` : ""}`),

  // Stock profile
  getStockProfile: (ticker: string) =>
    apiFetch<StockProfile>(`/stock/${ticker}/profile`),
  getEarningsHistory: (ticker: string) =>
    apiFetch<EarningsHistory>(`/stock/${ticker}/earnings-history`),
};

