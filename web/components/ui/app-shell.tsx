import Link from "next/link";
import { NetworkNotice } from "./network-notice";
import type { ReactNode } from "react";
import { ArrowLeft, Cube } from "@phosphor-icons/react/dist/ssr";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand-mark" href="/" aria-label="声音积木首页">
      <span className="brand-cube" aria-hidden="true"><Cube weight="fill" /></span>
      {!compact && <span>声音积木</span>}
    </Link>
  );
}

export function AppShell({
  children,
  backHref,
  headerAction,
  className = "",
}: {
  children: ReactNode;
  backHref?: string;
  headerAction?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`app-shell ${className}`}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="app-header">
        {backHref ? (
          <Link href={backHref} className="icon-button" aria-label="返回">
            <ArrowLeft weight="bold" />
          </Link>
        ) : (
          <BrandMark />
        )}
        <div className="header-action">{headerAction}</div>
      </header>
      <main className="app-main"><NetworkNotice />{children}</main>
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

export function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="page-intro">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
  );
}
