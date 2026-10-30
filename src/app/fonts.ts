import localFont from "next/font/local";

export const tiempos = localFont({
  src: [
    { path: "./fonts/tiempos/TiemposText-Regular.otf", weight: "400", style: "normal" },
    { path: "./fonts/tiempos/TiemposText-Italic.otf",   weight: "400", style: "italic" },
    { path: "./fonts/tiempos/TiemposText-Medium.otf",   weight: "500", style: "normal" },
    { path: "./fonts/tiempos/TiemposText-Semibold.otf", weight: "600", style: "normal" }
  ],
  variable: "--font-tiempos",
  display: "swap",
  fallback: ["Georgia","Times New Roman","serif"],
  preload: true
});

export const styrene = localFont({
  src: [
    { path: "./fonts/styrene/StyreneA-Regular.otf", weight: "400", style: "normal" },
    { path: "./fonts/styrene/StyreneA-Medium.otf",  weight: "500", style: "normal" },
    { path: "./fonts/styrene/StyreneA-Bold.otf",    weight: "700", style: "normal" }
  ],
  variable: "--font-styrene",
  display: "swap",
  fallback: ["ui-sans-serif","system-ui","sans-serif"],
  preload: true
});
// The narrower Styrene B matches the Claude app's UI labels (chips in chat replies).
export const styreneB = localFont({
  src: [
    { path: "../../public/fonts/styrene-font-family-1757345710-0/StyreneB-Regular-Trial-BF63f6cbe9db1d5.otf", weight: "400", style: "normal" }
  ],
  variable: "--font-styrene-b",
  display: "swap",
  fallback: ["ui-sans-serif","system-ui","sans-serif"],
  preload: false
});
