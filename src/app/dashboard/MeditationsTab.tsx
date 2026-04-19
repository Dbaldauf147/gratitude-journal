"use client";

import { useEffect, useRef, useState } from "react";

interface Meditation {
  id: string;
  title: string;
  type: string;
  description: string;
  accent: string;
}

const MEDITATIONS: Meditation[] = [
  {
    id: "mindfulness",
    title: "Mindfulness Meditation",
    type: "Awareness",
    description:
      "Focus on being intensely aware of the present moment, observing thoughts without judgment.",
    accent: "var(--pastel-rose)",
  },
  {
    id: "focused",
    title: "Focused Meditation",
    type: "Concentration",
    description:
      "Use the senses to concentrate, anchoring the mind on the breath.",
    accent: "var(--pastel-lavender)",
  },
  {
    id: "loving-kindness",
    title: "Loving-Kindness (Metta)",
    type: "Compassion",
    description:
      "Cultivate feelings of compassion, love, and kindness toward yourself and others.",
    accent: "var(--pastel-sage)",
  },
  {
    id: "mantra",
    title: "Mantra Meditation",
    type: "Repetition",
    description:
      "Repeat a calming word to quiet distracting thoughts and settle the mind.",
    accent: "var(--pastel-rose)",
  },
  {
    id: "transcendental",
    title: "Transcendental-Style",
    type: "Mantra",
    description:
      "A gentle, effortless mantra-based technique designed to settle the mind into deep calm.",
    accent: "var(--pastel-lavender)",
  },
  {
    id: "body-scan",
    title: "Body Scan",
    type: "Relaxation",
    description:
      "Move attention through the body, systematically relaxing muscles from head to toe.",
    accent: "var(--pastel-sage)",
  },
  {
    id: "movement",
    title: "Movement Meditation",
    type: "Active",
    description:
      "An active practice using gentle, mindful walking to connect with the body.",
    accent: "var(--pastel-rose)",
  },
  {
    id: "guided",
    title: "Guided Visualization",
    type: "Imagery",
    description:
      "A peaceful, image-led journey to a quiet inner clearing — ideal for beginners.",
    accent: "var(--pastel-lavender)",
  },
  {
    id: "vipassana",
    title: "Vipassana (Insight)",
    type: "Insight",
    description:
      "A traditional practice of self-observation, seeing experience clearly as it arises and passes.",
    accent: "var(--pastel-sage)",
  },
  {
    id: "chakra",
    title: "Chakra Meditation",
    type: "Energy",
    description:
      "Balance and align the body's seven energy centers, from root to crown.",
    accent: "var(--pastel-rose)",
  },
];

const HIDDEN_KEY = "hiddenMeditations";
const VOICE_KEY = "meditationVoice";
const LENGTH_KEY = "meditationLength";

type Voice = "female" | "male";
type Length = 5 | 10;

export default function MeditationsTab() {
  const [playing, setPlaying] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [voice, setVoice] = useState<Voice>("female");
  const [length, setLength] = useState<Length>(5);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HIDDEN_KEY);
      if (raw) setHidden(new Set(JSON.parse(raw)));
      const v = localStorage.getItem(VOICE_KEY);
      if (v === "male" || v === "female") setVoice(v);
      const l = localStorage.getItem(LENGTH_KEY);
      if (l === "5" || l === "10") setLength(Number(l) as Length);
    } catch {}
  }, []);

  function stopAll() {
    Object.values(audioRefs.current).forEach((a) => a?.pause());
    setPlaying(null);
  }

  function chooseVoice(v: Voice) {
    setVoice(v);
    try {
      localStorage.setItem(VOICE_KEY, v);
    } catch {}
    stopAll();
  }

  function chooseLength(l: Length) {
    setLength(l);
    try {
      localStorage.setItem(LENGTH_KEY, String(l));
    } catch {}
    stopAll();
  }

  function persist(next: Set<string>) {
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(Array.from(next)));
    } catch {}
  }

  function hide(id: string) {
    const next = new Set(hidden);
    next.add(id);
    persist(next);
  }

  function unhide(id: string) {
    const next = new Set(hidden);
    next.delete(id);
    persist(next);
  }

  useEffect(() => {
    Object.entries(audioRefs.current).forEach(([id, audio]) => {
      if (!audio) return;
      if (id !== playing) audio.pause();
    });
  }, [playing]);

  const visible = MEDITATIONS.filter((m) => !hidden.has(m.id));
  const hiddenList = MEDITATIONS.filter((m) => hidden.has(m.id));

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-lg font-light text-[var(--text)] mb-1">
          Meditation Library
        </h2>
        <p className="text-xs text-[var(--text-muted)]">
          Ten guided sessions, around five minutes each.
        </p>
      </div>

      {/* Voice + length pickers */}
      <div className="flex justify-center gap-3 flex-wrap">
        <div className="inline-flex gap-1 p-1 bg-[var(--surface)] rounded-full border border-[var(--border)]">
          {(["female", "male"] as const).map((v) => (
            <button
              key={v}
              onClick={() => chooseVoice(v)}
              className={`px-4 py-1.5 rounded-full text-xs capitalize transition-colors ${
                voice === v
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {v} voice
            </button>
          ))}
        </div>
        <div className="inline-flex gap-1 p-1 bg-[var(--surface)] rounded-full border border-[var(--border)]">
          {([5, 10] as const).map((l) => (
            <button
              key={l}
              onClick={() => chooseLength(l)}
              className={`px-4 py-1.5 rounded-full text-xs transition-colors ${
                length === l
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {l} min
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {visible.map((m) => (
          <article
            key={m.id}
            className="bg-[var(--surface)] rounded-2xl p-6 shadow-sm border border-[var(--border)] group"
          >
            <div className="flex items-start gap-3 mb-3">
              <div
                className="w-2 h-2 rounded-full mt-2 shrink-0"
                style={{ backgroundColor: m.accent }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <h3 className="text-base font-medium text-[var(--text)]">
                    {m.title}
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] tracking-widest uppercase text-[var(--text-muted)]">
                      {m.type}
                    </span>
                    <button
                      onClick={() => hide(m.id)}
                      className="text-xs text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                      title="Hide this meditation"
                    >
                      hide
                    </button>
                  </div>
                </div>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed mt-1.5">
                  {m.description}
                </p>
              </div>
            </div>

            <audio
              key={`${voice}-${length}`}
              ref={(el) => {
                audioRefs.current[m.id] = el;
              }}
              src={`/meditations/${m.id}-${voice}-${length}.mp3`}
              controls
              preload="none"
              onPlay={() => setPlaying(m.id)}
              onPause={() => {
                if (playing === m.id) setPlaying(null);
              }}
              onEnded={() => {
                if (playing === m.id) setPlaying(null);
              }}
              className="w-full mt-2"
            />
          </article>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="text-center text-sm text-[var(--text-muted)] py-8">
          All meditations are hidden. Use the panel below to bring some back.
        </p>
      )}

      {hiddenList.length > 0 && (
        <div className="pt-4">
          <button
            onClick={() => setShowHidden((s) => !s)}
            className="text-xs text-[var(--accent)] hover:underline block mx-auto"
          >
            {showHidden ? "Hide" : "Show"} hidden ({hiddenList.length})
          </button>
          {showHidden && (
            <div className="mt-4 bg-[var(--surface)] rounded-2xl p-6 shadow-sm border border-[var(--border)] space-y-3">
              {hiddenList.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: m.accent }}
                    />
                    <p className="text-sm text-[var(--text)] truncate">
                      {m.title}
                    </p>
                  </div>
                  <button
                    onClick={() => unhide(m.id)}
                    className="text-xs text-[var(--accent)] hover:underline shrink-0"
                  >
                    unhide
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
