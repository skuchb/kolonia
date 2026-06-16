"use client";

import Script from "next/script";

const token = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;

export default function Analytics() {
  if (!token) return null;

  return (
    <Script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token })}
      strategy="afterInteractive"
    />
  );
}
