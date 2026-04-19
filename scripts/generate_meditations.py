"""
One-time generator for meditation MP3s using Microsoft Edge neural TTS (free, no API key).
Run: python scripts/generate_meditations.py
Output: public/meditations/<id>.mp3
"""
import asyncio
import os
import subprocess
import tempfile
from pathlib import Path

import edge_tts

VOICE = "en-US-JennyNeural"
RATE = "-20%"
ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "meditations"

# Each meditation is a list of segments.
# A string segment is spoken text; an int segment is seconds of silence.
MEDITATIONS = {
    "mindfulness": {
        "title": "Mindfulness Meditation",
        "segments": [
            "Welcome to this five minute mindfulness meditation. Find a comfortable seated position, allow your hands to rest gently in your lap, and softly close your eyes.",
            6,
            "Take a slow, deep breath in through your nose. And gently exhale through your mouth.",
            8,
            "Bring your attention to the present moment. Notice the natural rhythm of your breath, without trying to change it.",
            12,
            "Now begin to notice any thoughts that arise. There is no need to push them away, and no need to follow them. Simply observe them, like clouds passing across an open sky.",
            15,
            "If you find yourself caught in a thought, gently acknowledge it, and return your attention to the breath.",
            12,
            "Notice the sensation of the air entering your nostrils. Cool on the inhale. Warmer on the exhale.",
            15,
            "Become aware of the sounds around you. Without labeling them as good or bad, simply let them rise and fall in your awareness.",
            15,
            "Notice any sensations in the body. Perhaps a slight tension in the shoulders, or a warmth in the hands. Acknowledge whatever is present, without judgment.",
            18,
            "Return now to the breath. This anchor is always here for you. Steady. Constant. Calm.",
            15,
            "When you feel ready, begin to deepen your breath. Wiggle your fingers and toes. And gently open your eyes, carrying this mindful awareness with you.",
            5,
        ],
    },
    "focused": {
        "title": "Focused Meditation",
        "segments": [
            "Welcome to this five minute focused meditation. Settle into a comfortable position, and softly close your eyes.",
            6,
            "Today we will train the mind by focusing on a single anchor: the breath.",
            6,
            "Begin by taking three slow, intentional breaths. In through the nose. Out through the mouth.",
            12,
            "Now allow the breath to return to its natural pace. Place your full attention on the sensation of breathing at the tip of your nose.",
            12,
            "Feel the cool air as it enters. Feel the warm air as it leaves.",
            15,
            "If your mind drifts, that is completely natural. Simply notice the wandering, and gently bring your focus back to the breath.",
            15,
            "Now count silently with each exhale. One. Two. Three. Up to ten. Then begin again at one.",
            20,
            "Continue counting at your own pace. If you lose count, simply start over, without frustration.",
            25,
            "Each return to the breath is the practice. Each return strengthens your focus, like a muscle.",
            20,
            "Now release the counting. Rest in the simple awareness of breathing.",
            15,
            "When you are ready, take one final, deeper breath. Open your eyes, and carry this clear, focused mind into your day.",
            5,
        ],
    },
    "loving-kindness": {
        "title": "Loving-Kindness Meditation",
        "segments": [
            "Welcome to this five minute loving-kindness meditation. Find a comfortable position, place a hand over your heart if you wish, and close your eyes.",
            6,
            "Take a few deep breaths, allowing your body to soften, and your heart to open.",
            10,
            "We begin by directing kindness toward ourselves. Silently repeat these phrases. May I be happy.",
            6,
            "May I be healthy.",
            6,
            "May I be safe.",
            6,
            "May I live with ease.",
            10,
            "Allow these wishes to settle into your body, like warm sunlight on your skin.",
            12,
            "Now bring to mind someone you love. A friend. A family member. A beloved pet. See them clearly in your mind.",
            8,
            "Send them these same wishes. May you be happy. May you be healthy. May you be safe. May you live with ease.",
            15,
            "Now bring to mind someone neutral. A neighbor. A coworker. Someone you see, but do not know well.",
            8,
            "Offer them the same kindness. May you be happy. May you be healthy. May you be safe. May you live with ease.",
            15,
            "Now, if you feel ready, bring to mind someone with whom you have difficulty. Gently send the same wishes. May you be happy. May you be healthy. May you be safe. May you live with ease.",
            15,
            "Finally, expand your circle of kindness to include all beings everywhere. May all beings be happy. May all beings be free from suffering.",
            15,
            "Take a deep breath. Feel the warmth in your heart. And when you are ready, gently open your eyes.",
            5,
        ],
    },
    "mantra": {
        "title": "Mantra Meditation",
        "segments": [
            "Welcome to this five minute mantra meditation. Sit comfortably, with your spine tall and your shoulders relaxed. Close your eyes.",
            6,
            "Take three deep, cleansing breaths.",
            10,
            "In mantra meditation, we use the repetition of a word or phrase to calm the mind. Today we will use the word peace.",
            8,
            "On your next inhale, silently say the word peace. On your exhale, silently say the word peace.",
            12,
            "Continue this rhythm. Peace on the inhale. Peace on the exhale.",
            20,
            "If your mind wanders, simply return to the word. Peace.",
            20,
            "Let the word ride on the breath. Let it become as natural as breathing itself.",
            25,
            "Notice how the mind begins to quiet. How thoughts soften. How the spaces between thoughts grow wider.",
            25,
            "Continue silently with the mantra. Peace. Peace. Peace.",
            30,
            "Now slowly let the mantra fade. Rest in the silence that remains.",
            15,
            "Take a deep breath. Bring movement back into your fingers and toes. And gently open your eyes.",
            5,
        ],
    },
    "transcendental": {
        "title": "Transcendental-Style Meditation",
        "segments": [
            "Welcome to this five minute transcendental-style meditation. Note that authentic Transcendental Meditation requires a personalized mantra from a certified teacher. This is a gentle introduction, using a traditional sound.",
            6,
            "Sit comfortably with your back supported, hands resting in your lap, and eyes softly closed.",
            8,
            "Take a few natural breaths. Do not try to control them.",
            12,
            "We will use the sound, ah-hum. A neutral sound that carries no meaning.",
            6,
            "Silently, in your mind, begin to repeat. Ah-hum. Ah-hum.",
            12,
            "Do not force the sound. Let it arise effortlessly, like a thought that drifts in on its own.",
            15,
            "If thoughts come, this is natural. Simply, easily, return to the sound.",
            20,
            "There is no effort here. No concentration. Just a gentle, easy repetition.",
            25,
            "If the sound changes, becomes faint, or fades into silence, allow it. This is the mind settling.",
            30,
            "Continue resting with the sound, or with the silence, whichever appears.",
            30,
            "Slowly, begin to let the practice come to a close. Sit quietly for a moment.",
            15,
            "When you are ready, gently open your eyes, taking your time to return.",
            5,
        ],
    },
    "body-scan": {
        "title": "Body Scan Meditation",
        "segments": [
            "Welcome to this five minute body scan meditation. Lie down or sit comfortably, and softly close your eyes.",
            6,
            "Take a slow, deep breath in. And a long, complete exhale.",
            10,
            "We will move our attention slowly through the body, releasing tension as we go.",
            6,
            "Begin at the top of your head. Notice any sensation here. Soften the scalp.",
            10,
            "Move down to your forehead. Release the space between the eyebrows. Let the eyes feel heavy.",
            10,
            "Relax the jaw. Let the tongue rest softly behind the teeth.",
            10,
            "Move into the neck and shoulders. Allow them to drop, away from the ears.",
            12,
            "Bring awareness to your arms. Down through the upper arms, the elbows, the forearms, the wrists. And into the hands and fingers.",
            15,
            "Notice your chest. Feel it rise and fall with each breath.",
            12,
            "Bring attention to your belly. Let it be soft. Let it expand fully with each inhale.",
            12,
            "Move into your back. Release any holding along the spine.",
            12,
            "Bring awareness to the hips. The pelvis. Let everything settle and soften.",
            12,
            "Move down through the thighs. The knees. The calves. The ankles.",
            15,
            "And finally, into the feet. Notice each toe. Let the entire body feel heavy and supported.",
            15,
            "Rest now in the awareness of the whole body, breathing as one.",
            15,
            "When you are ready, take a deeper breath. Wiggle your fingers and toes. Slowly open your eyes.",
            5,
        ],
    },
    "movement": {
        "title": "Movement Meditation",
        "segments": [
            "Welcome to this five minute movement meditation. This practice is designed to be done while walking slowly, either indoors or outdoors. If you prefer, you may also do it seated, gently swaying with the breath.",
            8,
            "Begin by standing tall, with your feet shoulder width apart. Take a deep breath in. And exhale.",
            10,
            "Bring your attention to the soles of your feet. Notice the points of contact with the ground.",
            12,
            "Begin to walk slowly. Much slower than your usual pace.",
            8,
            "As you lift one foot, notice the sensation of weight shifting. As you place the foot down, notice the contact with the earth.",
            15,
            "Coordinate with your breath. Inhale as you step. Exhale as you step.",
            20,
            "Feel the muscles working in your legs. The gentle swing of your arms. The subtle adjustments in your balance.",
            20,
            "If you walk outdoors, notice the air on your skin. The sounds around you. The colors of your surroundings.",
            20,
            "If your mind wanders, return to the sensation of your feet on the ground.",
            20,
            "Each step is an arrival. Each step is complete in itself.",
            20,
            "Slowly come to a stop. Stand quietly for a moment, feeling the stillness after motion.",
            15,
            "Take a final deep breath. Carry this present-moment awareness into your next activity.",
            5,
        ],
    },
    "guided": {
        "title": "Guided Visualization",
        "segments": [
            "Welcome to this five minute guided visualization. Find a quiet, comfortable place to sit or lie down. Gently close your eyes.",
            6,
            "Take three deep, relaxing breaths. Allow your body to soften.",
            12,
            "Imagine yourself walking along a quiet path. The air is warm. The light is soft and golden.",
            10,
            "You can hear birds singing in the distance. A gentle breeze touches your skin.",
            10,
            "The path leads you into a peaceful clearing. In the center of the clearing is a small, still pond.",
            10,
            "You walk to the edge of the pond and sit down on the soft grass. The water is perfectly clear, perfectly calm.",
            12,
            "Look at your reflection in the water. See yourself, exactly as you are, with kindness.",
            15,
            "Imagine that any worries you carry today are small leaves resting on the surface of the water. One by one, watch them gently drift away.",
            20,
            "As each leaf disappears, you feel lighter. More peaceful. More at ease.",
            15,
            "The water is now still and clear. Your mind is still and clear.",
            15,
            "Sit here, in this quiet place, for as long as you wish. Knowing you can return whenever you need.",
            20,
            "Slowly, begin to make your way back along the path. Bring the calm of the clearing with you.",
            10,
            "Take a deep breath. Feel your body. Open your eyes when you are ready.",
            5,
        ],
    },
    "vipassana": {
        "title": "Vipassana-Style Meditation",
        "segments": [
            "Welcome to this five minute vipassana, or insight, meditation. This practice helps us see things as they really are.",
            6,
            "Sit in a stable, comfortable position. Spine tall. Eyes softly closed.",
            8,
            "Begin with three deep breaths.",
            12,
            "Now allow the breath to return to its natural rhythm.",
            8,
            "Bring your attention to the rising and falling of your abdomen. As you inhale, the belly rises. As you exhale, the belly falls.",
            15,
            "Silently note: rising. Falling.",
            15,
            "When a sound arises, gently note: hearing.",
            12,
            "When a thought appears, simply note: thinking. Then return to the breath.",
            15,
            "When a sensation arises in the body, note it: tingling, warmth, pressure. Observe without reacting.",
            20,
            "Notice how every experience comes, and every experience goes. Nothing stays the same.",
            20,
            "This is the nature of all things. They arise. They pass.",
            20,
            "Rest in this clear awareness. Watching. Knowing. Not clinging.",
            25,
            "Take a deeper breath. Become aware of the body as a whole. Slowly, gently, open your eyes.",
            5,
        ],
    },
    "chakra": {
        "title": "Chakra Meditation",
        "segments": [
            "Welcome to this five minute chakra meditation. We will move attention through the seven energy centers of the body, balancing each in turn.",
            6,
            "Sit with your spine straight. Hands resting on your thighs. Eyes closed.",
            8,
            "Take three slow, deep breaths.",
            12,
            "Bring your attention to the base of your spine. The root chakra. Visualize a deep red light here. Steady. Grounding. Feel rooted to the earth.",
            18,
            "Move your awareness to just below the navel. The sacral chakra. Visualize a warm orange light. Creative. Flowing. Open.",
            18,
            "Bring attention to the upper abdomen. The solar plexus chakra. See a bright yellow light. Confidence. Strength. Personal power.",
            18,
            "Move to the center of your chest. The heart chakra. Visualize a soft green light. Love. Compassion. Connection.",
            18,
            "Bring attention to the throat. The throat chakra. See a clear blue light. Truth. Expression. Authenticity.",
            18,
            "Move to the space between your eyebrows. The third eye chakra. Visualize a deep indigo light. Intuition. Insight. Inner wisdom.",
            18,
            "Bring attention to the crown of your head. The crown chakra. See a brilliant violet, or pure white, light. Connection to all that is.",
            18,
            "Now visualize all seven lights, glowing together, in perfect balance, throughout your body.",
            20,
            "Take a deep breath. Feel the harmony in your system. Slowly open your eyes.",
            5,
        ],
    },
}


async def generate_speech(text: str, out_path: Path) -> None:
    communicate = edge_tts.Communicate(text, VOICE, rate=RATE)
    await communicate.save(str(out_path))


def make_silence(seconds: float, out_path: Path) -> None:
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "lavfi", "-i", f"anullsrc=r=24000:cl=mono",
            "-t", str(seconds),
            "-q:a", "9", "-acodec", "libmp3lame",
            str(out_path),
        ],
        check=True,
    )


def concat_mp3s(parts: list[Path], out_path: Path) -> None:
    list_file = out_path.with_suffix(".txt")
    with open(list_file, "w", encoding="utf-8") as f:
        for p in parts:
            f.write(f"file '{p.as_posix()}'\n")
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "concat", "-safe", "0", "-i", str(list_file),
            "-c:a", "libmp3lame", "-b:a", "64k",
            str(out_path),
        ],
        check=True,
    )
    list_file.unlink(missing_ok=True)


async def build_meditation(med_id: str, med: dict) -> None:
    print(f"Building {med_id}...")
    out_file = OUT_DIR / f"{med_id}.mp3"
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        parts: list[Path] = []
        for i, seg in enumerate(med["segments"]):
            part = tmp_path / f"{med_id}_{i:03d}.mp3"
            if isinstance(seg, str):
                await generate_speech(seg, part)
            else:
                make_silence(float(seg), part)
            parts.append(part)
        concat_mp3s(parts, out_file)
    print(f"  Wrote {out_file}")


async def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for med_id, med in MEDITATIONS.items():
        await build_meditation(med_id, med)
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
