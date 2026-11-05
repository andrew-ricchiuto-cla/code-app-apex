// Teams/Outlook-style people picker: selected people appear as chips inside the
// box, typing searches the environment's user directory, and the suggestion
// list supports arrow keys, Enter, Escape, and Backspace-to-remove.

import { useEffect, useId, useRef, useState } from "react";
import { avatarColor, displayName, initials, searchPeople } from "@/lib/people";
import type { TeamMember } from "@/lib/store";
import { cn } from "@/lib/utils";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Avatar({ name, seed, size = "sm" }: { name: string; seed: string; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        size === "sm" ? "size-5 text-[9px]" : "size-8 text-xs",
      )}
      style={{ background: avatarColor(seed) }}
      aria-hidden
    >
      {initials(displayName(name))}
    </span>
  );
}

interface Props {
  value: TeamMember[];
  onChange: (next: TeamMember[]) => void;
  /** Directory search is available only inside the Power Apps host. */
  directory: boolean;
  placeholder?: string;
  /** Optional per-chip decoration (e.g. a captain toggle). */
  renderChipExtra?: (member: TeamMember) => React.ReactNode;
  /** People who can't be picked here (e.g. already on another team), keyed by UPN with a reason. */
  unavailable?: Map<string, string>;
}

export function PeoplePicker({ value, onChange, directory, placeholder, renderChipExtra, unavailable }: Props) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ q: string; people: TeamMember[] }>({ q: "", people: [] });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const chosen = new Set(value.map((m) => m.upn));
  const q = query.trim();
  const loading = directory && q.length >= 2 && found.q !== q;
  const results = found.q === q ? found.people : [];

  useEffect(() => {
    if (!directory || q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchPeople(q)
        .then((people) => {
          if (cancelled) return;
          setFound({ q, people });
          setActive(0);
        })
        .catch(() => !cancelled && setFound({ q, people: [] }));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, directory]);

  const typedEmail = !directory && EMAIL.test(query.trim()) ? query.trim().toLowerCase() : null;
  const suggestions: TeamMember[] = directory
    ? results.filter((p) => !chosen.has(p.upn))
    : typedEmail && !chosen.has(typedEmail)
      ? [{ id: typedEmail, upn: typedEmail, name: typedEmail, email: typedEmail }]
      : [];

  const add = (person: TeamMember) => {
    if (unavailable?.has(person.upn)) return;
    onChange([...value, person]);
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  };
  const remove = (upn: string) => onChange(value.filter((m) => m.upn !== upn));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      if (suggestions[active]) {
        e.preventDefault();
        add(suggestions[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && query === "" && value.length > 0) {
      remove(value[value.length - 1].upn);
    }
  };

  const showList = open && query.trim().length >= (directory ? 2 : 1);

  return (
    <div className="relative">
      <div
        className="border-input bg-card focus-within:ring-ring/50 focus-within:border-ring flex min-h-9 w-full cursor-text flex-wrap items-center gap-1 rounded-md border px-1.5 py-1 shadow-xs focus-within:ring-[3px]"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((m) => (
          <span key={m.upn} className="bg-muted inline-flex max-w-full items-center gap-1 rounded-full py-0.5 pr-1 pl-0.5 text-xs" title={m.email}>
            <Avatar name={m.name} seed={m.upn} />
            <span className="truncate font-medium">{displayName(m.name)}</span>
            {renderChipExtra?.(m)}
            <button
              type="button"
              className="text-muted-foreground hover:bg-background hover:text-foreground rounded-full px-1"
              aria-label={`Remove ${displayName(m.name)}`}
              onClick={(e) => {
                e.stopPropagation();
                remove(m.upn);
              }}
            >
              ✕
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          className="min-w-40 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
          placeholder={value.length === 0 ? (placeholder ?? (directory ? "Enter a name or email" : "Type an email and press Enter")) : ""}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
        />
      </div>

      {showList && (
        <ul id={listId} role="listbox" className="bg-popover absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border py-1 shadow-lg">
          {loading && <li className="text-muted-foreground px-3 py-2 text-sm">Searching…</li>}
          {!loading && suggestions.length === 0 && (
            <li className="text-muted-foreground px-3 py-2 text-sm">
              {directory ? "No people found in this environment" : "Enter a full email address"}
            </li>
          )}
          {!loading &&
            suggestions.map((p, i) => {
              const reason = unavailable?.get(p.upn);
              return (
                <li
                  key={p.upn}
                  role="option"
                  aria-selected={i === active}
                  aria-disabled={!!reason || undefined}
                  className={cn("flex items-center gap-2.5 px-3 py-1.5", i === active && "bg-accent", reason && "opacity-50")}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    add(p);
                  }}
                >
                  <Avatar name={p.name} seed={p.upn} size="md" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{displayName(p.name)}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {reason ?? [p.title, p.email].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
