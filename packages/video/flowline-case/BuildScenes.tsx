import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import {
  BUILD_STEPS,
  CODE_BUILD_FRAMES,
  FIGMA_BUILD_FRAMES,
  type BuildStep,
} from "./BuildTimeline";
import {FlowlineSite} from "./FlowlineSite";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};
const easeInOut = Easing.bezier(0.45, 0, 0.55, 1);

const Scanlines = ({opacity = 0.08}: {opacity?: number}) => (
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
  opacity = 0.08,
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
    }}
  />
);

const MetaLabel = ({left, right}: {left: string; right: string}) => (
  <div
    style={{
      position: "absolute",
      left: 58,
      right: 58,
      top: 52,
      zIndex: 100,
      display: "flex",
      justifyContent: "space-between",
      color: "#f5f5f2",
      fontFamily: "Space Mono",
      fontSize: 16,
      letterSpacing: "0.04em",
    }}
  >
    <span>{left}</span>
    <span>{right}</span>
  </div>
);

const FigmaMark = () => (
  <div
    style={{
      position: "relative",
      width: 22,
      height: 34,
      marginRight: 8,
    }}
  >
    {[
      {left: 0, top: 0, color: "#f24e1e", radius: "9px 0 0 9px"},
      {left: 11, top: 0, color: "#ff7262", radius: "0 9px 9px 0"},
      {left: 0, top: 11, color: "#a259ff", radius: "9px 0 0 9px"},
      {left: 11, top: 11, color: "#1abcfe", radius: 99},
      {left: 0, top: 22, color: "#0acf83", radius: "9px 0 9px 9px"},
    ].map((part, index) => (
      <div
        key={index}
        style={{
          position: "absolute",
          left: part.left,
          top: part.top,
          width: 11,
          height: 11,
          borderRadius: part.radius,
          background: part.color,
        }}
      />
    ))}
  </div>
);

const getCursorPosition = (frame: number) => {
  const cursorFrames = [0];
  const cursorX = [BUILD_STEPS[0].figmaSource.x];
  const cursorY = [BUILD_STEPS[0].figmaSource.y];

  BUILD_STEPS.forEach((step) => {
    cursorFrames.push(step.figmaGrab, step.figmaDrop);
    cursorX.push(step.figmaSource.x, step.figmaTarget.x);
    cursorY.push(step.figmaSource.y, step.figmaTarget.y);
  });

  return {
    x: interpolate(frame, cursorFrames, cursorX, {
      ...clamp,
      easing: easeInOut,
    }),
    y: interpolate(frame, cursorFrames, cursorY, {
      ...clamp,
      easing: easeInOut,
    }),
  };
};

const FigmaCursor = ({frame}: {frame: number}) => {
  const {x, y} = getCursorPosition(frame);
  const dragging = BUILD_STEPS.find(
    (step) => frame >= step.figmaGrab && frame < step.figmaDrop,
  );
  const clickPulse = Math.max(
    ...BUILD_STEPS.map((step) =>
      interpolate(
        frame,
        [step.figmaDrop - 1, step.figmaDrop, step.figmaDrop + 6],
        [0, 1, 0],
        clamp,
      ),
    ),
  );

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: x - 16,
          top: y - 16,
          width: 44,
          height: 44,
          borderRadius: 99,
          border: "2px solid #a259ff",
          opacity: clickPulse,
          scale: interpolate(clickPulse, [0, 1], [1.55, 0.8], clamp),
          zIndex: 118,
        }}
      />
      {dragging ? (
        <div
          style={{
            position: "absolute",
            left: x + 24,
            top: y + 24,
            padding: "7px 10px",
            borderRadius: 6,
            background: "#a259ff",
            color: "#fff",
            fontFamily: "Arial, sans-serif",
            fontSize: 12,
            zIndex: 119,
            boxShadow: "0 8px 18px rgba(0,0,0,.32)",
          }}
        >
          {dragging.label}
        </div>
      ) : null}
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
    </>
  );
};

export const PolishedFigmaScene = () => {
  const frame = useCurrentFrame();
  const mountedCount = BUILD_STEPS.filter(
    (step) => frame >= step.figmaDrop,
  ).length;
  const selectedIndex = Math.max(0, mountedCount - 1);

  return (
    <AbsoluteFill style={{background: "#202124", color: "#f5f5f2"}}>
      <MetaLabel left="FLOWLINE / FIGMA" right="COMPONENT ASSEMBLY" />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 102,
          height: 62,
          background: "#2c2c2c",
          borderTop: "1px solid #3d3d3d",
          borderBottom: "1px solid #151515",
          display: "flex",
          alignItems: "center",
          padding: "0 18px",
          color: "#e6e6e6",
          fontFamily: "Arial, sans-serif",
          fontSize: 13,
          zIndex: 20,
        }}
      >
        <FigmaMark />
        <span style={{fontWeight: 600}}>Flowline — Web</span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 22,
            margin: "0 auto",
            color: "#c7c7c7",
          }}
        >
          <span
            style={{
              color: "#fff",
              background: "#0d99ff",
              padding: "8px 11px",
              borderRadius: 6,
            }}
          >
            ↖
          </span>
          <span>#</span>
          <span>▭</span>
          <span>○</span>
          <span>⌁</span>
          <span>T</span>
          <span>✎</span>
        </div>
        <span style={{color: "#9f9f9f"}}>82%</span>
        <span
          style={{
            marginLeft: 16,
            padding: "8px 13px",
            borderRadius: 6,
            background: "#0d99ff",
            color: "#fff",
            fontWeight: 600,
          }}
        >
          Share
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          top: 164,
          width: 170,
          bottom: 0,
          background: "#2c2c2c",
          borderRight: "1px solid #171717",
          fontFamily: "Arial, sans-serif",
          fontSize: 13,
          color: "#bdbdbd",
          zIndex: 15,
        }}
      >
        <div
          style={{
            height: 48,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            alignItems: "center",
            textAlign: "center",
            borderBottom: "1px solid #414141",
          }}
        >
          <span
            style={{
              color: "#fff",
              borderBottom: "2px solid #fff",
              height: 48,
              paddingTop: 16,
            }}
          >
            Layers
          </span>
          <span style={{height: 48, paddingTop: 16}}>Assets</span>
        </div>
        <div
          style={{
            padding: "17px 14px 10px",
            color: "#f2f2f2",
            fontWeight: 600,
          }}
        >
          Page 1
        </div>
        <div
          style={{
            margin: "0 8px 14px",
            padding: "9px 8px",
            borderRadius: 5,
            background: "#383838",
            color: "#fff",
          }}
        >
          ▾ ◇ Flowline / Hero
        </div>
        {BUILD_STEPS.map((step, index) => {
          const mounted = frame >= step.figmaDrop;
          const active = mounted && selectedIndex === index;

          return (
            <div
              key={step.key}
              style={{
                height: 44,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0 8px 0 21px",
                color: mounted ? "#f1f1f1" : "#9c9c9c",
                background: active ? "#0d99ff" : "transparent",
              }}
            >
              <span style={{fontSize: 11}}>{mounted ? "◆" : "◇"}</span>
              <span>{step.label}</span>
            </div>
          );
        })}
        <div
          style={{
            margin: "26px 12px 0",
            paddingTop: 16,
            borderTop: "1px solid #414141",
            color: "#777",
            lineHeight: 1.7,
            fontSize: 11,
          }}
        >
          COMPONENTS
          <br />
          Drag onto frame
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 170,
          right: 180,
          top: 164,
          bottom: 0,
          overflow: "hidden",
          background: "#1f1f1f",
        }}
      >
        <DataGrid frame={frame} color="#a259ff" opacity={0.045} />
        <div
          style={{
            position: "absolute",
            left: 10,
            top: 86,
            width: 720,
            height: 896,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              scale: 0.8,
              transformOrigin: "left top",
            }}
          >
            <FlowlineSite
              frame={frame}
              mode="figma"
              buildFrames={FIGMA_BUILD_FRAMES}
              constructionOnly
              showSelection
            />
          </div>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: -28,
              color: "#b7b7b7",
              fontFamily: "Arial, sans-serif",
              fontSize: 12,
            }}
          >
            Flowline / Hero · 900 × 1120
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 0,
          top: 164,
          width: 180,
          bottom: 0,
          background: "#2c2c2c",
          borderLeft: "1px solid #171717",
          fontFamily: "Arial, sans-serif",
          fontSize: 12,
          color: "#c9c9c9",
          zIndex: 15,
        }}
      >
        <div
          style={{
            height: 48,
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "0 14px",
            borderBottom: "1px solid #414141",
          }}
        >
          <span
            style={{
              color: "#fff",
              borderBottom: "2px solid #fff",
              height: 48,
              paddingTop: 17,
            }}
          >
            Design
          </span>
          <span>Prototype</span>
        </div>
        <div style={{padding: 14, borderBottom: "1px solid #414141"}}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <span>Frame</span>
            <span style={{color: "#777"}}>⋯</span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 7,
            }}
          >
            {[
              ["X", "0"],
              ["Y", "0"],
              ["W", "900"],
              ["H", "1120"],
            ].map(([key, value]) => (
              <div
                key={key}
                style={{
                  background: "#383838",
                  padding: "8px 7px",
                  borderRadius: 4,
                }}
              >
                <span style={{color: "#777"}}>{key} </span>
                {value}
              </div>
            ))}
          </div>
        </div>
        {[
          ["Auto layout", "Vertical · 24"],
          ["Fill", "#F5F5F3"],
          ["Stroke", "Inside · 1"],
          ["Effects", "Drop shadow"],
          ["Export", "Flowline / Hero"],
        ].map(([title, value]) => (
          <div
            key={title}
            style={{padding: 14, borderBottom: "1px solid #414141"}}
          >
            <div style={{color: "#f0f0f0", marginBottom: 9}}>{title}</div>
            <div style={{color: "#858585"}}>{value}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          left: 188,
          top: 1320,
          padding: "11px 14px",
          borderRadius: 8,
          background: "#2c2c2c",
          color:
            mountedCount === BUILD_STEPS.length ? "#71e1ad" : "#c8c8c8",
          border: "1px solid #444",
          fontFamily: "Space Mono",
          fontSize: 13,
          zIndex: 25,
        }}
      >
        {mountedCount === BUILD_STEPS.length
          ? "✓ HERO FRAME COMPLETE"
          : `ASSEMBLING · ${mountedCount}/${BUILD_STEPS.length}`}
      </div>
      <FigmaCursor frame={frame} />
      <Scanlines opacity={0.055} />
    </AbsoluteFill>
  );
};

type CodeLine = {
  text: string;
  start: number;
  duration: number;
  step?: BuildStep;
};

const codeLines: CodeLine[] = [
  {
    text: "export const FlowlineHero = () => (",
    start: 0,
    duration: 18,
  },
  {text: '  <Page theme="warm">', start: 18, duration: 12},
  ...BUILD_STEPS.map((step) => ({
    text: step.code,
    start: step.codeStart,
    duration: step.codeDuration,
    step,
  })),
  {text: "  </Page>", start: 137, duration: 8},
  {text: ");", start: 145, duration: 6},
];

const TypedCode = ({frame}: {frame: number}) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      padding: "48px 34px",
      fontFamily: "Space Mono",
      fontSize: 21,
      lineHeight: 1.72,
    }}
  >
    {codeLines.map((line, index) => {
      const end = line.start + line.duration;
      const chars = Math.round(
        interpolate(frame, [line.start, end], [0, line.text.length], clamp),
      );
      const active = frame >= line.start && frame < end;
      const mounted = Boolean(line.step && frame >= end);

      return (
        <div
          key={`${line.text}-${index}`}
          style={{
            position: "relative",
            minHeight: 36,
            color:
              line.text.includes("<") || line.text.includes("/>")
                ? "#ff8a62"
                : line.text.includes("export")
                  ? "#75e5ad"
                  : "#c7cbd0",
            background: active ? "rgba(255,79,18,.1)" : "transparent",
            borderLeft: active
              ? "2px solid #ff4f12"
              : "2px solid transparent",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 46,
              color: "#4c5157",
              paddingLeft: 8,
            }}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          {line.text.slice(0, chars)}
          {active ? <span style={{color: "#ff4f12"}}>▋</span> : null}
          {mounted ? (
            <span
              style={{
                position: "absolute",
                right: 12,
                color: "#75e5ad",
                fontSize: 15,
              }}
            >
              ✓ MOUNTED
            </span>
          ) : null}
        </div>
      );
    })}
  </div>
);

export const PolishedCodeScene = () => {
  const frame = useCurrentFrame();
  const mountedCount = BUILD_STEPS.filter(
    (step) => frame >= CODE_BUILD_FRAMES[step.key],
  ).length;
  const currentStep = BUILD_STEPS.find(
    (step) =>
      frame >= step.codeStart &&
      frame < step.codeStart + step.codeDuration,
  );

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
          height: 590,
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
              style={{
                width: 11,
                height: 11,
                borderRadius: 99,
                background: color,
              }}
            />
          ))}
          <div
            style={{
              marginLeft: 22,
              fontFamily: "Space Mono",
              fontSize: 13,
              color: "#8c9290",
            }}
          >
            src/components/FlowlineHero.tsx
          </div>
          <div
            style={{
              marginLeft: "auto",
              padding: "6px 10px",
              borderRadius: 5,
              background: "#202522",
              color: "#75e5ad",
              fontFamily: "Space Mono",
              fontSize: 11,
            }}
          >
            DEV SERVER ●
          </div>
        </div>
        <TypedCode frame={frame} />
      </div>

      <div
        style={{
          position: "absolute",
          left: 504,
          top: 708,
          width: 2,
          height: 64,
          background: "linear-gradient(#ff4f12,#75e5ad)",
          opacity: currentStep ? 0.9 : 0.28,
          boxShadow: currentStep ? "0 0 18px #75e5ad" : "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 488,
          top: 744,
          width: 34,
          height: 34,
          borderRadius: 99,
          background: "#111416",
          border: "1px solid #4b5550",
          display: "grid",
          placeItems: "center",
          color: "#75e5ad",
          fontSize: 16,
          zIndex: 5,
        }}
      >
        ↓
      </div>

      <div
        style={{
          position: "absolute",
          left: 216,
          top: 782,
          width: 648,
          height: 852,
          borderRadius: 20,
          overflow: "hidden",
          border: "1px solid #303533",
          background: "#171918",
          boxShadow: "0 40px 110px rgba(0,0,0,.55)",
        }}
      >
        <div
          style={{
            height: 42,
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            borderBottom: "1px solid #303533",
            fontFamily: "Space Mono",
            fontSize: 11,
            color: "#8c9290",
          }}
        >
          localhost:3000
          <span style={{marginLeft: "auto", color: "#75e5ad"}}>
            HMR · {mountedCount}/{BUILD_STEPS.length}
          </span>
        </div>
        <div
          style={{
            position: "absolute",
            width: 558,
            height: 694,
            left: 45,
            top: 70,
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
            color:
              mountedCount === BUILD_STEPS.length ? "#75e5ad" : "#68706c",
          }}
        >
          {mountedCount === BUILD_STEPS.length
            ? "✓ 5 components mounted · layout stable"
            : currentStep
              ? `mounting <${currentStep.label.replace(" ", "")} />…`
              : "waiting for component…"}
        </div>
      </div>

      <Scanlines opacity={0.08} />
    </AbsoluteFill>
  );
};

