"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import AddTicker from "@/components/AddTicker";
import Link from "next/link";

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: portfolio, isLoading } = useQuery({
    queryKey: ["portfolio"],
    queryFn: api.getPortfolio,
  });

  const removeMutation = useMutation({
    mutationFn: (ticker: string) => api.removeTicker(ticker),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">⚙️ 持仓管理</h1>
        <p className="text-gray-500 mt-1">添加你持有或关注的美股，系统会自动追踪相关事件</p>
      </div>

      {/* Add ticker */}
      <div className="rounded-lg border p-4 bg-white">
        <h3 className="font-semibold text-sm text-gray-700 mb-3">添加股票</h3>
        <AddTicker />
      </div>

      {/* Portfolio list */}
      <div className="rounded-lg border bg-white">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm text-gray-700">
            我的持仓 ({portfolio?.length || 0})
          </h3>
        </div>

        {isLoading ? (
          <div className="p-4 text-gray-400 text-sm">加载中...</div>
        ) : portfolio && portfolio.length > 0 ? (
          <div className="divide-y">
            {portfolio.map((item) => (
              <div
                key={item.ticker}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Link
                    href={`/stock/${item.ticker}`}
                    className="font-semibold text-brand-600 hover:underline"
                  >
                    {item.ticker}
                  </Link>
                  <span className="text-xs text-gray-400">
                    添加于 {new Date(item.added_at).toLocaleDateString("zh-CN")}
                  </span>
                </div>
                <button
                  onClick={() => removeMutation.mutate(item.ticker)}
                  disabled={removeMutation.isPending}
                  className="text-xs text-red-500 hover:text-red-700 transition"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400 text-sm">
            还没有添加任何股票
          </div>
        )}
      </div>
    </div>
  );
}
