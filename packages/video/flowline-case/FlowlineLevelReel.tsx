import React from "react";
import {Audio} from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import {
  BUILD_STEPS,
  CODE_BUILD_FRAMES,
  FIGMA_BUILD_FRAMES,
} from "./BuildTimeline";
import {PolishedCodeScene, PolishedFigmaScene} from "./BuildScenes";
import {FlowlineSite} from "./FlowlineSite";
import {
  FLOWLINE_CASE_CUTS,
  FLOWLINE_CASE_DURATION,
} from "./Scenario";
import "./flowline-case.css";

export const LEVEL_DURATION = FLOWLINE_CASE_DURATION;

const CUTS = FLOWLINE_CASE_CUTS;

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const easeInOut = Easing.bezier(0.45, 0, 0.55, 1);

const Scanlines = ({opacity = 0.12}: {opacity?: number}) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      opacity,
      mixBlendMode: "overlay",
      backgroundImage:
        "repeating-linear-gradient(180deg,rgba(255,255,255,.42) 0px,rgba(255,255,255,.42) 1px,transparent 1px,transparent 4px)",
    }}
  />
);

const DataGrid = ({
  frame,
  color = "#8df7b5",
  opacity = 0.22,
}: {
  frame: number;
  color?: string;
  opacity?: number;
}) => (
  <AbsoluteFill
    style={{
      overflow: "hidden",
      opacity,
      backgroundImage: `radial-gradient(circle,${color} 0 1.3px,transparent 1.6px)`,
      backgroundSize: "22px 22px",
      backgroundPosition: `${interpolate(frame, [0, 180], [0, 44], {
        ...clamp,
      })}px ${interpolate(frame, [0, 180], [0, -22], {
        ...clamp,
      })}px`,
      maskImage:
        "radial-gradient(ellipse 92% 62% at 50% 50%,#000 0%,rgba(0,0,0,.85) 42%,transparent 78%)",
    }}
  />
);

const DataWave = ({frame}: {frame: number}) => (
  <svg
    viewBox="0 0 1080 1920"
    style={{
      position: "absolute",
      inset: 0,
      width: 1080,
      height: 1920,
      opacity: 0.4,
      filter: "drop-shadow(0 0 20px rgba(115,255,177,.25))",
    }}
  >
    {Array.from({length: 42}).map((_, index) => {
      const y = 410 + index * 25;
      const phase = frame * 0.025 + index * 0.16;
      const d = Array.from({length: 25})
        .map((__, point) => {
          const x = point * 46;
          const wave =
            Math.sin(point * 0.54 + phase) * (40 + index * 1.6) +
            Math.cos(point * 0.19 - phase * 0.7) * 34;
          return `${point === 0 ? "M" : "L"} ${x} ${y + wave}`;
        })
        .join(" ");

      return (
        <path
          key={index}
          d={d}
          fill="none"
          stroke={index % 5 === 0 ? "#ff5a1f" : "#79e9aa"}
          strokeWidth={index % 5 === 0 ? 1.5 : 0.8}
          opacity={0.1 + index / 90}
        />
      );
    })}
  </svg>
);

const MetaLabel = ({
  left,
  right,
  dark = true,
}: {
  left: string;
  right: string;
  dark?: boolean;
}) => (
  <div
    style={{
      position: "absolute",
      left: 58,
      right: 58,
      top: 52,
      zIndex: 100,
      display: "flex",
      justifyContent: "space-between",
      color: dark ? "#f5f5f2" : "#111214",
      fontFamily: "Space Mono",
      fontSize: 16,
      letterSpacing: "0.04em",
    }}
  >
    <span>{left}</span>
    <span>{right}</span>
  </div>
);

const HookScene = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{background: "#070908", color: "#f5f5f2"}}>
      <DataWave frame={frame} />
      <DataGrid frame={frame} opacity={0.16} />

      <div
        style={{
          position: "absolute",
          left: 74,
          right: 74,
          top: 530,
          height: 340,
          overflow: "hidden",
          clipPath: `inset(0 ${interpolate(
            frame,
            [8, 52],
            [100, 0],
            {
              ...clamp,
              easing: easeOut,
            },
          )}% 0 0)`,
        }}
      >
        <div
          style={{
            fontFamily: "Halvar",
            fontSize: 157,
            lineHeight: 0.82,
            letterSpacing: "-0.055em",
            color: "#f5f5f2",
            textShadow:
              frame % 9 < 2
                ? "9px 0 #ff4f12,-8px 0 #71f0b1"
                : "2px 0 rgba(255,79,18,.65),-2px 0 rgba(113,240,177,.5)",
          }}
        >
          FLOW
          <br />
          LINE
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 78,
          right: 78,
          top: 980,
          display: "grid",
          gap: 22,
          fontFamily: "Space Mono",
          fontSize: 25,
          opacity: interpolate(frame, [50, 72], [0, 1], {
            ...clamp,
            easing: easeOut,
          }),
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "190px 1fr 90px",
            alignItems: "center",
            gap: 20,
          }}
        >
          <span>DESIGN</span>
          <div style={{height: 3, background: "#303632"}}>
            <div
              style={{
                height: 3,
                width: `${interpolate(frame, [58, 100], [0, 100], clamp)}%`,
                background: "#a259ff",
              }}
            />
          </div>
          <span style={{textAlign: "right"}}>
            {Math.round(interpolate(frame, [58, 100], [0, 100], clamp))}%
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "190px 1fr 90px",
            alignItems: "center",
            gap: 20,
          }}
        >
          <span>CODE</span>
          <div style={{height: 3, background: "#303632"}}>
            <div
              style={{
                height: 3,
                width: `${interpolate(frame, [92, 130], [0, 100], clamp)}%`,
                background: "#ff4f12",
              }}
            />
          </div>
          <span style={{textAlign: "right"}}>
            {Math.round(interpolate(frame, [92, 130], [0, 100], clamp))}%
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "190px 1fr 90px",
            alignItems: "center",
            gap: 20,
          }}
        >
          <span>MOTION</span>
          <div style={{height: 3, background: "#303632"}}>
            <div
              style={{
                height: 3,
                width: `${interpolate(frame, [124, 155], [0, 100], clamp)}%`,
                background: "#71f0b1",
              }}
            />
          </div>
          <span style={{textAlign: "right"}}>
            {Math.round(interpolate(frame, [124, 155], [0, 100], clamp))}%
          </span>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 78,
          bottom: 116,
          color: "#8b938d",
          fontFamily: "Space Mono",
          fontSize: 17,
          letterSpacing: "0.08em",
        }}
      >
        AUTOCUBES / SELECTED WORK / 01
      </div>
      <Scanlines opacity={0.16} />
    </AbsoluteFill>
  );
};

const FigmaCursor = ({frame}: {frame: number}) => {
  const x = interpolate(
    frame,
    [0, 34, 56, 78, 98, 116, 143],
    [760, 790, 665, 640, 720, 735, 520],
    {...clamp, easing: easeInOut},
  );
  const y = interpolate(
    frame,
    [0, 34, 56, 78, 98, 116, 143],
    [115, 280, 460, 650, 790, 1180, 1330],
    {...clamp, easing: easeInOut},
  );

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 28,
        height: 38,
        zIndex: 120,
        filter: "drop-shadow(0 4px 6px rgba(0,0,0,.45))",
      }}
    >
      <svg viewBox="0 0 28 38" width="28" height="38">
        <path
          d="M2 2L25 23L15 24L10 35L2 2Z"
          fill="#fff"
          stroke="#111214"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

export const LegacyFigmaScene = () => {
  const frame = useCurrentFrame();
  const layerIndex =
    frame < 34 ? 0 : frame < 56 ? 1 : frame < 78 ? 2 : frame < 98 ? 3 : frame < 116 ? 4 : 5;

  return (
    <AbsoluteFill style={{background: "#1b1c20", color: "#f5f5f2"}}>
      <MetaLabel left="FLOWLINE / FIGMA" right="LAYOUT BUILD" />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 102,
          height: 54,
          background: "#292a30",
          borderTop: "1px solid #393a40",
          borderBottom: "1px solid #111214",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 22,
          color: "#afb0b7",
          fontFamily: "Space Mono",
          fontSize: 14,
        }}
      >
        <span>⌁</span>
        <span>FRAME</span>
        <span>RECTANGLE</span>
        <span>TEXT</span>
        <span>100%</span>
      </div>

      <div
        style={{
          position: "absolute",
          left: 20,
          top: 174,
          width: 185,
          bottom: 72,
          borderRadius: 14,
          background: "#222329",
          border: "1px solid #34353c",
          padding: "20px 14px",
          fontFamily: "Space Mono",
          fontSize: 13,
          color: "#b9bac1",
        }}
      >
        <div style={{color: "#fff", marginBottom: 20}}>LAYERS</div>
        {["Navigation", "Hero Copy", "Actions", "Hero Media", "Habit Cards", "About"].map(
          (label, index) => (
            <div
              key={label}
              style={{
                height: 42,
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "0 9px",
                borderRadius: 7,
                color: layerIndex === index ? "#fff" : "#898b94",
                background: layerIndex === index ? "#5d3a86" : "transparent",
              }}
            >
              <span>{index < layerIndex ? "◆" : "◇"}</span>
              <span>{label}</span>
            </div>
          ),
        )}
      </div>

      <div
        style={{
          position: "absolute",
          right: 20,
          top: 174,
          width: 185,
          bottom: 72,
          borderRadius: 14,
          background: "#222329",
          border: "1px solid #34353c",
          padding: 18,
          fontFamily: "Space Mono",
          fontSize: 12,
          color: "#a4a5ad",
        }}
      >
        <div style={{color: "#fff", marginBottom: 22}}>DESIGN</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          {[
            ["X", "120"],
            ["Y", "240"],
            ["W", "900"],
            ["H", "1420"],
          ].map(([key, value]) => (
            <div
              key={key}
              style={{
                background: "#2c2d33",
                padding: "9px 8px",
                borderRadius: 6,
              }}
            >
              <span style={{color: "#6f717a"}}>{key} </span>
              {value}
            </div>
          ))}
        </div>
        <div style={{marginTop: 24, color: "#fff"}}>AUTO LAYOUT</div>
        <div
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 7,
            background: "#2c2d33",
            lineHeight: 1.7,
          }}
        >
          VERTICAL
          <br />
          GAP / 24
          <br />
          PADDING / 60
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 225,
          top: 210,
          width: 630,
          height: 994,
          scale: interpolate(frame, [0, 20], [0.9, 1], {
            ...clamp,
            easing: easeOut,
          }),
          transformOrigin: "center top",
        }}
      >
        <div style={{position: "absolute", inset: 0, scale: 0.7, transformOrigin: "left top"}}>
          <FlowlineSite
            frame={frame}
            mode="figma"
            buildFrames={FIGMA_BUILD_FRAMES}
            constructionOnly
            showSelection
          />
          <FigmaCursor frame={frame} />
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 224,
          top: 1240,
          width: 632,
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 18,
          fontFamily: "Space Mono",
          fontSize: 15,
          color: "#9fa1aa",
        }}
      >
        <div>
          FRAME / FLOWLINE / HERO
          <br />
          COMPONENTS / {Math.min(6, layerIndex + 1)} OF 6
        </div>
        <div style={{color: "#a259ff"}}>SNAP / 8 PX</div>
      </div>

      <DataGrid frame={frame} color="#a259ff" opacity={0.055} />
      <Scanlines opacity={0.07} />
    </AbsoluteFill>
  );
};

const codeLines = [
  "export const FlowlineHero = () => (",
  "  <Page theme=\"warm\">",
  "    <Navigation />",
  "    <HeroCopy />",
  "    <Actions />",
  "    <HeroMedia source={heroImage} />",
  "    <StreakCard />",
  "    <GoalCard />",
  "    <AboutSection />",
  "  </Page>",
  ");",
];

const TypedCode = ({frame}: {frame: number}) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      padding: "56px 38px",
      fontFamily: "Space Mono",
      fontSize: 22,
      lineHeight: 1.76,
    }}
  >
    {codeLines.map((line, index) => {
      const start = index * 11;
      const chars = Math.round(
        interpolate(frame, [start, start + 10], [0, line.length], clamp),
      );
      const active = frame >= start && frame < start + 11;

      return (
        <div
          key={line}
          style={{
            minHeight: 39,
            color:
              line.includes("<") || line.includes("/>")
                ? "#ff8a62"
                : line.includes("export")
                  ? "#75e5ad"
                  : "#c7cbd0",
            background: active ? "rgba(255,79,18,.08)" : "transparent",
          }}
        >
          <span style={{display: "inline-block", width: 42, color: "#4c5157"}}>
            {String(index + 1).padStart(2, "0")}
          </span>
          {line.slice(0, chars)}
          {active ? <span style={{color: "#ff4f12"}}>▋</span> : null}
        </div>
      );
    })}
  </div>
);

export const LegacyCodeScene = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{background: "#090b0b", color: "#f5f5f2"}}>
      <MetaLabel left="FLOWLINE / COMPONENT BUILD" right="CODE → DOM" />
      <DataGrid frame={frame} opacity={0.075} />

      <div
        style={{
          position: "absolute",
          left: 48,
          right: 48,
          top: 116,
          height: 610,
          borderRadius: 20,
          overflow: "hidden",
          background: "#111416",
          border: "1px solid #2d3331",
          boxShadow: "0 30px 90px rgba(0,0,0,.46)",
        }}
      >
        <div
          style={{
            height: 48,
            background: "#181b1d",
            borderBottom: "1px solid #2a2f2d",
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            gap: 8,
          }}
        >
          {["#ff675c", "#f5bf4f", "#61c554"].map((color) => (
            <div
              key={color}
              style={{width: 11, height: 11, borderRadius: 99, background: color}}
            />
          ))}
          <div
            style={{
              marginLeft: 22,
              fontFamily: "Space Mono",
              fontSize: 13,
              color: "#72787a",
            }}
          >
            FlowlineHero.tsx
          </div>
        </div>
        <TypedCode frame={frame} />
      </div>

      <div
        style={{
          position: "absolute",
          left: 240,
          top: 770,
          width: 600,
          height: 946,
          borderRadius: 20,
          overflow: "hidden",
          border: "1px solid #303533",
          background: "#171918",
          boxShadow: "0 40px 110px rgba(0,0,0,.55)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: 558,
            height: 880,
            left: 21,
            top: 45,
            scale: 0.62,
            transformOrigin: "left top",
          }}
        >
          <FlowlineSite
            frame={frame}
            mode="code"
            buildFrames={CODE_BUILD_FRAMES}
            constructionOnly
          />
        </div>
        <div
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            bottom: 17,
            height: 34,
            borderTop: "1px solid #303533",
            paddingTop: 10,
            fontFamily: "Space Mono",
            fontSize: 12,
            color: frame > 128 ? "#75e5ad" : "#68706c",
          }}
        >
          {frame > 128
            ? "✓ 6 components mounted · layout stable"
            : "building component graph…"}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 62,
          top: 875,
          width: 148,
          fontFamily: "Space Mono",
          fontSize: 14,
          lineHeight: 1.8,
          color: "#747b77",
        }}
      >
        CODE
        <br />
        ↓
        <br />
        COMPONENT
        <br />
        ↓
        <br />
        RENDER
      </div>

      <Scanlines opacity={0.08} />
    </AbsoluteFill>
  );
};

const RuntimeScene = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{background: "#120b08", color: "#fff"}}>
      <MetaLabel left="FLOWLINE / RUNTIME" right="BUILD SUCCESS" />
      <DataWave frame={frame + 120} />

      <div
        style={{
          position: "absolute",
          left: 90,
          top: 142,
          width: 900,
          height: 1600,
          borderRadius: 28,
          overflow: "hidden",
          background: "#f5f5f3",
          border: "1px solid rgba(255,255,255,.18)",
          boxShadow: "0 46px 130px rgba(0,0,0,.62)",
          scale: interpolate(frame, [0, 26, 178, 211], [0.92, 1, 1, 0.94], {
            ...clamp,
            easing: easeOut,
          }),
        }}
      >
        <Img
          src={staticFile("assets/flowline-case/hero.png")}
          style={{
            position: "absolute",
            inset: 0,
            width: 900,
            height: 1600,
            objectFit: "cover",
          }}
        />
        <Sequence durationInFrames={CUTS.motion - CUTS.runtime}>
          <OffthreadVideo
            src={staticFile(
              "assets/flowline-case/motion-source/motion-tour-studio30.mp4",
            )}
            muted
            style={{
              position: "absolute",
              inset: 0,
              width: 900,
              height: 1600,
              objectFit: "cover",
            }}
          />
        </Sequence>
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: "1px solid rgba(255,255,255,.12)",
            borderRadius: 28,
          }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          right: 58,
          bottom: 92,
          padding: "11px 14px",
          borderRadius: 999,
          background: "#75e5ad",
          color: "#09100c",
          fontFamily: "Space Mono",
          fontSize: 14,
          opacity: interpolate(frame, [136, 152], [0, 1], clamp),
        }}
      >
        DOM CAPTURE / FRAME-LOCKED
      </div>
      <Scanlines opacity={0.11} />
    </AbsoluteFill>
  );
};

const SHOWCASE_CHAPTERS = [
  {start: 0, label: "PAGE FLOW", detail: "FRAME-DRIVEN SCROLL"},
  {start: 81, label: "ROUTINES", detail: "STACK / PARALLAX"},
  {start: 159, label: "METRICS", detail: "COUNTER / 3D"},
  {start: 240, label: "SOCIAL PROOF", detail: "CARDS / MEDIA"},
  {start: 321, label: "AI + REVIEWS", detail: "PRODUCT / PEOPLE"},
] as const;

const MotionShowcase = () => {
  const frame = useCurrentFrame();
  const chapter = SHOWCASE_CHAPTERS.reduce(
    (active, candidate) => (frame >= candidate.start ? candidate : active),
    SHOWCASE_CHAPTERS[0],
  );

  return (
    <AbsoluteFill style={{background: "#f3f3f0"}}>
      <MetaLabel
        left={`FLOWLINE / ${chapter.label}`}
        right={chapter.detail}
        dark={false}
      />
      <div
        style={{
          position: "absolute",
          left: 90,
          top: 154,
          width: 900,
          height: 1640,
          borderRadius: 28,
          overflow: "hidden",
          background: "#fff",
          boxShadow: "0 38px 95px rgba(16,17,19,.18)",
        }}
      >
        <OffthreadVideo
          src={staticFile(
            "assets/flowline-case/motion-source/motion-tour-studio30.mp4",
          )}
          muted
          trimBefore={184}
          style={{width: "100%", height: "100%", objectFit: "cover"}}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 54,
          top: 142,
          width: 8,
          height: interpolate(frame, [0, 16], [0, 170], {
            ...clamp,
            easing: easeOut,
          }),
          borderRadius: 99,
          background: "#ff4f12",
        }}
      />
    </AbsoluteFill>
  );
};

const MontagePanel = ({
  src,
  frame,
  start,
  x,
  width,
  yOffset,
}: {
  src: string;
  frame: number;
  start: number;
  x: number;
  width: number;
  yOffset: number;
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: 150,
      width,
      height: 1550,
      overflow: "hidden",
      borderRadius: 18,
      background: "#191b1a",
      clipPath: `inset(${interpolate(
        frame,
        [start, start + 14],
        [100, 0],
        {
          ...clamp,
          easing: easeOut,
        },
      )}% 0 0 0)`,
      translate: `0px ${interpolate(
        frame,
        [start, start + 24, 114],
        [160, 0, yOffset],
        {
          ...clamp,
          easing: easeOut,
        },
      )}px`,
    }}
  >
    <Img
      src={staticFile(src)}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "top",
      }}
    />
  </div>
);

const MontageScene = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{background: "#080a09", color: "#f5f5f2"}}>
      <MetaLabel left="FLOWLINE / MOTION" right="LIVE SITE" />
      <DataGrid frame={frame} opacity={0.1} />
      <MontagePanel
        src="assets/flowline-case/hero.png"
        frame={frame}
        start={0}
        x={42}
        width={230}
        yOffset={-90}
      />
      <MontagePanel
        src="assets/flowline-case/streak.png"
        frame={frame}
        start={8}
        x={286}
        width={230}
        yOffset={40}
      />
      <MontagePanel
        src="assets/flowline-case/metrics.png"
        frame={frame}
        start={16}
        x={530}
        width={230}
        yOffset={-45}
      />
      <MontagePanel
        src="assets/flowline-case/reviews.png"
        frame={frame}
        start={24}
        x={774}
        width={264}
        yOffset={55}
      />
      <Scanlines opacity={0.12} />
    </AbsoluteFill>
  );
};

const FinalScene = () => {
  const frame = useCurrentFrame();
  const caseOpacity = interpolate(frame, [72, 80], [1, 0], clamp);
  const brandOpacity = interpolate(frame, [78, 80], [0, 1], clamp);
  const brandScale = interpolate(frame, [80, 92], [1.08, 1], {
    ...clamp,
    easing: easeOut,
  });

  return (
    <AbsoluteFill style={{background: "#080a09", color: "#f5f5f2"}}>
      <AbsoluteFill style={{opacity: caseOpacity}}>
        <DataWave frame={frame + 350} />
        <DataGrid frame={frame} opacity={0.12} />
        <MetaLabel left="AUTOCUBES / FLOWLINE" right="DESIGN / CODE / MOTION" />

        <div
          style={{
            position: "absolute",
            left: 62,
            top: 250,
            width: 520,
            fontFamily: "Halvar",
            fontSize: 126,
            lineHeight: 0.82,
            letterSpacing: "-0.045em",
            clipPath: `inset(0 ${interpolate(frame, [0, 34], [100, 0], {
              ...clamp,
              easing: easeOut,
            })}% 0 0)`,
          }}
        >
          FLOW
          <br />
          <span style={{color: "#ff4f12"}}>LINE.</span>
        </div>

        <div
          style={{
            position: "absolute",
            right: -90,
            top: 230,
            width: 640,
            height: 1250,
            borderRadius: 28,
            overflow: "hidden",
            background: "#fff",
            border: "1px solid rgba(255,255,255,.2)",
            boxShadow: "0 45px 120px rgba(0,0,0,.62)",
            rotate: `${interpolate(frame, [0, 80], [4.5, -2], {
              ...clamp,
              easing: easeOut,
            })}deg`,
            scale: interpolate(frame, [0, 70], [0.86, 1], {
              ...clamp,
              easing: easeOut,
            }),
            translate: `${interpolate(frame, [0, 70], [130, 0], {
              ...clamp,
              easing: easeOut,
            })}px 0px`,
          }}
        >
          <OffthreadVideo
            src={staticFile(
              "assets/flowline-case/motion-source/motion-tour-studio30.mp4",
            )}
            muted
            trimBefore={330}
            style={{width: "100%", height: "100%", objectFit: "cover"}}
          />
        </div>
        <Scanlines opacity={0.14} />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background: "#f3f3f0",
          color: "#080a09",
          opacity: brandOpacity,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 48,
            transform: `scale(${brandScale})`,
          }}
        >
          <Img
            src={staticFile("assets/brand/autocubes.svg")}
            style={{width: 430, height: 430}}
          />
          <div
            style={{
              fontFamily: "Halvar",
              fontSize: 92,
              lineHeight: 1,
              letterSpacing: "-0.045em",
            }}
          >
            autocubes
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const BeatFlash = () => {
  const frame = useCurrentFrame();
  const flashFrames = [
    CUTS.figma,
    CUTS.code,
    CUTS.runtime,
    CUTS.motion,
    CUTS.montage,
    CUTS.final,
  ];
  const opacity = Math.max(
    ...flashFrames.map((cut) =>
      interpolate(frame, [cut - 2, cut, cut + 4], [0, 0.72, 0], clamp),
    ),
  );

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        background: "#f8fff9",
        opacity,
        mixBlendMode: "screen",
      }}
    />
  );
};

const SoundDesign = () => (
  <>
    <Audio
      src={staticFile("audio/flowline-case/brain-implant.wav")}
      volume={(frame) =>
        interpolate(frame, [0, 12, LEVEL_DURATION - 36, LEVEL_DURATION], [0, 0.58, 0.58, 0], clamp)
      }
    />

    <Sequence from={CUTS.figma} durationInFrames={20}>
      <Audio src={staticFile("audio/flowline-case/sfx/shutter-modern.wav")} volume={0.3} />
    </Sequence>
    {BUILD_STEPS.map((step) => (
      <Sequence
        key={`figma-${step.key}`}
        from={CUTS.figma + step.figmaDrop}
        durationInFrames={20}
      >
        <Audio
          src={staticFile("audio/flowline-case/sfx/mouse-click.wav")}
          volume={0.13}
        />
      </Sequence>
    ))}
    {BUILD_STEPS.map((step) => (
      <Sequence
        key={`code-${step.key}`}
        from={
          CUTS.code +
          CODE_BUILD_FRAMES[step.key]
        }
        durationInFrames={20}
      >
        <Audio src={staticFile("audio/flowline-case/sfx/switch.wav")} volume={0.11} />
      </Sequence>
    ))}
    <Sequence from={CUTS.runtime} durationInFrames={20}>
      <Audio src={staticFile("audio/flowline-case/sfx/whoosh.wav")} volume={0.28} />
    </Sequence>
    <Sequence from={CUTS.motion} durationInFrames={20}>
      <Audio src={staticFile("audio/flowline-case/sfx/whoosh.wav")} volume={0.24} />
    </Sequence>
    <Sequence from={CUTS.montage} durationInFrames={20}>
      <Audio src={staticFile("audio/flowline-case/sfx/shutter-modern.wav")} volume={0.22} />
    </Sequence>
    <Sequence from={CUTS.final} durationInFrames={20}>
      <Audio src={staticFile("audio/flowline-case/sfx/whoosh.wav")} volume={0.25} />
    </Sequence>
  </>
);

export const FlowlineLevelReel: React.FC = () => {
  return (
    <AbsoluteFill style={{background: "#080a09", overflow: "hidden"}}>
      <SoundDesign />

      <Sequence durationInFrames={CUTS.figma - CUTS.hook}>
        <HookScene />
      </Sequence>
      <Sequence
        from={CUTS.figma}
        durationInFrames={CUTS.code - CUTS.figma}
      >
        <PolishedFigmaScene />
      </Sequence>
      <Sequence from={CUTS.code} durationInFrames={CUTS.runtime - CUTS.code}>
        <PolishedCodeScene />
      </Sequence>
      <Sequence
        from={CUTS.runtime}
        durationInFrames={CUTS.motion - CUTS.runtime}
      >
        <RuntimeScene />
      </Sequence>
      <Sequence
        from={CUTS.motion}
        durationInFrames={CUTS.montage - CUTS.motion}
      >
        <MotionShowcase />
      </Sequence>
      <Sequence
        from={CUTS.montage}
        durationInFrames={CUTS.final - CUTS.montage}
      >
        <MontageScene />
      </Sequence>
      <Sequence
        from={CUTS.final}
        durationInFrames={CUTS.end - CUTS.final}
      >
        <FinalScene />
      </Sequence>

      <BeatFlash />
    </AbsoluteFill>
  );
};
