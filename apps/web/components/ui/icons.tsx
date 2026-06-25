import { type SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
  };
}

export function CheckIcon({ size = 18, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path
        d="M5 12.5l4 4 10-10"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AlertIcon({ size = 18, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path
        d="M12 4l8.5 14.5h-17L12 4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16.6" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function DropIcon({ size = 18, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path
        d="M12 3c3 3.5 5.5 6.7 5.5 9.8a5.5 5.5 0 1 1-11 0C6.5 9.7 9 6.5 12 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SparkleIcon({ size = 18, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path
        d="M12 3l1.8 4.9L18.5 9.7l-4.7 1.8L12 16.4l-1.8-4.9L5.5 9.7l4.7-1.8L12 3Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ChartIcon({ size = 18, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M5 19V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 19h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M8 15l3-3 2.5 2 4-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CameraIcon({ size = 18, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path
        d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0 1 20 8.5v8A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5v-8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function LeafIcon({ size = 18, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path
        d="M19 5c0 8-5 13-13 13 0-8 5-13 13-13Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M6 18C10 13 13 10 17 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowIcon({ size = 18, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M5 12h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SunIcon({ size = 18, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line
          key={a}
          x1="12"
          y1="2.5"
          x2="12"
          y2="5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          transform={`rotate(${a} 12 12)`}
        />
      ))}
    </svg>
  );
}

export function MoonIcon({ size = 18, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <path
        d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SearchIcon({ size = 18, ...p }: IconProps) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.9" />
      <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function GoogleIcon({ size = 18, ...p }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path
        d="M21.6 12.2c0-.7-.06-1.4-.18-2.05H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.24c1.9-1.75 2.96-4.33 2.96-7.35Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.5c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.75-5.58-4.1H3.06v2.58A10 10 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.42 13.93a6 6 0 0 1 0-3.86V7.49H3.06a10 10 0 0 0 0 9.02l3.36-2.58Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.98c1.47 0 2.78.5 3.82 1.49l2.85-2.85C16.95 2.99 14.7 2 12 2A10 10 0 0 0 3.06 7.49l3.36 2.58C7.2 7.73 9.4 5.98 12 5.98Z"
        fill="#EA4335"
      />
    </svg>
  );
}
