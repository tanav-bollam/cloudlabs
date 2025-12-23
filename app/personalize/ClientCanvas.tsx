"use client";

import dynamic from "next/dynamic";

const CanvasStage = dynamic(() => import("@/components/CanvasStage"), {
  ssr: false,
  loading: () => <div />,
});

export default function ClientCanvas() {
  return <CanvasStage />;
}
