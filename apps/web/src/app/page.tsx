export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          📡 Stock Pulse
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Event-driven stock alerts — never miss what matters to your portfolio.
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <a
            href="/today"
            className="rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition"
          >
            Today&apos;s Events
          </a>
          <a
            href="/macro"
            className="rounded-lg border border-gray-300 px-6 py-3 font-medium hover:bg-gray-100 transition"
          >
            Macro Calendar
          </a>
        </div>
      </div>
    </main>
  );
}
