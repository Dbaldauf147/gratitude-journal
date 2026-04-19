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

export default function MeditationsTab() {
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  useEffect(() => {
    Object.entries(audioRefs.current).forEach(([id, audio]) => {
      if (!audio) return;
      if (id !== playing) audio.pause();
    });
  }, [playing]);

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

      <div className="space-y-4">
        {MEDITATIONS.map((m) => (
          <article
            key={m.id}
            className="bg-[var(--surface)] rounded-2xl p-6 shadow-sm border border-[var(--border)]"
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
                  <span className="text-[10px] tracking-widest uppercase text-[var(--text-muted)]">
                    {m.type}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed mt-1.5">
                  {m.description}
                </p>
              </div>
            </div>

            <audio
              ref={(el) => {
                audioRefs.current[m.id] = el;
              }}
              src={`/meditations/${m.id}.mp3`}
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
    </div>
  );
}
