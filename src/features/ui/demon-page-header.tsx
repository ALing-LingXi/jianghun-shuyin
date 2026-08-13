import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import ShinyText from "@/components/ShinyText";

export function DemonPageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  backHref,
  backLabel = "返回",
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="demon-page-header">
      <div className="min-w-0">
        {backHref ? (
          <Link className="demon-back-link" href={backHref}>
            <ArrowLeft aria-hidden="true" />
            {backLabel}
          </Link>
        ) : null}
        <p className="demon-eyebrow">
          {Icon ? <Icon aria-hidden="true" /> : null}
          <ShinyText
            text={eyebrow}
            color="#f4a5d8"
            shineColor="#fff4a9"
            speed={3.8}
          />
        </p>
        <h1>{title}</h1>
        {description ? (
          <p className="demon-page-description">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="demon-page-actions">{actions}</div> : null}
    </header>
  );
}
