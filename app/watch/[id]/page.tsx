import type { Metadata } from "next";
import { notFound } from "next/navigation";
import WatchView from "@/components/WatchView";
import { getVideoMeta, isDemoMode } from "@/lib/youtube";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const meta = await getVideoMeta(id);
  return { title: meta ? meta.title : "Video" };
}

/** Only ever return an internal path, so a crafted link cannot bounce a user offsite. */
function safeBack(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default async function WatchPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const meta = await getVideoMeta(id);

  if (!meta) notFound();

  return (
    <main id="main">
      <div className="shell">
        <WatchView meta={meta} backTo={safeBack(sp.from)} demo={isDemoMode()} />
      </div>
    </main>
  );
}
