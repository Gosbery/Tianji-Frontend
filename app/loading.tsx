import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return (
    <main className="route-state" role="status" aria-live="polite">
      <LoaderCircle className="spin" size={30} aria-hidden="true" />
      <h1>正在载入工作区</h1>
    </main>
  );
}
