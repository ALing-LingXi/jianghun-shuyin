"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Headphones,
  Home,
  Library,
  ScrollText,
  Upload,
} from "lucide-react";
import Aurora from "@/components/Aurora";

const navigation = [
  { href: "/", label: "魂殿", icon: Home },
  { href: "/books", label: "听书", icon: Headphones },
  { href: "/upload", label: "炼音", icon: Upload },
  { href: "/reading", label: "阅读", icon: BookOpen },
  { href: "/reading/upload", label: "藏书", icon: Library },
] as const;

export function DemonAppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="demon-app-frame">
      <div className="demon-backdrop" aria-hidden="true">
        <div className="demon-aurora">
          <Aurora
            colorStops={["#ff2aa3", "#6f1cd8", "#ff7867"]}
            amplitude={0.75}
            blend={0.72}
            speed={0.45}
          />
        </div>
        <Image
          className="demon-sky-image"
          src="/assets/backgrounds/bg_top.png"
          alt=""
          fill
          sizes="100vw"
          unoptimized
        />
        <div className="demon-scanlines" />
      </div>

      <aside className="demon-side-nav" aria-label="主导航">
        <Link className="demon-brand-mark" href="/" aria-label="匠魂书音首页">
          <span>匠</span>
          <small>JH</small>
        </Link>

        <nav className="demon-nav-list">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                className={`demon-nav-link ${active ? "is-active" : ""}`}
                href={item.href}
              >
                <span className="demon-nav-diamond" aria-hidden="true">
                  <Icon />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="demon-nav-familiar" aria-hidden="true">
          <Image
            src="/assets/images/小恶魔/viewcounter_guy.png"
            alt=""
            width={96}
            height={66}
            unoptimized
          />
          <span>
            <ScrollText />
            LOCAL
          </span>
        </div>
      </aside>

      <div className="demon-mobile-nav">
        <Link className="demon-mobile-brand" href="/">
          匠魂书音
        </Link>
        <nav aria-label="移动端主导航">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                className={active ? "is-active" : ""}
                href={item.href}
                aria-label={item.label}
              >
                <Icon />
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="demon-content">{children}</div>
    </div>
  );
}
