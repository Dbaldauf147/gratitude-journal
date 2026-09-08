// Generates every home-screen asset the PWA needs: the manifest icons, the iOS
// apple-touch-icon, and the iOS launch images.
//
// Run with `npm run icons` after changing the mark or the palette. The output
// is committed, so a normal build/deploy never needs sharp.
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

// Straight from globals.css — the icon has to read as the same app.
const ACCENT = "#c4a882";
const ACCENT_DEEP = "#a8895f";
const CREAM = "#faf8f5";

// A sprig: one stem, five leaves. Simple enough to stay legible at 60px on a
// home screen, which is the only size that really matters.
const sprig = (scale) => `
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)"
     fill="none" stroke="${CREAM}" stroke-width="15"
     stroke-linecap="round" stroke-linejoin="round">
    <path d="M256 372 V150" />
    <path d="M256 200 C 256 160, 286 132, 322 128 C 322 168, 296 196, 256 200 Z" fill="${CREAM}" stroke="none"/>
    <path d="M256 200 C 256 160, 226 132, 190 128 C 190 168, 216 196, 256 200 Z" fill="${CREAM}" stroke="none"/>
    <path d="M256 266 C 256 226, 286 198, 322 194 C 322 234, 296 262, 256 266 Z" fill="${CREAM}" stroke="none"/>
    <path d="M256 266 C 256 226, 226 198, 190 194 C 190 234, 216 262, 256 266 Z" fill="${CREAM}" stroke="none"/>
    <path d="M256 332 C 256 292, 286 264, 322 260 C 322 300, 296 328, 256 332 Z" fill="${CREAM}" stroke="none"/>
    <path d="M256 332 C 256 292, 226 264, 190 260 C 190 300, 216 328, 256 332 Z" fill="${CREAM}" stroke="none"/>
  </g>`;

// `inset` shrinks the mark for the maskable icon, whose outer 20% can be
// cropped away by the launcher's chosen shape.
const iconSvg = ({ radius, inset = 1 }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${ACCENT}"/>
      <stop offset="1" stop-color="${ACCENT_DEEP}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${radius}" fill="url(#g)"/>
  ${sprig(inset)}
</svg>`;

// Launch image: the calm cream ground the app itself opens on, with the mark
// small and centred so the handoff into the real UI is unnoticeable.
const splashSvg = (w, h) => {
  const mark = Math.round(Math.min(w, h) * 0.22);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${CREAM}"/>
  <g transform="translate(${(w - mark) / 2} ${(h - mark) / 2}) scale(${mark / 512})">
    <rect width="512" height="512" rx="114" fill="${ACCENT}"/>
    ${sprig(1)}
  </g>
</svg>`;
};

// Device pixel dimensions for the iPhones and iPads still in circulation. iOS
// only shows a launch image when a tag matches the device EXACTLY, so a near
// miss silently falls back to a white flash.
const DEVICES = [
  { w: 1320, h: 2868, dpr: 3, cssW: 440, cssH: 956, name: "iphone-16-pro-max" },
  { w: 1206, h: 2622, dpr: 3, cssW: 402, cssH: 874, name: "iphone-16-pro" },
  { w: 1290, h: 2796, dpr: 3, cssW: 430, cssH: 932, name: "iphone-15-plus" },
  { w: 1179, h: 2556, dpr: 3, cssW: 393, cssH: 852, name: "iphone-15" },
  { w: 1284, h: 2778, dpr: 3, cssW: 428, cssH: 926, name: "iphone-12-pro-max" },
  { w: 1170, h: 2532, dpr: 3, cssW: 390, cssH: 844, name: "iphone-12-pro" },
  { w: 1080, h: 2340, dpr: 3, cssW: 360, cssH: 780, name: "iphone-13-mini" },
  { w: 1242, h: 2688, dpr: 3, cssW: 414, cssH: 896, name: "iphone-11-pro-max" },
  { w: 828, h: 1792, dpr: 2, cssW: 414, cssH: 896, name: "iphone-11" },
  { w: 1125, h: 2436, dpr: 3, cssW: 375, cssH: 812, name: "iphone-x" },
  { w: 1242, h: 2208, dpr: 3, cssW: 414, cssH: 736, name: "iphone-8-plus" },
  { w: 750, h: 1334, dpr: 2, cssW: 375, cssH: 667, name: "iphone-8" },
  { w: 1640, h: 2360, dpr: 2, cssW: 820, cssH: 1180, name: "ipad-air" },
  { w: 1536, h: 2048, dpr: 2, cssW: 768, cssH: 1024, name: "ipad" },
];

const png = (svg) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 });

await mkdir("public/icons", { recursive: true });
await mkdir("public/splash", { recursive: true });

// Rounded corners for the sizes iOS/Android already round themselves, square
// for maskable (the launcher supplies the shape).
for (const size of [192, 512]) {
  await png(iconSvg({ radius: 114 })).resize(size, size).toFile(`public/icons/icon-${size}.png`);
}
await png(iconSvg({ radius: 0, inset: 0.62 })).resize(512, 512).toFile("public/icons/icon-maskable-512.png");
// iOS composites its own rounded mask and does NOT honour transparency, so the
// apple-touch-icon is drawn square and opaque.
await png(iconSvg({ radius: 0 })).resize(180, 180).toFile("public/icons/apple-touch-icon.png");
await png(iconSvg({ radius: 114 })).resize(32, 32).toFile("public/icons/favicon-32.png");

const links = [];
for (const d of DEVICES) {
  const file = `splash-${d.name}.png`;
  await png(splashSvg(d.w, d.h)).toFile(`public/splash/${file}`);
  links.push(
    `(device-width: ${d.cssW}px) and (device-height: ${d.cssH}px) and (-webkit-device-pixel-ratio: ${d.dpr}) and (orientation: portrait)|/splash/${file}`
  );
}

// The layout reads this so the <link> tags can't drift from the files on disk.
await writeFile("src/app/splash-screens.json", JSON.stringify(links, null, 2) + "\n");

console.log(`icons: 5, splash: ${DEVICES.length}`);
