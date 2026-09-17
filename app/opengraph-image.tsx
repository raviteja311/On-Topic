import { ImageResponse } from "next/og";

/**
 * The whole pitch is that every search is a link worth sending to someone, so
 * those links should not preview as bare text. Drawn rather than stored as a
 * file, which keeps it in step with the palette in globals.css.
 */

export const alt = "Ontopic, focused video search";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          backgroundColor: "#0f1114",
          padding: "96px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 48 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 28,
              backgroundColor: "#4cc0b1",
              marginRight: 20,
            }}
          />
          <div style={{ fontSize: 40, color: "#e9ecf0", letterSpacing: -0.5 }}>
            Ontopic
          </div>
        </div>

        <div
          style={{
            fontSize: 82,
            color: "#e9ecf0",
            lineHeight: 1.1,
            letterSpacing: -2,
          }}
        >
          Enter a topic, get videos
        </div>
        <div
          style={{
            fontSize: 82,
            color: "#4cc0b1",
            lineHeight: 1.1,
            letterSpacing: -2,
          }}
        >
          on that topic.
        </div>

        <div style={{ fontSize: 34, color: "#a7aeb8", marginTop: 44 }}>
          No feed. No recommendations. No comments.
        </div>
      </div>
    ),
    size,
  );
}
