/**
 * No Content-Security-Policy here, deliberately. A useful one would have to
 * cover both the theme script inlined in the document head and the inline
 * scripts Next emits for hydration, which means generating a nonce per request
 * in a proxy and threading it through. That is a real change rather than a
 * header, so it is left out instead of being added in a form weak enough
 * ('unsafe-inline') to be worth nothing.
 *
 * Permissions-Policy only names features the app never uses. The YouTube embed
 * asks for autoplay, fullscreen, encrypted-media and others through its own
 * allow attribute, and denying those here would break the player.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here is meant to be framed by anyone else.
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
