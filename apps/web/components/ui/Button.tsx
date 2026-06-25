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
    if (external || href.startsWith("http") || href.startsWith("#")) {
      return (
        <a
          href={href}
          className={classes}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
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

  const { variant: _v, size: _s, className: _c, children: _ch, href: _h, ...rest } =
    props as ButtonAsButton;
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
