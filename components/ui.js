import Link from "next/link";
import { useId, useState } from "react";
import {
  AlertCircleIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  LoaderIcon,
} from "components/icons.js";
import { PRIORITY_LABELS, STATUS_LABELS } from "lib/ticket-labels.js";
import { initials } from "lib/format.js";

export function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

const BUTTON_VARIANTS = {
  primary:
    "bg-brand text-white hover:bg-brand-hover disabled:bg-slate-400 font-bold",
  secondary:
    "bg-slate-100 text-slate-900 hover:bg-slate-200 disabled:text-slate-400 font-bold",
  outline:
    "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 disabled:text-slate-400 font-semibold",
  danger:
    "bg-red-500 text-white hover:bg-red-600 disabled:bg-red-300 font-bold",
  ghost: "text-slate-700 hover:bg-slate-100 font-semibold",
};

const BUTTON_SIZES = {
  lg: "h-13 px-6 text-sm rounded-xl",
  md: "h-11 px-5 text-sm rounded-xl",
  sm: "h-9 px-3 text-xs rounded-lg",
};

export function Button({
  variant = "primary",
  caps = variant === "primary" ||
    variant === "secondary" ||
    variant === "danger",
  size = "lg",
  loading = false,
  className,
  children,
  href,
  disabled,
  ...props
}) {
  const classes = cx(
    "inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    caps && "tracking-wide uppercase",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={classes} {...props}>
        {children}
      </Link>
    );
  }
  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {loading && <LoaderIcon className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Label({ htmlFor, children }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-sm font-semibold text-slate-900"
    >
      {children}
    </label>
  );
}

export function FieldError({ children }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs font-medium text-red-600">{children}</p>;
}

const INPUT_CLASSES =
  "w-full rounded-xl border bg-white px-4 text-sm placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-50 disabled:text-slate-500";

export function TextField({
  label,
  error,
  className,
  inputClassName,
  rightSlot,
  leftIcon: LeftIcon,
  ...props
}) {
  const generatedId = useId();
  const id = props.id || generatedId;
  return (
    <div className={className}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="relative">
        {LeftIcon && (
          <LeftIcon className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400" />
        )}
        <input
          id={id}
          aria-invalid={error ? "true" : undefined}
          className={cx(
            INPUT_CLASSES,
            "h-12 text-slate-900",
            LeftIcon && "pl-11",
            rightSlot && "pr-14",
            error ? "border-red-400" : "border-slate-200",
            inputClassName,
          )}
          {...props}
        />
        {rightSlot && (
          <div className="absolute inset-y-0 right-2 flex items-center">
            {rightSlot}
          </div>
        )}
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
}

export function PasswordField(props) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      type={visible ? "text" : "password"}
      {...props}
      rightSlot={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="rounded-lg p-2 text-slate-400 hover:text-slate-700"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      }
    />
  );
}

export function TextArea({ label, error, className, ...props }) {
  const generatedId = useId();
  const id = props.id || generatedId;
  return (
    <div className={className}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <textarea
        id={id}
        aria-invalid={error ? "true" : undefined}
        className={cx(
          INPUT_CLASSES,
          "min-h-30 resize-y py-3 text-slate-900",
          error ? "border-red-400" : "border-slate-200",
        )}
        {...props}
      />
      <FieldError>{error}</FieldError>
    </div>
  );
}

export function SelectField({
  label,
  error,
  className,
  children,
  selectClassName,
  muted = false,
  ...props
}) {
  const generatedId = useId();
  const id = props.id || generatedId;
  return (
    <div className={className}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <select
        id={id}
        aria-invalid={error ? "true" : undefined}
        className={cx(
          INPUT_CLASSES,
          "h-12 font-medium",
          muted ? "text-slate-400" : "text-slate-900",
          error ? "border-red-400" : "border-slate-200",
          selectClassName,
        )}
        {...props}
      >
        {children}
      </select>
      <FieldError>{error}</FieldError>
    </div>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cx("rounded-2xl border border-slate-200 bg-white", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function Alert({ variant = "error", children, className }) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    info: "border-blue-200 bg-blue-50 text-blue-800",
  };
  const Icon = variant === "success" ? CheckIcon : AlertCircleIcon;
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cx(
        "flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-semibold",
        styles[variant],
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

const STATUS_STYLES = {
  aberto: "bg-emerald-100 text-emerald-800",
  em_analise: "bg-amber-100 text-amber-800",
  em_andamento: "bg-blue-100 text-blue-800",
  aguardando: "bg-orange-100 text-orange-800",
  fechado: "bg-red-100 text-red-800",
  reaberto: "bg-indigo-100 text-indigo-800",
};

const PRIORITY_STYLES = {
  critica: "bg-red-100 text-red-800",
  alta: "bg-amber-100 text-amber-800",
  media: "bg-blue-100 text-blue-800",
  baixa: "bg-slate-100 text-slate-700",
};

export const PRIORITY_DOT = {
  critica: "bg-red-500",
  alta: "bg-amber-500",
  media: "bg-blue-500",
  baixa: "bg-slate-500",
};

export function Badge({ className, children, uppercase }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md px-2 py-1 text-[11px] leading-none font-bold whitespace-nowrap",
        uppercase && "uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, uppercase }) {
  return (
    <Badge className={STATUS_STYLES[status]} uppercase={uppercase}>
      {STATUS_LABELS[status] || status}
    </Badge>
  );
}

export function PriorityBadge({ priority, uppercase = true }) {
  return (
    <Badge className={PRIORITY_STYLES[priority]} uppercase={uppercase}>
      {PRIORITY_LABELS[priority] || priority}
    </Badge>
  );
}

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-slate-500",
  "bg-violet-500",
  "bg-rose-500",
];

function colorFor(name = "") {
  let sum = 0;
  for (const char of name) sum += char.charCodeAt(0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

export function Avatar({ name, size = "md", tone = "auto", className }) {
  const sizes = {
    sm: "h-8 w-8 text-[11px]",
    md: "h-10 w-10 text-xs",
    lg: "h-11 w-11 text-sm",
    xl: "h-20 w-20 text-2xl",
  };
  const color =
    tone === "dark"
      ? "bg-brand"
      : tone === "muted"
        ? "bg-slate-600"
        : colorFor(name);
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white",
        sizes[size],
        color,
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions, badge }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && <p className="mt-2 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      )}
    </div>
  );
}

export function StatCard({ label, value, dotClassName, icon, className }) {
  return (
    <Card className={cx("p-5", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          {dotClassName && (
            <span className={cx("h-2 w-2 rounded-full", dotClassName)} />
          )}
          {label}
        </div>
        {icon}
      </div>
      <div className="mt-3 text-4xl font-extrabold text-slate-900">{value}</div>
    </Card>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <p className="text-base font-bold text-slate-900">{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-emerald-500" : "bg-slate-300",
      )}
    >
      <span
        className={cx(
          "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}

export function SectionTitle({ children, className }) {
  return (
    <h2 className={cx("text-lg font-bold text-slate-900", className)}>
      {children}
    </h2>
  );
}

export function MetaItem({ label, children, valueClassName }) {
  return (
    <div>
      <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
        {label}
      </div>
      <div className={cx("mt-1 font-semibold text-slate-900", valueClassName)}>
        {children}
      </div>
    </div>
  );
}
