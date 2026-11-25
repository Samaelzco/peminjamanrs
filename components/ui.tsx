// Komponen dasar UI mengikuti wireframe Figma. Aman dipakai dari Server Component.
import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  ComponentProps,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { LuChevronDown, LuChevronLeft, LuCircleCheck, LuInfo, LuTriangleAlert, LuX } from "react-icons/lu";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------
// Tombol
// ---------------------------------------------------------------------
export type ButtonVariant = "primary" | "secondary" | "danger" | "danger-soft" | "ghost" | "muted";
export type ButtonSize = "md" | "sm";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-700/50",
  secondary: "border border-brand-700 bg-white text-brand-700 hover:bg-brand-50 disabled:opacity-50",
  danger: "bg-red-800 text-white hover:bg-red-900 disabled:bg-red-800/50",
  "danger-soft": "bg-red-100 text-red-800 hover:bg-red-200 disabled:opacity-50",
  ghost: "text-brand-700 hover:bg-brand-50 disabled:opacity-50",
  muted: "bg-gray-300/80 text-gray-700 hover:bg-gray-300 disabled:opacity-50",
};

const SIZE: Record<ButtonSize, string> = {
  md: "min-h-11 px-4 text-sm",
  sm: "min-h-9 px-3 text-sm",
};

export function buttonClass({
  variant = "primary",
  size = "md",
  block,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; className?: string } = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-[background-color,transform] duration-200 select-none active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100",
    VARIANT[variant],
    SIZE[size],
    block && "w-full",
    className,
  );
}

type BtnOpts = { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; loading?: boolean };

export function Button({
  variant,
  size,
  block,
  loading,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & BtnOpts) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, block, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  block,
  className,
  ...props
}: ComponentProps<typeof Link> & Omit<BtnOpts, "loading">) {
  return <Link className={buttonClass({ variant, size, block, className })} {...props} />;
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------
// Kartu & tata letak halaman
// ---------------------------------------------------------------------
export function Card({
  className,
  children,
  as: Tag = "section",
  ...props
}: { as?: "section" | "div" | "article" | "li" } & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cn("rounded-xl border border-gray-200 bg-white p-4", className)} {...props}>
      {children}
    </Tag>
  );
}

export function CardTitle({ children, className, as: Tag = "h2" }: { children: ReactNode; className?: string; as?: "h2" | "h3" }) {
  return <Tag className={cn("text-base font-semibold text-gray-900", className)}>{children}</Tag>;
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-4 lg:mb-6">
      {back && <BackLink href={back.href}>{back.label}</BackLink>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] leading-tight font-bold tracking-[-0.01em] break-words text-gray-900 lg:text-2xl">
            {title}
          </h1>
          {description && <p className="mt-1 max-w-2xl text-sm leading-5 text-gray-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="-ms-1 mb-3 inline-flex min-h-8 items-center gap-1 rounded-md px-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
    >
      <LuChevronLeft className="h-[18px] w-[18px]" aria-hidden />
      {children}
    </Link>
  );
}

export function SectionTitle({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <h2 className="mb-3 text-base font-semibold text-gray-900">
      {children}
      {count !== undefined && <span className="ms-1 font-normal text-gray-500">({count})</span>}
    </h2>
  );
}

// ---------------------------------------------------------------------
// Pill status
// ---------------------------------------------------------------------
export type Tone = "blue" | "red" | "green" | "yellow" | "purple" | "gray" | "teal";

const TONE: Record<Tone, string> = {
  blue: "bg-blue-100 text-blue-800",
  red: "bg-red-100 text-red-800",
  green: "bg-green-100 text-green-800",
  yellow: "bg-yellow-100 text-yellow-800",
  purple: "bg-purple-100 text-purple-800",
  gray: "bg-gray-200 text-gray-700",
  teal: "bg-brand-50 text-brand-800",
};

export function Pill({
  tone,
  children,
  className,
  wrap,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
  /** Izinkan teks panjang turun baris (mis. nama + waktu). */
  wrap?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit max-w-full items-center rounded-full px-2.5 py-0.5 text-xs leading-[18px] font-semibold",
        wrap ? "break-words" : "shrink-0 whitespace-nowrap",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------
// Statistik
// ---------------------------------------------------------------------
const STAT_TONE: Record<"ink" | "amber" | "red" | "green" | "blue", string> = {
  ink: "text-gray-900",
  amber: "text-amber-700",
  red: "text-red-800",
  green: "text-green-800",
  blue: "text-blue-800",
};

export function StatCard({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: number | string;
  tone?: keyof typeof STAT_TONE;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <p data-stat-label className="text-[13px] leading-5 text-gray-500 sm:text-sm">
        {label}
      </p>
      <p className={cn("mt-0.5 text-[28px] leading-9 font-bold tabular-nums", STAT_TONE[tone])}>{value}</p>
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4 lg:mb-4 lg:gap-4">{children}</div>;
}

// ---------------------------------------------------------------------
// Info & alert
// ---------------------------------------------------------------------
const ALERT: Record<"danger" | "warning" | "success" | "info", { cls: string; icon: typeof LuInfo }> = {
  danger: { cls: "bg-red-100 text-red-800", icon: LuTriangleAlert },
  warning: { cls: "bg-amber-50 text-amber-900", icon: LuTriangleAlert },
  success: { cls: "bg-green-50 text-green-800", icon: LuCircleCheck },
  info: { cls: "bg-gray-100 text-gray-700", icon: LuInfo },
};

export function Alert({
  tone = "danger",
  children,
  onDismiss,
  className,
}: {
  tone?: keyof typeof ALERT;
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  const { cls, icon: Icon } = ALERT[tone];
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm leading-5", cls, className)}
    >
      <Icon className="mt-px h-[18px] w-[18px] shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 font-medium break-words">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="-m-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-md opacity-70 hover:bg-black/5 hover:opacity-100"
          aria-label="Tutup pesan"
        >
          <LuX className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** Kotak catatan abu-abu dengan ikon info (lihat wireframe). */
export function InfoNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-start gap-2.5 rounded-lg bg-gray-100 px-3.5 py-3 text-sm leading-5 text-gray-700", className)}>
      <LuInfo className="mt-0.5 h-4 w-4 shrink-0 text-gray-600" aria-hidden />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-gray-300 bg-white/60 px-4 py-8 text-center text-sm text-gray-500">
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------
const CONTROL =
  "block w-full rounded-lg border bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 transition-colors duration-200 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500";

export function controlClass(invalid?: boolean, className?: string) {
  return cn(
    CONTROL,
    invalid
      ? "border-red-600 focus:border-red-600 focus:ring-red-600/20"
      : "border-gray-400/80 focus:border-brand-600 focus:ring-brand-600/20",
    className,
  );
}

export function Label({ htmlFor, children, className }: { htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1.5 block text-sm font-semibold text-gray-900", className)}>
      {children}
    </label>
  );
}

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-red-700">
      {children}
    </p>
  );
}

export function Field({
  id,
  label,
  error,
  hint,
  children,
  className,
}: {
  id?: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
      <FieldError id={id ? `${id}-error` : undefined}>{error}</FieldError>
    </div>
  );
}

type Invalid = { invalid?: boolean };

export function Input({ invalid, className, ...props }: InputHTMLAttributes<HTMLInputElement> & Invalid) {
  return (
    <input
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && props.id ? `${props.id}-error` : undefined}
      className={controlClass(invalid, cn("h-11", className))}
      {...props}
    />
  );
}

export function Textarea({ invalid, className, rows = 4, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & Invalid) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && props.id ? `${props.id}-error` : undefined}
      className={controlClass(invalid, cn("min-h-24 py-2.5 leading-5", className))}
      {...props}
    />
  );
}

export function Select({ invalid, className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & Invalid) {
  return (
    <div className="relative">
      <select
        aria-invalid={invalid || undefined}
        aria-describedby={invalid && props.id ? `${props.id}-error` : undefined}
        className={controlClass(invalid, cn("h-11 appearance-none pe-10", className))}
        {...props}
      >
        {children}
      </select>
      <LuChevronDown
        className="pointer-events-none absolute inset-y-0 end-3 my-auto h-5 w-5 text-gray-700"
        aria-hidden
      />
    </div>
  );
}

/** Radio bergaya "chip" yang mudah disentuh (min 44px). */
export function RadioChip({
  checked,
  children,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { children: ReactNode }) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3 text-sm transition-colors duration-200 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
        checked ? "border-brand-700 bg-brand-50 font-semibold text-brand-800" : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
        className,
      )}
    >
      <input type="radio" checked={checked} className="h-4 w-4 accent-brand-700 focus:outline-none" {...props} />
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------
// Pasangan label/nilai pada kartu informasi
// ---------------------------------------------------------------------
export function InfoGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("grid grid-cols-2 gap-x-4 gap-y-3.5 text-sm md:grid-cols-3", className)}>{children}</dl>;
}

export function InfoItem({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[13px] text-gray-500">{label}</dt>
      <dd className="mt-0.5 font-semibold break-words whitespace-pre-line text-gray-900">{children}</dd>
    </div>
  );
}
