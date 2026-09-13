import Link from "next/link";
import { type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "soft";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-pill font-semibold transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-55";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary !text-on-primary shadow-[0_10px_30px_-12px_rgba(50,72,63,0.7)] hover:bg-primary-press hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-14px_rgba(50,72,63,0.8)]",
  secondary:
    "border border-hairline bg-surface !text-ink hover:border-primary/40 hover:-translate-y-0.5",
  ghost: "!text-ink hover:bg-ink/5",
  soft: "bg-accent !text-accent-ink hover:-translate-y-0.5 hover:bg-[#ddd4ee]",
};

const sizes: Record<Size, string> = {
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps & {
  href: string;
  external?: boolean;
};

/**
 * Schemes an href may use. `href` is typed `string`, so nothing stops a future
 * caller passing a value that came from an API response or the CMS — and
 * `javascript:` in an anchor executes on click. Relative paths, fragments and
 * query-only hrefs have no scheme at all and are always fine.
 */
function isSafeHref(href: string): boolean {
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(href.trim());
  if (!scheme) return true;
  const protocol = `${scheme[1]!.toLowerCase()}:`;
  return protocol === "https:" || protocol === "http:" || protocol === "mailto:";
}

/** True when the href leaves this origin, regardless of how it was declared. */
function isExternalHref(href: string): boolean {
  return /^(https?:|mailto:)/i.test(href.trim());
}

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const {
    variant = "primary",
    size = "md",
    className = "",
    children,
  } = props;
  const classes = `${base} ${variants[variant]} ${sizes[size]} ${className}`;

  if ("href" in props && props.href !== undefined) {
    const { href, external } = props;
    // Render the label without a destination rather than emitting an anchor we
    // cannot vouch for. Silently dropping the href is the safe failure: the page
    // still reads correctly and nothing executes.
    if (!isSafeHref(href)) {
      return <span className={classes}>{children}</span>;
    }
    if (external || isExternalHref(href) || href.startsWith("#")) {
      // Keyed on the destination, not on the `external` prop: an https href
      // opens a new tab whether or not the caller remembered to say so, and
      // every new tab gets noopener/noreferrer.
      const opensNewTab = external || isExternalHref(href);
      return (
        <a
          href={href}
          className={classes}
          {...(opensNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  const { children: buttonChildren, ...rest } = props as ButtonAsButton;
  delete rest.variant;
  delete rest.size;
  delete rest.className;
  delete rest.href;
  return (
    <button className={classes} {...rest}>
      {buttonChildren}
    </button>
  );
}
