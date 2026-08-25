export default function AppLoading() {
  return (
    <div className="animate-pulse px-1 pt-6 lg:pt-2">
      <div className="h-3 w-24 rounded-full bg-zinc-800" />
      <div className="mt-5 h-12 w-56 rounded-2xl bg-zinc-800" />
      <div className="mt-3 h-4 w-40 rounded-full bg-zinc-800/80" />
      <div className="mt-8 grid grid-cols-2 gap-3">
        <div className="h-24 rounded-3xl bg-zinc-900" />
        <div className="h-24 rounded-3xl bg-zinc-900" />
      </div>
      <div className="mt-4 h-48 rounded-[28px] bg-zinc-900" />
    </div>
  );
}
