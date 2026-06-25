import Link from "next/link";
import { Logo } from "./Logo";
import { WaitlistButton } from "../ui/WaitlistButton";
import {
  FOOTER_NAV,
  LEGAL_LINKS,
  MEDICAL_DISCLAIMER,
  SOCIAL_LINKS,
} from "@/lib/nav";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-hairline bg-surface">
      <div className="mx-auto w-full max-w-[1180px] px-5 py-14 sm:px-8 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-ink-muted">
              Personalized skincare guidance for routines that make sense.
            </p>
            <div className="mt-5">
              <WaitlistButton size="md" />
            </div>
          </div>

          <FooterCol title="Explore" links={FOOTER_NAV} />
          <FooterCol title="Legal" links={LEGAL_LINKS} />

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
              Follow
            </h3>
            <ul className="mt-4 space-y-2.5">
              {SOCIAL_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-ink-muted transition-colors hover:text-ink"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-hairline pt-6">
          <p className="max-w-2xl text-xs leading-relaxed text-ink-muted">
            {MEDICAL_DISCLAIMER}
          </p>
          <p className="mt-4 text-xs text-ink-muted">
            © {new Date().getFullYear()} Pore. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
        {title}
      </h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-sm text-ink-muted transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
