"use client";

import LeftToolbar from "@/components/LeftToolbar";
import RightPanel3D from "@/components/RightPanel3D";
import TopBar from "@/components/TopBar";
import PropertiesPanel from "@/components/PropertiesPanel";

import ClientCanvas from "./ClientCanvas";

export default function PersonalizePage() {
  return (
    <main className="grid min-h-screen grid-rows-[auto_1fr] bg-slate-100">
      <TopBar />
      <section className="grid flex-1 content-start gap-4 p-4 md:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_320px]">
        <div className="order-2 md:order-1">
          <LeftToolbar />
        </div>
        <div className="order-1 flex flex-col md:order-2">
          <ClientCanvas />
        </div>
        <div className="order-3 md:col-span-2 xl:col-span-1">
          <RightPanel3D />
        </div>
      </section>
      <PropertiesPanel />
    </main>
  );
}
