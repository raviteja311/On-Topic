import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * Next 16 removed the `next lint` command, so the script calls the ESLint CLI
 * directly. Its shareable configs are native flat config as of 16, so they are
 * spread in as-is rather than bridged through FlatCompat.
 */
const config = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // The rule is about the Pages Router, where a font link outside
      // pages/_document.js loads for one page only. This app is App Router,
      // where the link lives in the root layout and applies to every page.
      "@next/next/no-page-custom-font": "off",

      // Deliberate. Thumbnails are fixed-size remote URLs, plus inline SVG data
      // URLs in demo mode, which next/image would need remotePatterns config to
      // accept and could not optimise anyway. The plain <img> tags already carry
      // width, height, loading and fetchPriority.
      "@next/next/no-img-element": "off",
    },
  },
];

export default config;
