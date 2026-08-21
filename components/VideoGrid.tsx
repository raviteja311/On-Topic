import VideoCard from "./VideoCard";
import type { Video } from "@/lib/types";

export default function VideoGrid({
  videos,
  backTo,
}: {
  videos: Video[];
  backTo: string;
}) {
  return (
    <ul className="grid">
      {videos.map((video, i) => (
        <li key={video.id}>
          <VideoCard video={video} backTo={backTo} eager={i < 4} />
        </li>
      ))}
    </ul>
  );
}
