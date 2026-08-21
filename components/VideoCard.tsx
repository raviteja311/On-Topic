import Link from "next/link";
import {
  formatDuration,
  formatExactDate,
  formatPublished,
  spokenDuration,
} from "@/lib/duration";
import { LEVEL_LABEL } from "@/lib/level";
import type { Video } from "@/lib/types";

interface Props {
  video: Video;
  /** Where to return to, so the watch page can offer a real back link. */
  backTo: string;
  /** The first row loads eagerly; everything below the fold is lazy. */
  eager?: boolean;
}

export default function VideoCard({ video, backTo, eager }: Props) {
  const href = `/watch/${encodeURIComponent(video.id)}?from=${encodeURIComponent(backTo)}`;
  const published = formatPublished(video.publishedAt);

  return (
    <article className="card">
      <Link className="card-link" href={href}>
        <div className="card-thumb">
          {video.thumbnail ? (
            <img
              src={video.thumbnail}
              alt=""
              width={video.thumbnailWidth}
              height={video.thumbnailHeight}
              loading={eager ? "eager" : "lazy"}
              fetchPriority={eager ? "high" : "auto"}
              decoding="async"
            />
          ) : null}
          <span className="card-duration mono" aria-hidden="true">
            {formatDuration(video.seconds)}
          </span>
        </div>
        <div className="card-body">
          <h3 className="card-title">{video.title}</h3>
          <span className="visually-hidden">
            {spokenDuration(video.seconds)}. {published}.
          </span>
        </div>
      </Link>
      <p className="card-meta">{video.channel}</p>
      <p className="card-meta-row">
        <time dateTime={video.publishedAt} title={formatExactDate(video.publishedAt)}>
          {published}
        </time>
        <span aria-hidden="true">·</span>
        <span
          className="level-tag"
          title={
            video.levelSignals.length
              ? `Guessed from: ${video.levelSignals.join(", ")}`
              : "No level words found, so this is the default"
          }
        >
          {LEVEL_LABEL[video.level]}
        </span>
      </p>
    </article>
  );
}
