import { ArrowLeft, CircleHelp } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="route-state">
      <CircleHelp size={30} aria-hidden="true" />
      <h1>没有找到这个页面</h1>
      <p>该地址不存在或已经被移除。</p>
      <Link className="secondary-button" href="/">
        <ArrowLeft size={15} aria-hidden="true" />
        返回工作区
      </Link>
    </main>
  );
}
