// "How a round works" — a two-minute guided round of a lemonade stand that
// models the real Apex flow: briefing → spend two budgets → rationale →
// submit and wait → reveal. Same rules, smaller stakes, more lemons.

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { copyTourLink } from "@/lib/tour-link";
import { cn } from "@/lib/utils";

type LoopKey = "market" | "value" | "capability" | "control" | "cash";

const LOOPS: { key: LoopKey; apex: string; lemon: string; bar: string }[] = [
  { key: "market", apex: "Market", lemon: "Buzz — how many thirsty people find your stand", bar: "bg-market" },
  { key: "value", apex: "Value", lemon: "Taste — how good it is and what people will pay", bar: "bg-value" },
  { key: "capability", apex: "Capability", lemon: "Squeezing — skill, plus getting it where the line is", bar: "bg-capability" },
  { key: "control", apex: "Control", lemon: "Teamwork — everyone knows who does what", bar: "bg-control" },
  { key: "cash", apex: "Cash", lemon: "The jar — coins earned and saved to reinvest", bar: "bg-cash" },
];

interface Option {
  id: string;
  emoji: string;
  name: string;
  coins: number;
  energy: number;
  now: Partial<Record<LoopKey, number>>;
  next?: Partial<Record<LoopKey, number>>;
  story: string;
}

const OPTIONS: Option[] = [
  { id: "ice", emoji: "🧊", name: "Buy more ice", coins: 3, energy: 1, now: { value: 4, cash: 2 }, story: "Ice-cold lemonade on a scorcher. People paid extra." },
  {
    id: "ai",
    emoji: "🤖",
    name: "Hire an AI lemon squeezer",
    coins: 6,
    energy: 3,
    now: { cash: -4 },
    next: { capability: 14 },
    story: "It spent today reading the manual (and squeezing one lemon very slowly). Big payoff arrives next round.",
  },
  { id: "sign", emoji: "🪧", name: "Paint a giant sign", coins: 2, energy: 1, now: { market: 7 }, story: "The whole block saw it. Buzz went up." },
  { id: "recipe", emoji: "🍋", name: "Perfect the secret recipe", coins: 3, energy: 2, now: { value: 8 }, story: "A pinch of mint. Neighbors started saying 'artisanal'." },
  { id: "cousin", emoji: "🧑‍🍳", name: "Teach your cousin to squeeze", coins: 2, energy: 2, now: { capability: 7 }, story: "Two squeezers, one line. Fewer people walked away." },
  { id: "roles", emoji: "📋", name: "Agree who does what", coins: 1, energy: 2, now: { control: 9 }, story: "One pours, one takes coins. No more three people grabbing the same cup." },
];

const JAR = [
  { id: "treat", name: "Treat yourself", text: "Spend today's coins on ice cream. Fun now, less to invest next round.", now: { cash: -3 } as Partial<Record<LoopKey, number>> },
  { id: "balance", name: "Balance", text: "Some for you, some for the jar.", now: {} },
  { id: "save", name: "Save in the jar", text: "More coins to invest next round — if the stand is earning.", now: { cash: 3 } },
] as const;

const DIAGNOSES = ["We can't keep up when it's busy", "Nobody can find our stand", "Our lemonade tastes like… lemonade"];
const INDICATORS = ["Length of the line at noon", "Cups sold before the ice runs out", "Neighbors who come back tomorrow"];

const BUDGET = { coins: 10, energy: 5, picks: 3 };
const START = 50;

const STEPS = ["Welcome", "Five loops", "Briefing", "Decide", "Rationale", "Submit", "Reveal", "Your turn"] as const;

export function LemonadeTour({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState<string[]>([]);
  const [jar, setJar] = useState<(typeof JAR)[number]["id"]>("balance");
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const [indicator, setIndicator] = useState<string | null>(null);

  const chosen = OPTIONS.filter((o) => picks.includes(o.id));
  const coins = chosen.reduce((s, o) => s + o.coins, 0);
  const energy = chosen.reduce((s, o) => s + o.energy, 0);
  const spareEnergy = BUDGET.energy - energy;

  const toggle = (o: Option) => {
    if (picks.includes(o.id)) setPicks(picks.filter((p) => p !== o.id));
    else setPicks([...picks, o.id]);
  };
  const fits = (o: Option) => picks.includes(o.id) || (picks.length < BUDGET.picks && coins + o.coins <= BUDGET.coins && energy + o.energy <= BUDGET.energy);

  const reveal = scoreRound(chosen, jar, spareEnergy);
  const canNext = step === 3 ? picks.length > 0 : step === 4 ? !!diagnosis && !!indicator : true;

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) setStep(0);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-3xl">
        <div className="bg-navy relative overflow-hidden rounded-t-xl px-6 py-4 text-white">
          <div className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-saffron/30 blur-2xl" />
          <div className="absolute inset-x-0 bottom-0 h-1 bg-saffron" />
          <div className="relative flex items-center justify-between gap-4">
            <div>
              <div className="text-saffron text-[11px] font-bold tracking-widest uppercase">How a round works</div>
              <DialogTitle className="text-xl font-black">🍋 The Lemonade Stand</DialogTitle>
              <DialogDescription className="text-white/70">Same rules as Apex. Smaller stakes. More lemons.</DialogDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="hidden gap-1 sm:flex">
                {STEPS.map((s, i) => (
                  <span key={s} title={s} className={cn("h-1.5 w-6 rounded-full", i <= step ? "bg-saffron" : "bg-white/20")} />
                ))}
              </div>
              <Button size="sm" variant="ghost" className="mr-6 h-6 px-2 text-xs text-white/70 hover:bg-white/10 hover:text-white" onClick={() => void copyTourLink()}>
                🔗 Copy link
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-6 pb-2">
          {step === 0 && (
            <Section title="You've just been handed a lemonade stand.">
              <p>
                Over a few rounds, you'll face different scenarios — a heat wave, a rival stand, a lemon shortage — and decide how to spend
                your limited resources. Then you find out what happened.
              </p>
              <p>
                That's exactly how <strong>Apex</strong> works, except your stand is a $2.5B professional-services firm and the lemons are a
                little more expensive.
              </p>
              <Callout>Your goal isn't to win one category. It's to keep the whole stand healthy.</Callout>
            </Section>
          )}

          {step === 1 && (
            <Section title="Your stand runs on five loops.">
              <div className="grid gap-2">
                {LOOPS.map((l) => (
                  <div key={l.key} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                    <span className={cn("size-3 shrink-0 rounded-full", l.bar)} />
                    <span className="w-24 shrink-0 font-semibold">{l.apex}</span>
                    <span className="text-muted-foreground text-sm">{l.lemon}</span>
                  </div>
                ))}
              </div>
              <Callout>
                Your score multiplies the five together. The best recipe in town doesn't matter if nobody can find you —{" "}
                <strong>one weak loop drags everything down.</strong>
              </Callout>
            </Section>
          )}

          {step === 2 && (
            <Section title="Round 1 briefing: ☀️ It's super hot today.">
              <p>The forecast says 98°F. Thirsty people will be everywhere. Warm lemonade will not be a hit.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Resource icon="🪙" label="Investment capital" value={`${BUDGET.coins} coins`} text="Money to fund things." />
                <Resource icon="⚡" label="Leadership capacity" value={`${BUDGET.energy} energy`} text="Your time, attention, and how much change the team can absorb." />
              </div>
              <Callout>
                Two budgets, not one. You might afford something with coins and still not have the energy to pull it off. Energy you don't spend
                isn't wasted — it helps you handle surprises.
              </Callout>
            </Section>
          )}

          {step === 3 && (
            <Section title="Decide: how will you spend it?">
              <div className="grid gap-3 sm:grid-cols-3">
                <Meter label="🪙 Capital" used={coins} max={BUDGET.coins} />
                <Meter label="⚡ Leadership capacity" used={energy} max={BUDGET.energy} />
                <Meter label="Initiatives" used={picks.length} max={BUDGET.picks} />
              </div>
              <div className="overflow-hidden rounded-lg border">
                {OPTIONS.map((o) => {
                  const on = picks.includes(o.id);
                  const ok = fits(o);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      disabled={!ok}
                      onClick={() => toggle(o)}
                      className={cn(
                        "flex w-full items-center gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0 disabled:opacity-40",
                        on ? "bg-riptide/20" : "hover:bg-muted/60",
                      )}
                    >
                      <span className="text-lg">{o.emoji}</span>
                      <span className="flex-1 font-medium">{o.name}</span>
                      <span className="w-16 text-center font-mono">{o.coins} 🪙</span>
                      <span className="w-16 text-center font-mono">{o.energy} ⚡</span>
                      <Badge variant={on ? "default" : "outline"} className="w-20 justify-center">
                        {on ? "✓ Picked" : "Pick"}
                      </Badge>
                    </button>
                  );
                })}
              </div>
              <div>
                <div className="mb-1.5 text-sm font-semibold">And today's coins?</div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {JAR.map((j) => (
                    <button
                      key={j.id}
                      type="button"
                      onClick={() => setJar(j.id)}
                      className={cn("rounded-lg border p-2 text-left text-xs", jar === j.id ? "border-navy ring-navy bg-riptide/15 ring-2" : "hover:border-riptide")}
                    >
                      <div className="text-sm font-semibold">{j.name}</div>
                      <div className="text-muted-foreground">{j.text}</div>
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                Notice what's missing: what each choice will <em>do</em>. In Apex you see costs, not outcomes — you have to reason it through.
              </p>
            </Section>
          )}

          {step === 4 && (
            <Section title="Rationale: say what you think will happen.">
              <p className="text-sm">Before submitting, your team commits to its thinking. It's what you'll debrief later.</p>
              <ChipChoice label="Diagnosis — what constraint are you trying to address?" options={DIAGNOSES} value={diagnosis} onChange={setDiagnosis} />
              <ChipChoice label="Leading indicator — what will you watch before the score moves?" options={INDICATORS} value={indicator} onChange={setIndicator} />
              <p className="text-muted-foreground text-xs">
                In Apex you'll write these in your own words, plus a hypothesis and a "reconsider" trigger. From Round 2 you'll also note what you
                learned since last round.
              </p>
            </Section>
          )}

          {step === 5 && (
            <Section title="Submit, then wait for the reveal.">
              <div className="rounded-lg border p-3 text-sm">
                <div className="mb-1 font-semibold">Your Round 1 choices</div>
                <div>{chosen.map((o) => `${o.emoji} ${o.name}`).join(" · ")}</div>
                <div className="text-muted-foreground">Coins: {JAR.find((j) => j.id === jar)!.name}</div>
                <div className="text-muted-foreground">Diagnosis: {diagnosis}</div>
              </div>
              <p>
                Your choices lock. No peeking: you won't see a score until <strong>the facilitator reveals the round</strong> for everyone at
                once.
              </p>
              <Callout>
                On a real team, only the <strong>★ team captain</strong> clicks Submit. Everyone else watches live and argues helpfully.
              </Callout>
              <div className="bg-muted text-muted-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
                <span className="bg-control size-2 animate-pulse rounded-full" />
                Waiting for the other stands to submit…
              </div>
            </Section>
          )}

          {step === 6 && (
            <Section title="The reveal: here's what happened.">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-muted-foreground text-[11px] font-semibold tracking-widest uppercase">Lemonade Health Index</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-navy font-mono text-4xl font-black">{reveal.index.toFixed(1)}</span>
                    <span className={cn("font-mono text-sm font-semibold", reveal.index >= START ? "text-cash" : "text-destructive")}>
                      {reveal.index >= START ? "▲" : "▼"} {Math.abs(reveal.index - START).toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className="text-muted-foreground max-w-xs text-right text-xs">Started at {START}. Weakest loop: {reveal.weakest}.</div>
              </div>
              <div className="space-y-2">
                {LOOPS.map((l) => {
                  const after = reveal.loops[l.key];
                  const d = after - START;
                  return (
                    <div key={l.key} className="grid grid-cols-[8rem_1fr_5rem] items-center gap-3">
                      <span className="text-sm font-medium">
                        {l.apex}
                        {reveal.weakest === l.apex && <span className="text-destructive ml-1 text-[10px] font-bold uppercase">weakest</span>}
                      </span>
                      <div className="bg-muted relative h-2.5 overflow-hidden rounded-full">
                        <div className={cn("absolute inset-y-0 left-0 rounded-full opacity-30", l.bar)} style={{ width: `${START}%` }} />
                        <div className={cn("absolute inset-y-0 left-0 rounded-full", l.bar)} style={{ width: `${Math.min(100, after)}%`, opacity: 0.85 }} />
                      </div>
                      <span className="text-right font-mono text-sm">
                        {after.toFixed(0)} <span className={cn("text-xs", d >= 0 ? "text-cash" : "text-destructive")}>{d >= 0 ? `+${d}` : d}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
              <ul className="space-y-1.5 text-sm">
                {reveal.story.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span>{s.icon}</span>
                    <span>{s.text}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {step === 7 && (
            <Section title="That's a round. Apex runs four of them.">
              <ol className="space-y-2 text-sm">
                {[
                  ["Briefing", "Read the scenario and your resources."],
                  ["Decide", "Pick up to 4 initiatives (Focused or Accelerated) and set enterprise choices, within capital and leadership capacity."],
                  ["Rationale", "Diagnosis, learning, hypothesis, leading indicator, reconsider trigger."],
                  ["Submit", "The captain locks it in. Then you wait."],
                  ["Reveal", "See your System Health Index, your five loops, and the leaderboard."],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-3">
                    <span className="bg-navy inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">{i + 1}</span>
                    <span>
                      <strong>{t}.</strong> {d}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <Lesson title="Two budgets">Coins aren't the only limit. Spare energy cushions the next surprise.</Lesson>
                <Lesson title="Some things take time">The AI squeezer pays off next round. Many Apex initiatives do too.</Lesson>
                <Lesson title="Balance beats brilliance">One weak loop pulls the whole index down.</Lesson>
                <Lesson title="Prepare before the shock">What you build early protects you when events hit.</Lesson>
              </div>
              <Callout>Your stand is now a $2.5B firm. Good luck. 🍋</Callout>
            </Section>
          )}
        </div>

        <div className="bg-card sticky bottom-0 flex items-center justify-between gap-2 border-t px-6 py-3">
          <Button variant="ghost" onClick={() => (step === 0 ? close(false) : setStep(step - 1))}>
            {step === 0 ? "Skip" : "Back"}
          </Button>
          <span className="text-muted-foreground text-xs">
            {step + 1} / {STEPS.length} · {STEPS[step]}
          </span>
          {step < STEPS.length - 1 ? (
            <Button disabled={!canNext} onClick={() => setStep(step + 1)}>
              {step === 5 ? "Reveal results" : step === 3 && picks.length === 0 ? "Pick at least one" : "Next"}
            </Button>
          ) : (
            <Button onClick={() => close(false)}>Got it — let's play</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function scoreRound(chosen: Option[], jar: string, spareEnergy: number) {
  const loops: Record<LoopKey, number> = { market: START, value: START, capability: START, control: START, cash: START };
  const story: { icon: string; text: string }[] = [];
  const add = (fx: Partial<Record<LoopKey, number>>) => {
    for (const [k, v] of Object.entries(fx)) loops[k as LoopKey] += v ?? 0;
  };

  story.push({ icon: "☀️", text: "The heat wave hit: crowds everywhere. Buzz +6 for every stand on the street." });
  add({ market: 6 });

  for (const o of chosen) {
    add(o.now);
    story.push({ icon: o.emoji, text: o.story });
  }
  const has = (id: string) => chosen.some((o) => o.id === id);

  if (!has("ice")) {
    add({ value: -8 });
    story.push({ icon: "🥵", text: "No extra ice. By 2pm it was warm lemonade. Taste −8." });
  }
  if (!has("cousin") && !has("ai")) {
    add({ capability: -5 });
    story.push({ icon: "🐢", text: "One squeezer, a block-long line. People gave up. Squeezing −5." });
  }
  if (spareEnergy >= 2) {
    add({ control: 3 });
    story.push({ icon: "⚡", text: `You kept ${spareEnergy} energy spare, so you could handle the rush without chaos. Teamwork +3.` });
  } else if (spareEnergy === 0) {
    add({ control: -4 });
    story.push({ icon: "😵", text: "Every bit of energy was spoken for. When the rush came, nobody had a free hand. Teamwork −4." });
  }
  if (jar === "treat") {
    add({ cash: -3 });
    story.push({ icon: "🍦", text: "Ice cream was delicious. The jar is lighter for next round." });
  } else if (jar === "save") {
    add({ cash: 3 });
    story.push({ icon: "🫙", text: "Coins in the jar. More to invest next round." });
  }
  const ai = chosen.find((o) => o.id === "ai");
  if (ai) story.push({ icon: "⏳", text: "Coming next round: your AI squeezer is up to speed (Squeezing +14). Some investments pay off later." });

  for (const k of Object.keys(loops) as LoopKey[]) loops[k] = Math.max(0, Math.min(100, loops[k]));
  const raw = Math.pow(LOOPS.reduce((p, l) => p * Math.max(1, loops[l.key]), 1), 1 / 5);
  const index = 50 + 1.25 * (raw - 50);
  const weakest = LOOPS.reduce((min, l) => (loops[l.key] < loops[min.key] ? l : min), LOOPS[0]).apex;
  return { loops, index, weakest, story };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 pt-4 text-sm leading-relaxed">
      <h3 className="text-navy text-lg font-bold">{title}</h3>
      {children}
    </section>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return <div className="border-saffron bg-saffron/15 rounded-lg border-l-4 px-3 py-2">{children}</div>;
}

function Lesson({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-riptide/10 rounded-lg border px-3 py-2">
      <div className="font-semibold">{title}</div>
      <div className="text-muted-foreground text-xs">{children}</div>
    </div>
  );
}

function Resource({ icon, label, value, text }: { icon: string; label: string; value: string; text: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-muted-foreground text-xs">
        {icon} {label}
      </div>
      <div className="font-mono text-xl font-bold">{value}</div>
      <div className="text-muted-foreground text-xs">{text}</div>
    </div>
  );
}

function Meter({ label, used, max }: { label: string; used: number; max: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="font-mono">
          {used} / {max}
        </span>
      </div>
      <Progress value={(used / max) * 100} className="h-2" />
    </div>
  );
}

function ChipChoice({ label, options, value, onChange }: { label: string; options: string[]; value: string | null; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-semibold">
        {label} <span className="text-destructive">*</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={cn("rounded-full border px-3 py-1 text-xs", value === o ? "border-navy bg-navy text-white" : "hover:border-riptide")}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
