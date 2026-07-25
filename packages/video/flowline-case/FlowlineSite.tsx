import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
} from "remotion";
import {
  getMountedStep,
} from "./BuildTimeline";
import type {
  BuildComponentKey,
  BuildFrames,
} from "./BuildTimeline";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

const BuildIn: React.FC<{
  frame: number;
  start: number;
  children: React.ReactNode;
  distance?: number;
  clean?: boolean;
}> = ({frame, start, children, distance = 28, clean = false}) => {
  const duration = clean ? 3 : 10;

  return (
    <div
      style={{
        opacity: interpolate(frame, [start, start + duration], [0, 1], {
          ...clamp,
          easing: easeOut,
        }),
        translate: clean
          ? "0px 0px"
          : `0px ${interpolate(
              frame,
              [start, start + 12],
              [distance, 0],
              {
                ...clamp,
                easing: easeOut,
              },
            )}px`,
        scale: clean
          ? 1
          : interpolate(frame, [start, start + 12], [0.96, 1], {
              ...clamp,
              easing: easeOut,
            }),
      }}
    >
      {children}
    </div>
  );
};

const AppMark = () => (
  <div
    style={{
      position: "relative",
      width: 32,
      height: 32,
    }}
  >
    <div
      style={{
        position: "absolute",
        left: 3,
        top: 3,
        width: 19,
        height: 19,
        border: "4px solid #111214",
      }}
    />
    <div
      style={{
        position: "absolute",
        right: 3,
        bottom: 3,
        width: 19,
        height: 19,
        border: "4px solid #111214",
      }}
    />
  </div>
);

const Navigation = () => (
  <div
    style={{
      height: 66,
      borderRadius: 22,
      background: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 18px 0 24px",
      boxShadow: "0 16px 48px rgba(0,0,0,.16)",
    }}
  >
    <AppMark />
    <div style={{display: "flex", gap: 9}}>
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 12,
          background: "#ececee",
          display: "grid",
          placeItems: "center",
          color: "#111214",
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        A
      </div>
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 12,
          background: "#ececee",
          display: "grid",
          placeItems: "center",
          color: "#111214",
          fontSize: 22,
        }}
      >
        ▶
      </div>
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 12,
          background: "#ececee",
          display: "grid",
          placeItems: "center",
          color: "#111214",
          fontSize: 26,
        }}
      >
        ≡
      </div>
    </div>
  </div>
);

const HeroCopy = () => (
  <div
    style={{
      textAlign: "center",
      color: "#fff",
      width: 760,
      margin: "0 auto",
    }}
  >
    <div
      style={{
        margin: "0 auto 24px",
        width: "fit-content",
        padding: "7px 15px 8px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,.4)",
        background: "rgba(17,18,20,.44)",
        fontSize: 15,
        fontWeight: 600,
      }}
    >
      <span
        style={{
          padding: "3px 9px",
          marginRight: 10,
          borderRadius: 999,
          background: "#111214",
        }}
      >
        New
      </span>
      A calmer way to build habits
    </div>
    <div
      style={{
        fontFamily: "Dewi",
        fontWeight: 600,
        fontSize: 64,
        lineHeight: 0.98,
        letterSpacing: "-0.04em",
      }}
    >
      Build habits that actually stick
    </div>
    <div
      style={{
        margin: "27px auto 0",
        width: 500,
        fontSize: 23,
        lineHeight: 1.25,
      }}
    >
      You see the right habits at the right
      <br />
      time so your day never feels crowded.
    </div>
  </div>
);

const Actions = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      gap: 18,
    }}
  >
    <div
      style={{
        minWidth: 256,
        height: 62,
        borderRadius: 999,
        background: "#fff",
        color: "#202124",
        display: "grid",
        placeItems: "center",
        fontSize: 20,
      }}
    >
      Start tracking for free
    </div>
    <div
      style={{
        minWidth: 215,
        height: 62,
        borderRadius: 999,
        color: "#fff",
        border: "1px solid rgba(255,255,255,.38)",
        background: "rgba(31,20,18,.22)",
        display: "flex",
        gap: 12,
        alignItems: "center",
        justifyContent: "center",
        fontSize: 20,
        fontWeight: 600,
      }}
    >
      <span style={{fontSize: 22}}>▶</span>
      Watch demo
    </div>
  </div>
);

const StreakCard = () => (
  <div
    style={{
      width: 230,
      height: 210,
      padding: 24,
      borderRadius: 24,
      border: "1px solid rgba(255,255,255,.3)",
      background:
        "linear-gradient(145deg,rgba(36,33,31,.86),rgba(14,14,15,.95))",
      color: "#fff",
      boxShadow: "0 26px 70px rgba(0,0,0,.28)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      alignItems: "center",
    }}
  >
    <div
      style={{
        width: 72,
        height: 72,
        borderRadius: 999,
        background: "#ff7a00",
        display: "grid",
        placeItems: "center",
        fontSize: 34,
        boxShadow: "0 10px 25px rgba(255,122,0,.28)",
      }}
    >
      ◈
    </div>
    <div
      style={{
        fontSize: 23,
        lineHeight: 1.08,
        textAlign: "center",
        fontWeight: 600,
      }}
    >
      7-day streak
      <br />
      unlocked
    </div>
  </div>
);

const GoalCard = () => (
  <div
    style={{
      width: 242,
      height: 170,
      padding: "22px 20px",
      borderRadius: 24,
      border: "1px solid rgba(255,255,255,.26)",
      background:
        "linear-gradient(145deg,rgba(56,29,24,.88),rgba(12,12,14,.94))",
      color: "#fff",
      boxShadow: "0 26px 70px rgba(0,0,0,.28)",
      textAlign: "center",
    }}
  >
    <div style={{fontSize: 18, fontWeight: 600}}>
      Today&apos;s goal:
      <br />
      Complete 3 habits
    </div>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginTop: 20,
      }}
    >
      {[
        ["●", "65%"],
        ["◒", "87%"],
        ["◩", "94%"],
      ].map(([icon, value]) => (
        <div key={value}>
          <div
            style={{
              width: 45,
              height: 45,
              borderRadius: 999,
              background: "#fff",
              color: "#111214",
              display: "grid",
              placeItems: "center",
              fontSize: 22,
            }}
          >
            {icon}
          </div>
          <div style={{fontSize: 12, marginTop: 7}}>{value}</div>
        </div>
      ))}
    </div>
  </div>
);

const AboutCopy = () => (
  <div
    style={{
      color: "#111214",
      textAlign: "center",
      width: 760,
      margin: "0 auto",
    }}
  >
    <div
      style={{
        fontSize: 48,
        lineHeight: 1.04,
        letterSpacing: "-0.035em",
      }}
    >
      Build steady daily habits with a layout that keeps your mornings,
      evenings, and focus simple to follow.
    </div>
    <div style={{fontSize: 18, color: "#71737a", marginTop: 32}}>
      Used by people to improve routines.
    </div>
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 12,
        marginTop: 20,
      }}
    >
      {["#Founders", "#Students", "#Busy parents"].map((tag) => (
        <div
          key={tag}
          style={{
            borderRadius: 999,
            padding: "9px 14px",
            background: "#e9e9e8",
            fontSize: 14,
          }}
        >
          {tag}
        </div>
      ))}
    </div>
  </div>
);

export type SiteMode = "figma" | "code" | "runtime";

const selectionForKey = (key: BuildComponentKey) => {
  if (key === "navigation") {
    return {x: 60, y: 42, width: 780, height: 66, label: "Navigation"};
  }

  if (key === "heroCopy") {
    return {x: 72, y: 194, width: 756, height: 250, label: "Hero Copy"};
  }

  if (key === "actions") {
    return {x: 202, y: 490, width: 496, height: 62, label: "Actions"};
  }

  if (key === "heroMedia") {
    return {x: 0, y: 0, width: 900, height: 930, label: "Hero Media"};
  }

  return {x: 70, y: 625, width: 760, height: 355, label: "Habit Cards"};
};

const SelectionBox: React.FC<{
  frame: number;
  buildFrames: BuildFrames;
}> = ({frame, buildFrames}) => {
  const step = getMountedStep(frame, buildFrames);

  if (!step) {
    return null;
  }

  const box = selectionForKey(step.key);

  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        border: "3px solid #a259ff",
        borderRadius: 7,
        pointerEvents: "none",
        zIndex: 90,
        boxShadow: "0 0 0 1px rgba(255,255,255,.7)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -3,
          top: -28,
          padding: "5px 8px",
          borderRadius: 4,
          background: "#a259ff",
          color: "#fff",
          fontFamily: "Space Mono",
          fontSize: 12,
          lineHeight: 1,
        }}
      >
        {box.label}
      </div>
      {[
        [-6, -6],
        [box.width - 6, -6],
        [-6, box.height - 6],
        [box.width - 6, box.height - 6],
      ].map(([x, y]) => (
        <div
          key={`${x}-${y}`}
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: 10,
            height: 10,
            borderRadius: 2,
            background: "#fff",
            border: "2px solid #a259ff",
          }}
        />
      ))}
    </div>
  );
};

export const FlowlineSite: React.FC<{
  frame: number;
  mode: SiteMode;
  buildFrames: BuildFrames;
  showSelection?: boolean;
  constructionOnly?: boolean;
}> = ({
  frame,
  mode,
  buildFrames,
  showSelection = false,
  constructionOnly = false,
}) => {
  const isFigma = mode === "figma";
  const isRuntime = mode === "runtime";
  const cleanBuild = mode !== "runtime";

  return (
    <div
      style={{
        position: "relative",
        width: 900,
        height: constructionOnly ? 1120 : 1420,
        overflow: "hidden",
        borderRadius: 24,
        background: "#f5f5f3",
        boxShadow: isFigma
          ? "0 36px 100px rgba(0,0,0,.36)"
          : "0 40px 120px rgba(0,0,0,.48)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 900,
          height: 930,
          overflow: "hidden",
          background:
            "radial-gradient(circle at 24% 38%,#ba3b05 0%,#6d1d06 34%,#160d0d 88%)",
        }}
      >
        <BuildIn
          frame={frame}
          start={buildFrames.heroMedia}
          distance={0}
          clean={cleanBuild}
        >
          <Img
            src={staticFile("assets/flowline-case/hero-background.jpg")}
            style={{
              position: "absolute",
              inset: 0,
              width: 900,
              height: 930,
              objectFit: "cover",
              opacity: isFigma ? 0.52 : 1,
              filter: isFigma ? "grayscale(.35) contrast(.9)" : "none",
            }}
          />
        </BuildIn>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg,rgba(9,7,8,.14),rgba(12,8,8,.03) 55%,rgba(22,12,9,.22))",
          }}
        />
      </div>

      <div style={{position: "absolute", left: 60, top: 42, width: 780}}>
        <BuildIn
          frame={frame}
          start={buildFrames.navigation}
          distance={-24}
          clean={cleanBuild}
        >
          <Navigation />
        </BuildIn>
      </div>

      <div style={{position: "absolute", left: 0, top: 192, width: 900}}>
        <BuildIn
          frame={frame}
          start={buildFrames.heroCopy}
          clean={cleanBuild}
        >
          <HeroCopy />
        </BuildIn>
      </div>

      <div style={{position: "absolute", left: 0, top: 490, width: 900}}>
        <BuildIn
          frame={frame}
          start={buildFrames.actions}
          clean={cleanBuild}
        >
          <Actions />
        </BuildIn>
      </div>

      <div style={{position: "absolute", left: 335, top: 555, width: 230}}>
        <BuildIn
          frame={frame}
          start={buildFrames.heroMedia}
          distance={54}
          clean={cleanBuild}
        >
          <Img
            src={staticFile("assets/flowline-case/hero-phone.png")}
            style={{
              width: 230,
              height: 474,
              objectFit: "contain",
              filter: isRuntime
                ? "drop-shadow(0 30px 45px rgba(0,0,0,.25))"
                : "drop-shadow(0 20px 35px rgba(0,0,0,.18))",
            }}
          />
        </BuildIn>
      </div>

      <div style={{position: "absolute", left: 70, top: 650}}>
        <BuildIn
          frame={frame}
          start={buildFrames.cards}
          clean={cleanBuild}
        >
          <StreakCard />
        </BuildIn>
      </div>

      <div style={{position: "absolute", left: 588, top: 625}}>
        <BuildIn
          frame={frame}
          start={buildFrames.cards}
          clean={cleanBuild}
        >
          <GoalCard />
        </BuildIn>
      </div>

      {constructionOnly ? null : (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 900,
            width: 900,
            height: 520,
            paddingTop: 145,
            background:
              "linear-gradient(180deg,rgba(245,245,243,0),#f5f5f3 50px,#f5f5f3)",
          }}
        >
          <BuildIn
            frame={frame}
            start={buildFrames.cards + 20}
            distance={38}
          >
            <AboutCopy />
          </BuildIn>
        </div>
      )}

      {isFigma ? (
        <>
          <AbsoluteFill
            style={{
              pointerEvents: "none",
              opacity: 0.17,
              backgroundImage:
                "linear-gradient(rgba(162,89,255,.35) 1px,transparent 1px),linear-gradient(90deg,rgba(162,89,255,.35) 1px,transparent 1px)",
              backgroundSize: "30px 30px",
            }}
          />
          {showSelection ? (
            <SelectionBox frame={frame} buildFrames={buildFrames} />
          ) : null}
        </>
      ) : null}
    </div>
  );
};
