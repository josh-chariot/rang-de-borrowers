"use client";

import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Accordion, Button, Footer, Header, Input, MotionIcon, PillTicker, Popup, Slider, Tabs } from "@/components/ui";
import type { MotionIconName, TickerPill } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { Gallery } from "./Gallery";
import type { GalleryFocus } from "./Gallery";
import { Intro } from "./Intro";
import { DEFAULT_LEVEL, DESKTOP_LEVELS, easeInOut, faceBackground, lerp, levelsFor } from "./engine";
import { FACE_COUNT } from "./faces";
import type { Borrower, GroupBy } from "./data";
import {
  FIRST_YEAR,
  LAST_YEAR,
  LIVELIHOODS,
  MONTHS,
  OUTCOME_LABEL,
  STATES,
  formatRupees,
  getBorrowers,
  groupBorrowers,
} from "./data";

/** intro = canvas sequence; title = headline fades in at the centre; settled = headline up, cards in. */
type Phase = "intro" | "title" | "settled";
const TITLE_HOLD_MS = 1100;

/** Directory tabs. The first three are where the hero cards land when they morph into tabs. */
const GROUPS: { id: GroupBy; label: string }[] = [
  { id: "year", label: "View by Year" },
  { id: "state", label: "View by State" },
  { id: "livelihood", label: "View by Livelihood" },
  { id: "outcome", label: "View by Outcome" },
];

/** Cards-to-tabs morph length, ms. */
const MORPH_MS = 800;
const MORPH_EASE = "cubic-bezier(0.65, 0, 0.35, 1)";

const FAQS = [
  {
    q: "Who is in this directory?",
    a: "Entrepreneurs who have received a loan through Rang De, including those who have repaid in full and those still repaying.",
  },
  {
    q: "Can I invest in these borrowers?",
    a: "These loans are already funded. To lend to someone today, head to the live investment opportunities.",
  },
  {
    q: "What does “Took a second loan” mean?",
    a: "The borrower repaid an earlier loan in full and came back for another one to grow their business further.",
  },
  {
    q: "How do I find someone I funded?",
    a: "Search by their name or village in the bar at the bottom of the gallery. Logged-in investors will also see the borrowers they funded.",
  },
];

/** Six faces for the mosaic on each hero card: a different shuffled set per card. */
function mosaicFaces(card: number) {
  return Array.from({ length: 6 }, (_, n) => (card * 41 + n * 37 + ((n * n) % 11)) % FACE_COUNT);
}

/** On touch screens a card's icon plays when it's the card nearest the middle of the screen, with at least this share of it visible. */
const MIN_VISIBLE_SHARE = 0.5;

function endDate(b: Borrower) {
  const m = b.month + b.tenure;
  return `${MONTHS[m % 12]} ${b.year + Math.floor(m / 12)}`;
}

export function BorrowersPage() {
  const all = useMemo(() => getBorrowers(), []);
  const [phase, setPhase] = useState<Phase>("intro");
  const [groupBy, setGroupBy] = useState<GroupBy>("year");
  const [levels, setLevels] = useState(DESKTOP_LEVELS);
  /** Zoom level the gallery is heading to (0 = most zoomed out). */
  const [level, setLevel] = useState(DEFAULT_LEVEL);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<GalleryFocus | null>(null);
  const [selected, setSelected] = useState<Borrower | null>(null);
  const [dockVisible, setDockVisible] = useState(false);
  const [geom, setGeom] = useState({ offset: 0, panelH: 0, heroMin: 0, titleShift: 0, dockH: 0 });

  const heroRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const dirHeadRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  /** The directory tabs appear once the hero cards have morphed into them (on card click or scrolling down). */
  const [tabsShown, setTabsShown] = useState(false);
  const morphState = useRef<"idle" | "running" | "done">("idle");
  /** Touch screens: index of the hero card that fills most of the screen, or -1. */
  const [cardInView, setCardInView] = useState(-1);

  const q = useDeferredValue(query.trim().toLowerCase());
  const filtered = useMemo(
    () => (q ? all.filter((b) => b.name.toLowerCase().includes(q) || b.village.toLowerCase().includes(q)) : all),
    [all, q],
  );
  const sections = useMemo(() => groupBorrowers(filtered, groupBy), [filtered, groupBy]);

  // Hero cards: each pill opens the gallery grouped that way, at that pill's section.
  const ways: { by: GroupBy; title: string; icon: MotionIconName; text: string; pills: TickerPill[] }[] = [
    {
      by: "year",
      title: "Year",
      icon: "calendar-dots-morph-select",
      text: "Glance through businesses year-by-year back up till 2019",
      pills: Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => String(FIRST_YEAR + i)).map((y) => ({ id: y, label: y })),
    },
    {
      by: "state",
      title: "State",
      icon: "location-pin-morph-select",
      text: "Find entrepreneurs near the place you call home, who have been funded",
      pills: STATES.map((s) => ({ id: s, label: s })),
    },
    {
      by: "livelihood",
      title: "Livelihood",
      icon: "heart-morph-select",
      text: "Look at rural entrepreneurs by what they do to earn a living",
      pills: LIVELIHOODS.map((l) => ({ id: l.name, label: l.people })),
    },
  ];

  // Play the intro unless the visitor prefers reduced motion. Input skips it, except browser zoom
  // (ctrl/cmd with + / − / 0 or the wheel, trackpad pinch, two-finger touch), which the intro rides through.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPhase("settled");
  }, []);

  useEffect(() => {
    if (phase === "settled") return;
    const root = document.documentElement;
    root.style.overflow = "hidden";
    window.scrollTo(0, 0);
    const skip = (e: Event) => {
      if (e instanceof WheelEvent && e.ctrlKey) return;
      if (e instanceof KeyboardEvent && (e.ctrlKey || e.metaKey || ["Control", "Meta", "Alt", "Shift"].includes(e.key))) return;
      if (typeof TouchEvent !== "undefined" && e instanceof TouchEvent && e.touches.length > 1) return;
      setPhase("settled");
    };
    const events = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    events.forEach((e) => window.addEventListener(e, skip, { passive: true }));
    const timer = phase === "title" ? setTimeout(() => setPhase("settled"), TITLE_HOLD_MS) : undefined;
    return () => {
      root.style.overflow = "";
      events.forEach((e) => window.removeEventListener(e, skip));
      clearTimeout(timer);
    };
  }, [phase]);

  // Measurements that depend on the viewport and the sticky header.
  const measure = useCallback(() => {
    // The directory's title + tabs bar sticks to the top, and the gallery fills the rest of the screen.
    const offset = dirHeadRef.current?.offsetHeight ?? 0;
    const title = titleRef.current;
    const cards = cardsRef.current;
    const hero = heroRef.current;
    if (!title || !cards || !hero) return;
    const heroTop = hero.getBoundingClientRect().top + window.scrollY;
    setGeom((g) => ({
      ...g,
      offset,
      panelH: window.innerHeight - offset,
      heroMin: window.innerHeight - heroTop,
      // Distance that centres the headline on its own before the cards arrive.
      titleShift: (cards.offsetTop + cards.offsetHeight - title.offsetTop - title.offsetHeight) / 2,
    }));
    const nextLevels = levelsFor(window.innerWidth);
    setLevels((cur) => (cur === nextLevels ? cur : nextLevels));
  }, []);

  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  useEffect(() => setLevel((l) => Math.min(l, levels.length - 1)), [levels]);

  // Dock height, so the last gallery row can scroll clear of it.
  useEffect(() => {
    const dock = dockRef.current!;
    const space = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--space-4"));
    const ro = new ResizeObserver(() => setGeom((g) => ({ ...g, dockH: dock.offsetHeight + space })));
    ro.observe(dock);
    return () => ro.disconnect();
  }, []);

  // Dock shows while the gallery fills most of the screen.
  useEffect(() => {
    const io = new IntersectionObserver(([entry]) => setDockVisible(entry.intersectionRatio >= 0.4), {
      threshold: [0, 0.4, 1],
    });
    io.observe(panelRef.current!);
    return () => io.disconnect();
  }, []);


  useEffect(() => {
    if (!selected) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selected]);

  /**
   * The three hero cards shrink and fly into the first three directory tabs, once. Each card's title
   * travels into its tab label (taking the tab's size, weight and colour) while everything else on the
   * card fades; then the real tab row, including "View by Outcome", fades in under the clones.
   * Runs frame by frame against the tabs' live position, so the cards land on them even while the page
   * is still scrolling (card click) or the tab bar is still moving up to pin itself (scrolling down).
   */
  const morphCardsIntoTabs = useCallback(() => {
    if (morphState.current !== "idle") return;
    morphState.current = "running";
    const cards = [...document.querySelectorAll<HTMLElement>("[data-explore-card]")].slice(0, 3);
    const tabs = [...(tabsRef.current?.querySelectorAll<HTMLElement>("[role=tab]") ?? [])];
    const finish = () => {
      setTabsShown(true);
      morphState.current = "done";
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || cards.length < 3 || tabs.length < 3) return finish();

    const css = getComputedStyle(document.documentElement);
    const v = (name: string) => css.getPropertyValue(name).trim();
    const layer = document.createElement("div");
    layer.setAttribute("aria-hidden", "true");
    Object.assign(layer.style, { position: "fixed", inset: "0", zIndex: "35", pointerEvents: "none", transition: "opacity 200ms" });
    document.body.appendChild(layer);
    const colourMotion = `${MORPH_MS}ms ${MORPH_EASE}`;

    const pieces = cards.map((card, i) => {
      const tab = tabs[i];
      const title = card.querySelector<HTMLElement>("[data-card-title]")!;
      const heading = getComputedStyle(title.parentElement!);
      const tabStyle = getComputedStyle(tab);
      const r = card.getBoundingClientRect();
      const t = title.getBoundingClientRect();
      // Start points in page coordinates: the cards stay put on the page while the viewport scrolls.
      const from = { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
      const textFrom = { x: t.left + window.scrollX, y: t.top + window.scrollY };

      const box = document.createElement("div");
      Object.assign(box.style, {
        position: "absolute",
        backgroundColor: v("--color-bg-grey"),
        borderRadius: v("--radius-4"),
        transition: `background-color ${colourMotion}, border-radius ${colourMotion}`,
      });
      const text = document.createElement("span");
      text.textContent = title.textContent;
      Object.assign(text.style, {
        position: "absolute",
        whiteSpace: "nowrap",
        fontWeight: heading.fontWeight,
        color: heading.color,
        transition: `color ${colourMotion}`,
      });
      layer.append(box, text);
      return {
        card,
        tab,
        box,
        text,
        from,
        textFrom,
        font: [parseFloat(heading.fontSize), parseFloat(tabStyle.fontSize)],
        line: [parseFloat(heading.lineHeight), parseFloat(tabStyle.lineHeight)],
        toWeight: tabStyle.fontWeight,
        toColour: tabStyle.color,
      };
    });

    const begin = performance.now();
    let raf = 0;
    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true;
      cancelAnimationFrame(raf);
      finish();
      layer.style.opacity = "0";
      window.setTimeout(() => layer.remove(), 220);
      // The hero cards come back for when the visitor scrolls up again.
      for (const p of pieces) p.card.style.opacity = "";
    };
    const frame = (now: number) => {
      const elapsed = now - begin;
      const k = easeInOut(Math.min(elapsed / MORPH_MS, 1));
      for (const p of pieces) {
        // Targets are measured every frame, so a moving tab bar is followed exactly.
        const to = p.tab.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(p.tab);
        const label = range.getBoundingClientRect();
        const fx = p.from.x - window.scrollX;
        const fy = p.from.y - window.scrollY;
        Object.assign(p.box.style, {
          left: `${lerp(fx, to.left, k)}px`,
          top: `${lerp(fy, to.top, k)}px`,
          width: `${lerp(p.from.w, to.width, k)}px`,
          height: `${lerp(p.from.h, to.height, k)}px`,
        });
        Object.assign(p.text.style, {
          left: `${lerp(p.textFrom.x - window.scrollX, label.left, k)}px`,
          top: `${lerp(p.textFrom.y - window.scrollY, label.top, k)}px`,
          fontSize: `${lerp(p.font[0], p.font[1], k)}px`,
          lineHeight: `${lerp(p.line[0], p.line[1], k)}px`,
        });
        if (k >= 0.5) p.text.style.fontWeight = p.toWeight;
        // Surface and text colours ease to the tab's (CSS transitions, started on the first frame).
        const selected = p.tab.getAttribute("aria-selected") === "true";
        p.box.style.backgroundColor = selected ? v("--color-white-100") : "transparent";
        p.box.style.borderRadius = v("--radius-2");
        p.text.style.color = p.toColour;
        // Everything else on the card fades in the first third.
        p.card.style.opacity = String(1 - Math.min(elapsed / (MORPH_MS / 3), 1));
      }
      if (elapsed >= MORPH_MS) end();
      else raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    // Safety net: the tabs always appear, even if frames are throttled (e.g. a background tab).
    window.setTimeout(end, MORPH_MS + 600);
  }, []);

  // Touch screens have no hover, so the icon plays on the card in the middle of the screen instead.
  useEffect(() => {
    if (phase !== "settled" || !window.matchMedia("(hover: none)").matches) return;
    // Three rectangles per scroll is cheap, so this runs directly on the scroll event.
    const pick = () => {
      const h = window.innerHeight;
      let best = -1;
      let bestDist = Infinity;
      document.querySelectorAll<HTMLElement>("[data-explore-card]").forEach((card, i) => {
        const r = card.getBoundingClientRect();
        const seen = Math.max(0, Math.min(r.bottom, h) - Math.max(r.top, 0));
        const dist = Math.abs(r.top + r.height / 2 - h / 2);
        if (seen >= r.height * MIN_VISIBLE_SHARE && dist < bestDist) [best, bestDist] = [i, dist];
      });
      setCardInView(best);
    };
    pick();
    window.addEventListener("scroll", pick, { passive: true });
    window.addEventListener("resize", pick);
    return () => {
      window.removeEventListener("scroll", pick);
      window.removeEventListener("resize", pick);
    };
  }, [phase]);

  // Scrolling into the gallery (the search bar has come up) morphs the cards into the tabs too.
  useEffect(() => {
    if (dockVisible && phase === "settled") morphCardsIntoTabs();
  }, [dockVisible, phase, morphCardsIntoTabs]);

  /** Scrolls so the directory's title + tabs bar sits at the top, with the gallery under it. */
  function scrollToGallery() {
    const head = dirHeadRef.current!;
    const sectionTop = head.parentElement!.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: sectionTop, behavior: "smooth" });
  }

  function explore(by: GroupBy) {
    setGroupBy(by);
    morphCardsIntoTabs();
    scrollToGallery();
  }

  /** Opens the gallery grouped by `by`, scrolled to the section `key` (a year, state or livelihood). */
  function jumpTo(by: GroupBy, key: string) {
    setGroupBy(by);
    morphCardsIntoTabs();
    setFocus((f) => ({ section: key, nonce: (f?.nonce ?? 0) + 1 }));
    scrollToGallery();
  }

  function stepZoom(delta: number) {
    setLevel((l) => Math.min(Math.max(l + delta, 0), levels.length - 1));
  }

  function surprise() {
    const pool = filtered.length ? filtered : all;
    const b = pool[Math.floor(Math.random() * pool.length)];
    setLevel(levels.length - 1);
    setFocus((f) => ({ id: b.id, nonce: (f?.nonce ?? 0) + 1 }));
    scrollToGallery();
  }

  const shown = phase !== "intro";
  const settled = phase === "settled";

  return (
    <>
      {phase === "intro" && <Intro onDone={() => setPhase("title")} />}

      <div className={cn("transition-opacity duration-500", shown ? "opacity-100" : "opacity-0")}>
        <main>
          {/* The site header is sticky only within this wrapper, so it leaves with the hero. Bottom padding
              (not a child) is where it stops: 40px above the directory + the 16px its white card overhangs. */}
          <div style={{ paddingBottom: "calc(var(--space-7) + var(--space-4))" }}>
            <Header banner="Hear Rang De’s story directly from the Rang De founders Ram and Smita!" />
            {/* Hero: headline, then three ways to explore. */}
            <section
              ref={heroRef}
              className="mx-auto flex w-full max-w-page flex-col items-center justify-center px-4 py-r8"
              style={{ minHeight: geom.heroMin || undefined }}
            >
              <div className="relative flex w-full flex-col items-center">
                <h1
                  ref={titleRef}
                  className={cn(
                    "max-w-hero text-center text-h2 font-bold text-text-grey-100 transition-all duration-700 ease-out",
                    shown ? "opacity-100" : "opacity-0",
                  )}
                  style={{ transform: `translateY(${settled ? 0 : geom.titleShift}px)` }}
                >
                  Meet the <span className="text-primary-100">31,000+ rural entrepreneurs</span> backed by people like
                  you
                </h1>

                <div ref={cardsRef} className="mt-9 grid w-full gap-r4 md:grid-cols-3">
                  {ways.map((way, i) => (
                    <ExploreCard
                      key={way.by}
                      index={i}
                      title={way.title}
                      icon={way.icon}
                      text={way.text}
                      pills={way.pills}
                      shown={settled}
                      inView={cardInView === i}
                      onOpen={() => explore(way.by)}
                      onPill={(key) => jumpTo(way.by, key)}
                    />
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Directory: the zoomable gallery of every past borrower. */}
          <section className="bg-bg-grey">
            {/* Compact bar that takes over from the site header as the sticky top. */}
            <div
              ref={dirHeadRef}
              className="sticky top-zero z-30 backdrop-blur-md"
              style={{ backgroundColor: "color-mix(in srgb, var(--color-bg-grey) 64%, transparent)" }}
            >
              <div className="mx-auto flex w-full max-w-page flex-col items-center gap-x24 px-4 py-4">
                <h2 className="text-center text-h5 font-bold uppercase text-text-grey-64">All past borrowers</h2>
                <div
                  ref={tabsRef}
                  className={cn("w-full transition-opacity duration-200 md:w-fit", tabsShown ? "opacity-100" : "pointer-events-none opacity-0")}
                >
                  <Tabs
                    level={2}
                    size="lg"
                    items={GROUPS}
                    value={groupBy}
                    onChange={(id) => setGroupBy(id as GroupBy)}
                    className="max-md:grid max-md:grid-cols-2"
                  />
                </div>
              </div>
            </div>

            <div ref={panelRef} className="relative bg-white-100">
              {geom.panelH > 0 && (
                <Gallery
                  sections={sections}
                  levels={levels}
                  zoom={level}
                  onZoomChange={setLevel}
                  onOpen={setSelected}
                  height={geom.panelH}
                  padBottom={geom.dockH}
                  focus={focus}
                />
              )}
              {!filtered.length && (
                <div className="absolute inset-zero grid place-items-center p-r4">
                  <p className="text-center text-p2 font-medium text-text-grey-64">
                    No borrowers match “{query.trim()}”. Try a first name or a village.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="mx-auto flex w-full max-w-faq flex-col items-center gap-r5 px-4 py-r9">
            <h2 className="text-center text-h4 font-bold text-text-grey-100">Questions about past borrowers</h2>
            <div className="flex w-full flex-col">
              {FAQS.map((f, i) => (
                <Accordion
                  key={f.q}
                  title={f.q}
                  defaultOpen={i === 0}
                  className="border-b border-text-grey-16 py-r4"
                >
                  {f.a}
                </Accordion>
              ))}
            </div>
          </section>
        </main>

        <Footer className="border-t border-text-grey-8" />
      </div>

      {/* Bottom bar, edge to edge in one row: search, Surprise me, zoom (caption under the slider). */}
      <div
        className={cn(
          "fixed inset-x-zero bottom-zero z-30 transition-all duration-300 ease-out",
          dockVisible && settled ? "translate-none opacity-100" : "pointer-events-none translate-y-full opacity-0",
        )}
      >
        <div ref={dockRef} className="flex w-full flex-wrap items-center gap-x-r4 gap-y-2 bg-white-100 px-r4 py-3 shadow-band md:flex-nowrap">
          <Input
            label="Search by name or village"
            endIcon={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 md:w-2/5 md:flex-none"
          />
          <Button variant="pill" onClick={surprise}>
            Surprise me
          </Button>
          <div className="flex w-full min-w-0 flex-col gap-f1 md:w-auto md:flex-1">
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" aria-label="Zoom out" onClick={() => stepZoom(-1)}>
                −
              </Button>
              <Slider
                label="Zoom"
                min={0}
                max={levels.length - 1}
                value={level}
                onChange={setLevel}
                className="flex-1"
              />
              <Button variant="secondary" size="sm" aria-label="Zoom in" onClick={() => stepZoom(1)}>
                +
              </Button>
            </div>
            <p className="text-center text-p4 font-medium text-text-grey-80">
              Zoom out to see more entrepreneurs at a time, zoom in to narrow down the entrepreneurs you see
            </p>
          </div>
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-zero z-50 grid place-items-center bg-text-grey-48 p-4"
          onClick={() => setSelected(null)}
          role="dialog"
          aria-modal="true"
          aria-label={selected.name}
        >
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Popup
              variant="default"
              title={selected.name}
              text={`${selected.livelihood} in ${selected.village}, ${selected.state}. Borrowed ${formatRupees(selected.amount)} for ${selected.purpose}, over ${selected.tenure} months.`}
              timeline={[
                { label: "Loan funded", date: `${MONTHS[selected.month]} ${selected.year}` },
                {
                  label: OUTCOME_LABEL[selected.outcome],
                  date: selected.outcome === "repaying" ? `Due ${endDate(selected)}` : endDate(selected),
                },
              ]}
              onClose={() => setSelected(null)}
            />
          </div>
        </div>
      )}
    </>
  );
}

type ExploreCardProps = {
  index: number;
  title: string;
  icon: MotionIconName;
  text: string;
  pills: TickerPill[];
  /** Hidden (and below its spot) until the hero settles, then rises in. */
  shown: boolean;
  /** Touch screens: this is the card filling most of the screen, so its icon plays. */
  inView: boolean;
  onOpen: () => void;
  onPill: (key: string) => void;
};

/**
 * Hero card: face mosaic, title + animated icon, body copy, a ticker of pills.
 * Mouse: hovering fills the icon, leaving plays it back. Touch: the icon fills on the card in the
 * middle of the screen as you scroll (`inView`), nothing on press.
 */
function ExploreCard({ index, title, icon, text, pills, shown, inView, onOpen, onPill }: ExploreCardProps) {
  const [active, setActive] = useState(false);
  // Slow, staggered rise on entry; quick transitions for hover after that.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setEntered(true), 700 + index * 90);
    return () => clearTimeout(timer);
  }, [shown, index]);

  return (
    <div
      data-explore-card
      role="button"
      tabIndex={shown ? 0 : -1}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
        e.preventDefault();
        onOpen();
      }}
      onPointerEnter={(e) => e.pointerType === "mouse" && setActive(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setActive(false)}
      onFocus={(e) => e.target === e.currentTarget && setActive(true)}
      onBlur={() => setActive(false)}
      className={cn(
        "group flex cursor-pointer flex-col gap-r4 overflow-hidden rounded-4 bg-bg-grey p-r4 text-left outline-none ease-out hover:bg-white-100 hover:shadow-6 focus-visible:ring-4 focus-visible:ring-primary-24",
        entered ? "transition-all duration-300" : "transition-all duration-700",
        shown ? "translate-none opacity-100" : "pointer-events-none translate-y-r8 opacity-0",
      )}
      style={{ transitionDelay: shown && !entered ? `${index * 90}ms` : "0ms" }}
    >
      <div className="grid w-full grid-cols-6 gap-2" aria-hidden="true">
        {mosaicFaces(index).map((face, n) => (
          <span key={n} className="aspect-square rounded-4 bg-neutral-6" style={faceBackground(face)} />
        ))}
      </div>
      <div className="flex flex-col">
        <h3 className="flex items-center gap-2 text-p1 font-bold text-primary-100">
          <span data-card-title>
            <span className="text-text-grey-64">View by </span>
            {title}
          </span>
          <MotionIcon name={icon} size={32} active={active || inView} className="opacity-80" />
        </h3>
        <p className="mt-2 text-p3 font-medium text-text-grey-80">{text}</p>
        {/* Same width as the copy above; the fades sit at the strip's own edges. */}
        <PillTicker
          items={pills}
          onSelect={onPill}
          edgeClassName="from-bg-grey"
          edgeHoverClassName="from-white-100"
          className="mt-x24"
        />
      </div>
    </div>
  );
}
