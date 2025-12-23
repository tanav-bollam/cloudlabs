"use client";

import dynamic from "next/dynamic";

const RightPanel3DClient = dynamic(() => import("./RightPanel3DClient"), {
  ssr: false,
  loading: () => (
    <aside className="flex h-full w-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur">
      <header className="flex items-center justify-between">
        <div className="h-6 w-32 rounded-full bg-slate-200" />
        <div className="h-6 w-24 rounded-full bg-slate-200" />
      </header>
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex-1 rounded-xl border border-slate-200 bg-slate-100" />
        <div className="h-10 rounded-full bg-slate-100" />
      </div>
      <div className="h-4 w-48 rounded bg-slate-100" />
    </aside>
  ),
});

export default function RightPanel3D() {
  return <RightPanel3DClient />;
}
