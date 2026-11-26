import Link from "next/link";
import { CircleHelp } from "lucide-react";
import type { HelpRoleSlug } from "./help-content";
import { HELP_SHOTS } from "./help-shots";

/** Shows “curly-quoted” on-screen labels in bold. */
export function HelpText({ text }: { text: string }) {
  const parts = text.split(/(“[^”]+”)/);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("“") ? (
          <strong key={i} className="font-semibold text-zinc-900">
            {part.slice(1, -1)}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** A phone screenshot from public/help, if it exists. */
export function HelpShot({ name, alt }: { name: string; alt: string }) {
  const size = HELP_SHOTS[name];
  if (!size) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/help/${name}.webp`}
      width={size[0]}
      height={size[1]}
      alt={alt}
      loading="lazy"
      className="mt-3 h-auto w-full max-w-xs rounded-2xl border border-zinc-200 shadow-sm"
    />
  );
}

/** Small “How to use” link placed by a section heading. */
export function HelpLink({ role, guide, className = "" }: { role: HelpRoleSlug; guide?: string; className?: string }) {
  return (
    <Link
      href={guide ? `/help/${role}/${guide}` : `/help/${role}`}
      className={`inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-2 text-sm font-semibold text-orange-700 hover:bg-orange-50 hover:underline ${className}`}
    >
      <CircleHelp size={15} aria-hidden="true" />
      How to use
    </Link>
  );
}

/** A section heading with its “How to use” link on the right. */
export function HelpHeading({
  title,
  role,
  guide,
  className = "mt-8",
}: {
  title: React.ReactNode;
  role: HelpRoleSlug;
  guide: string;
  className?: string;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <h2 className="min-w-0 text-lg font-bold text-zinc-900">{title}</h2>
      <HelpLink role={role} guide={guide} />
    </div>
  );
}
