"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, AlertCircle } from "lucide-react";

export default function AddTicker() {
  const [ticker, setTicker] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (t: string) => api.addTicker(t),
    onSuccess: () => {
      setTicker("");
      setError("");
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["daily-summary"] });
      queryClient.invalidateQueries({ queryKey: ["today-events"] });
      queryClient.invalidateQueries({ queryKey: ["yesterday-events"] });
    },
    onError: (e: Error) => {
      setError(e.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setError("");
    mutation.mutate(t);
  };

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="输入股票代码，如 AAPL、TSLA、MSFT"
          className="flex-1 rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
        />
        <button
          type="submit"
          disabled={mutation.isPending || !ticker.trim()}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all flex items-center gap-2 shrink-0"
        >
          <Plus className="h-4 w-4" />
          {mutation.isPending ? "添加中..." : "添加"}
        </button>
      </form>
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
