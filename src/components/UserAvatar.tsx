import { useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { UserLogsModal } from "./UserLogsModal";

type UserAvatarProps = {
  name?: string;
  seed?: string;
  size?: "sm" | "md" | "lg";
  clickable?: boolean;
};

const palettes = [
  ["#006a60", "#9ff2e5", "#00201c"],
  ["#456179", "#cce5ff", "#071d2a"],
  ["#6d45b6", "#ecdfff", "#21005d"],
  ["#845400", "#ffddb0", "#2a1800"],
  ["#006d43", "#b8f1ce", "#002111"],
  ["#00658b", "#c5e7ff", "#001e2d"],
  ["#5b4a0f", "#f5e6b0", "#1a1200"],
  ["#6b1f6d", "#f3c6f5", "#200024"],
  ["#1a5276", "#aed6f1", "#071d2a"],
  ["#1e6b3c", "#a9dfbf", "#0b3d1f"],
];

type ChemSym = "atom" | "hex" | "flask" | "molecule" | "beaker" | "instrument";

const symbols: ChemSym[] = ["atom", "hex", "flask", "molecule", "beaker", "instrument"];

function ChemDecoration({ hash, style }: { hash: number; style?: CSSProperties }) {
  const base = { 
    className: "avatar-deco", 
    viewBox: "0 0 24 24", 
    fill: "none", 
    stroke: "currentColor", 
    strokeLinecap: "round" as const, 
    strokeLinejoin: "round" as const,
    style: { opacity: 0.75, ...style }
  };

  const family = hash % 6; // 6 distinct chemical structural families

  // ==========================================================================
  // Family 0: Procedural Atom Model
  // ==========================================================================
  if (family === 0) {
    const orbitCount = 2 + (hash % 3); // 2 to 4 orbits
    const rx = 9.0;
    const ry = 3.0;
    const orbits: ReactElement[] = [];
    const baseRotation = (hash % 15);

    for (let i = 0; i < orbitCount; i++) {
      const angle = (i * 180) / orbitCount + baseRotation;
      orbits.push(
        <ellipse 
          key={`orbit-${i}`} 
          cx="12" 
          cy="12" 
          rx={rx} 
          ry={ry} 
          transform={`rotate(${angle} 12 12)`} 
        />
      );
    }

    const electrons: ReactElement[] = [];
    const electronCount = 3 + (hash % 4); // 3 to 6 electrons
    for (let i = 0; i < electronCount; i++) {
      const angle = (i * 360) / electronCount + (hash % 30);
      const orbitIdx = i % orbitCount;
      const orbitAngle = (orbitIdx * 180) / orbitCount + baseRotation;
      const rad = (angle * Math.PI) / 180;
      const ex = 12 + rx * Math.cos(rad);
      const ey = 12 + ry * Math.sin(rad);
      electrons.push(
        <circle 
          key={`el-${i}`} 
          cx={ex} 
          cy={ey} 
          r="0.8" 
          fill="currentColor" 
          transform={`rotate(${orbitAngle} 12 12)`} 
        />
      );
    }

    const nucleusRadius = 1.0 + (hash % 3) * 0.3; // variable nucleus size

    return (
      <svg {...base} strokeWidth="1">
        {orbits}
        {electrons}
        {/* Nucleus cluster */}
        <circle cx="12" cy="12" r={nucleusRadius} fill="currentColor" />
        <circle cx="11.0" cy="11.2" r={nucleusRadius * 0.8} fill="currentColor" />
        <circle cx="13.0" cy="12.8" r={nucleusRadius * 0.8} fill="currentColor" />
        <circle cx="11.5" cy="13.0" r={nucleusRadius * 0.7} fill="currentColor" />
      </svg>
    );
  }

  // ==========================================================================
  // Family 1: Substituted Benzene Hex Ring (Compound)
  // ==========================================================================
  if (family === 1) {
    const r = 6.0;
    const vertices: { x: number; y: number; angleRad: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const angleDeg = i * 60 - 30;
      const angleRad = (angleDeg * Math.PI) / 180;
      vertices.push({
        x: 12 + r * Math.cos(angleRad),
        y: 12 + r * Math.sin(angleRad),
        angleRad
      });
    }

    // Aromatic double bonds resonance inside
    const doubleBonds: ReactElement[] = [];
    const resonanceType = hash % 2;
    const borderR = r - 1.2;
    for (let i = 0; i < 3; i++) {
      const startIdx = (i * 2 + resonanceType) % 6;
      const endIdx = (startIdx + 1) % 6;
      const startRad = vertices[startIdx].angleRad;
      const endRad = vertices[endIdx].angleRad;
      doubleBonds.push(
        <line 
          key={`db-${i}`}
          x1={12 + borderR * Math.cos(startRad)}
          y1={12 + borderR * Math.sin(startRad)}
          x2={12 + borderR * Math.cos(endRad)}
          y2={12 + borderR * Math.sin(endRad)}
          strokeWidth="0.8"
        />
      );
    }

    // Procedural functional groups at 6 outer vertices
    const attachments: ReactElement[] = [];
    for (let i = 0; i < 6; i++) {
      const { x: vx, y: vy, angleRad } = vertices[i];
      const typeVal = (hash >> (i * 2)) & 3; // 4 combinations per vertex
      const dx = Math.cos(angleRad);
      const dy = Math.sin(angleRad);

      if (typeVal === 1) {
        // Methyl branch line
        attachments.push(
          <line key={`att-${i}`} x1={vx} y1={vy} x2={vx + dx * 2.8} y2={vy + dy * 2.8} strokeWidth="1" />
        );
      } else if (typeVal === 2) {
        // Hydroxyl (-OH group)
        attachments.push(
          <g key={`att-${i}`}>
            <line x1={vx} y1={vy} x2={vx + dx * 2.0} y2={vy + dy * 2.0} strokeWidth="1" />
            <circle cx={vx + dx * 3.0} cy={vy + dy * 3.0} r="0.8" fill="currentColor" />
          </g>
        );
      } else if (typeVal === 3) {
        // Carbonyl (=O double bond oxygen)
        const perpX = -dy * 0.4;
        const perpY = dx * 0.4;
        attachments.push(
          <g key={`att-${i}`}>
            <line x1={vx + perpX} y1={vy + perpY} x2={vx + dx * 2.2 + perpX} y2={vy + dy * 2.2 + perpY} strokeWidth="0.8" />
            <line x1={vx - perpX} y1={vy - perpY} x2={vx + dx * 2.2 - perpX} y2={vy + dy * 2.2 - perpY} strokeWidth="0.8" />
            <circle cx={vx + dx * 3.2} cy={vy + dy * 3.2} r="1.1" fill="currentColor" />
          </g>
        );
      }
    }

    return (
      <svg {...base} strokeWidth="1">
        {/* Main Hexagon */}
        <polygon points={vertices.map(v => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(" ")} />
        {doubleBonds}
        {attachments}
      </svg>
    );
  }

  // ==========================================================================
  // Family 2: Polycyclic Fused Naphthalene Skeleton (Compound)
  // ==========================================================================
  if (family === 2) {
    // Left ring center ~ 8.5, Right ring center ~ 15.5
    const leftRing = "4,8 8.5,5.4 13,8 13,16 8.5,18.6 4,16";
    const rightRing = "13,8 17.5,5.4 22,8 22,16 17.5,18.6 13,16";

    // 8 free outer vertices for substituents
    const outerVerts = [
      { x: 4.0, y: 8.0, dx: -0.86, dy: -0.5 },
      { x: 8.5, y: 5.4, dx: 0.0, dy: -1.0 },
      { x: 17.5, y: 5.4, dx: 0.0, dy: -1.0 },
      { x: 22.0, y: 8.0, dx: 0.86, dy: -0.5 },
      { x: 22.0, y: 16.0, dx: 0.86, dy: 0.5 },
      { x: 17.5, y: 18.6, dx: 0.0, dy: 1.0 },
      { x: 8.5, y: 18.6, dx: 0.0, dy: 1.0 },
      { x: 4.0, y: 16.0, dx: -0.86, dy: 0.5 }
    ];

    const attachments: ReactElement[] = [];
    for (let i = 0; i < 8; i++) {
      const v = outerVerts[i];
      const val = (hash >> i) & 3;

      if (val === 1) {
        // Methyl bond link
        attachments.push(
          <line key={`att-${i}`} x1={v.x} y1={v.y} x2={v.x + v.dx * 2.5} y2={v.y + v.dy * 2.5} strokeWidth="1" />
        );
      } else if (val === 2) {
        // Hetero group dot
        attachments.push(
          <g key={`att-${i}`}>
            <line x1={v.x} y1={v.y} x2={v.x + v.dx * 1.8} y2={v.y + v.dy * 1.8} strokeWidth="1" />
            <circle cx={v.x + v.dx * 2.6} cy={v.y + v.dy * 2.6} r="0.8" fill="currentColor" />
          </g>
        );
      }
    }

    return (
      <svg {...base} strokeWidth="1">
        <polygon points={leftRing} />
        <polygon points={rightRing} />
        {/* Resonance lines */}
        <line x1="5.5" y1="8.5" x2="5.5" y2="15.5" strokeWidth="0.8" />
        <line x1="10.8" y1="9.0" x2="10.8" y2="15.0" strokeWidth="0.8" />
        <line x1="14.5" y1="6.8" x2="19.5" y2="9.8" strokeWidth="0.8" />
        <line x1="19.5" y1="14.2" x2="14.5" y2="17.2" strokeWidth="0.8" />
        {attachments}
      </svg>
    );
  }

  // ==========================================================================
  // Family 3: Variable Chemical Flasks (Instrument)
  // ==========================================================================
  if (family === 3) {
    const flaskType = hash % 3; // 0: Erlenmeyer, 1: Round Bulb, 2: Distillation
    const fluidY = 11 + (hash % 8); // y = 11 to 18
    const showStopper = (hash % 2) === 0;

    let flaskPath = "";
    let fluidLine: ReactElement | null = null;
    let condenserArm: ReactElement | null = null;

    if (flaskType === 0) {
      // Erlenmeyer
      flaskPath = "M10 4h4v3.5L4.5 18.5A1.5 1.5 0 005.8 21h12.4a1.5 1.5 0 001.3-2.5L14 7.5V4h-4z";
      // Interpolate width at y level
      const fraction = (fluidY - 7.5) / (20.5 - 7.5);
      const leftX = 10 - fraction * 5.5;
      const rightX = 14 + fraction * 5.5;
      fluidLine = <line x1={leftX} y1={fluidY} x2={rightX} y2={fluidY} strokeWidth="0.8" />;
    } else if (flaskType === 1) {
      // Volumetric round bulb
      flaskPath = "M10 4h4v6.5a5.5 5.5 0 11-8 0V4h4z";
      // Calculate intersection endpoints
      const bulbRadius = 5.5;
      const bulbCenterY = 15.5;
      const dy = Math.abs(fluidY - bulbCenterY);
      const dx = Math.sqrt(Math.max(0, bulbRadius * bulbRadius - dy * dy));
      fluidLine = <line x1={12 - dx} y1={fluidY} x2={12 + dx} y2={fluidY} strokeWidth="0.8" />;
    } else {
      // Distillation
      flaskPath = "M10 4h4v5.5a4.5 4.5 0 11-6 0V4h2z";
      condenserArm = (
        <g>
          {/* Distillation side arm */}
          <path d="M13.5 7.5l4.5 3.0" />
          {/* Condenser cooling jacket */}
          <line x1="14.2" y1="7.0" x2="18.5" y2="10.0" strokeWidth="2.4" opacity="0.38" />
        </g>
      );
      const bulbRadius = 4.5;
      const bulbCenterY = 15.5;
      const dy = Math.abs(fluidY - bulbCenterY);
      const dx = Math.sqrt(Math.max(0, bulbRadius * bulbRadius - dy * dy));
      fluidLine = <line x1={12 - dx} y1={fluidY} x2={12 + dx} y2={fluidY} strokeWidth="0.8" />;
    }

    // Bubbles inside
    const bubbles: ReactElement[] = [];
    const bubbleCount = 2 + (hash % 3);
    for (let i = 0; i < bubbleCount; i++) {
      const bx = 9 + ((hash >> (i * 2)) % 7);
      const by = fluidY + 1.2 + ((hash >> (i * 3)) % (20.5 - fluidY));
      if (by < 20.0) {
        bubbles.push(
          <circle key={`bub-${i}`} cx={bx} cy={by} r="0.4" fill="currentColor" />
        );
      }
    }

    return (
      <svg {...base} strokeWidth="1">
        {showStopper && <rect x="10.5" y="2" width="3" height="1.8" rx="0.5" fill="currentColor" />}
        <path d={flaskPath} />
        {fluidLine}
        {condenserArm}
        {bubbles}
        {/* Measurement graduations on flask body */}
        <line x1="11.5" y1="11" x2="12.5" y2="11" />
        <line x1="11.0" y1="14" x2="12.5" y2="14" />
        <line x1="10.5" y1="17" x2="12.5" y2="17" />
      </svg>
    );
  }

  // ==========================================================================
  // Family 4: Beakers & Two Test-Tube Arrays (Instrument)
  // ==========================================================================
  if (family === 4) {
    const isBeaker = (hash % 2) === 0;

    if (isBeaker) {
      const fluidY = 8 + (hash % 11); // y = 8 to 18
      const hasStirrer = (hash % 2) === 0;

      return (
        <svg {...base} strokeWidth="1">
          {/* Beaker outline with spout */}
          <path d="M19 4.5H5.5L5 4H3.5M19 4.5v15a2 2 0 01-2 2H7a2 2 0 01-2-2v-15" />
          <line x1="5.1" y1={fluidY} x2="18.9" y2={fluidY} strokeWidth="0.8" />
          {hasStirrer && <line x1="8.5" y1="2.0" x2="16.5" y2="20.0" strokeWidth="1.2" />}
          {/* Graduations */}
          <line x1="5" y1="7.5" x2="9" y2="7.5" />
          <line x1="5" y1="11.0" x2="8.0" y2="11.0" />
          <line x1="5" y1="14.5" x2="9" y2="14.5" />
          <line x1="5" y1="18.0" x2="8.0" y2="18.0" />
          {/* Bubbles */}
          <circle cx="10" cy={fluidY + 2} r="0.5" fill="currentColor" />
          <circle cx="14" cy={fluidY + 5} r="0.6" fill="currentColor" />
          <circle cx="12" cy={fluidY + 8} r="0.4" fill="currentColor" />
        </svg>
      );
    } else {
      // Two test tubes rack array
      const fluidY1 = 6 + (hash % 8);
      const fluidY2 = 6 + ((hash >> 3) % 8);

      return (
        <svg {...base} strokeWidth="1">
          {/* Rack support lines */}
          <line x1="3" y1="7" x2="21" y2="7" strokeWidth="1" strokeDasharray="1,1" />
          <line x1="3" y1="15" x2="21" y2="15" strokeWidth="1" />
          {/* Tube 1 */}
          <path d="M5 4v11.5a2.5 2.5 0 005 0V4" />
          <line x1="5.1" y1={fluidY1} x2="9.9" y2={fluidY1} strokeWidth="0.8" />
          {/* Tube 2 */}
          <path d="M14 4v11.5a2.5 2.5 0 005 0V4" />
          <line x1="14.1" y1={fluidY2} x2="18.9" y2={fluidY2} strokeWidth="0.8" />
        </svg>
      );
    }
  }

  // ==========================================================================
  // Family 5: Microscope (Instrument) & Crystal Lattice (Compound Structure)
  // ==========================================================================
  const isMicroscope = (hash % 2) === 0;

  if (isMicroscope) {
    // Detailed laboratory microscope instrument
    return (
      <svg {...base} strokeWidth="1">
        {/* Base stand */}
        <path d="M5 20h13M8 20v-3h7v3" />
        {/* Stage support & stage */}
        <line x1="6" y1="13" x2="13" y2="13" />
        <path d="M11 13v4" />
        {/* Curved spine arm */}
        <path d="M15 17c0-4-2.5-6.5-5.5-7" />
        {/* Microscope body tube & eyepiece */}
        <g transform="rotate(-20 9.5 9.5)">
          {/* Body tube */}
          <rect x="8.5" y="6" width="2" height="6.5" rx="0.3" />
          {/* Eyepiece tube */}
          <rect x="8.75" y="3" width="1.5" height="3" rx="0.2" />
          <line x1="8.75" y1="4.5" x2="10.25" y2="4.5" />
          {/* Objective lens */}
          <path d="M8.5 12.5l0.5 2h1l0.5-2" />
        </g>
        {/* Focus adjustment knob */}
        <circle cx="14.5" cy="15.5" r="1.1" />
        <circle cx="14.5" cy="15.5" r="0.4" fill="currentColor" />
        {/* Substage mirror */}
        <line x1="8" y1="16" x2="10" y2="15" />
      </svg>
    );
  } else {
    // 3D Cubic Crystal Lattice Compound (e.g. NaCl unit cell skeleton)
    const atoms = [
      { x: 5, y: 5 }, { x: 15, y: 5 }, { x: 15, y: 15 }, { x: 5, y: 15 }, // Front face atoms
      { x: 9, y: 9 }, { x: 19, y: 9 }, { x: 19, y: 19 }, { x: 9, y: 19 }, // Back face atoms
    ];

    return (
      <svg {...base} strokeWidth="0.9">
        {/* Back face boundaries */}
        <polygon points="9,9 19,9 19,19 9,19" strokeWidth="0.8" opacity="0.5" strokeDasharray="2,2" />
        
        {/* BCC Diagonal corner-to-center bond vectors */}
        <line x1="5" y1="5" x2="12" y2="12" strokeWidth="0.7" strokeDasharray="1,1" />
        <line x1="15" y1="5" x2="12" y2="12" strokeWidth="0.7" strokeDasharray="1,1" />
        <line x1="15" y1="15" x2="12" y2="12" strokeWidth="0.7" strokeDasharray="1,1" />
        <line x1="5" y1="15" x2="12" y2="12" strokeWidth="0.7" strokeDasharray="1,1" />
        <line x1="9" y1="9" x2="12" y2="12" strokeWidth="0.7" strokeDasharray="1,1" />
        <line x1="19" y1="9" x2="12" y2="12" strokeWidth="0.7" strokeDasharray="1,1" />
        <line x1="19" y1="19" x2="12" y2="12" strokeWidth="0.7" strokeDasharray="1,1" />
        <line x1="9" y1="19" x2="12" y2="12" strokeWidth="0.7" strokeDasharray="1,1" />

        {/* Front face boundaries */}
        <polygon points="5,5 15,5 15,15 5,15" />
        
        {/* Depth connections */}
        <line x1="5" y1="5" x2="9" y2="9" />
        <line x1="15" y1="5" x2="19" y2="9" />
        <line x1="15" y1="15" x2="19" y2="19" />
        <line x1="5" y1="15" x2="9" y2="19" />

        {/* Lattice node spheres */}
        {atoms.map((a, i) => (
          <circle key={`atom-${i}`} cx={a.x} cy={a.y} r="1.3" fill={i % 2 === 0 ? "currentColor" : "none"} />
        ))}
        
        {/* Central interstitial coordinate atom */}
        <circle cx="12" cy="12" r="1.8" fill="currentColor" />
        <circle cx="12" cy="12" r="1.0" fill="none" stroke="var(--avatar-bg)" strokeWidth="0.5" />
      </svg>
    );
  }
}

export function UserAvatar({ name = "User", seed = "", size = "md", clickable = true }: UserAvatarProps) {
  const hash = hashString(seed || name);
  const palette = palettes[hash % palettes.length];
  const [isOpen, setIsOpen] = useState(false);

  const style = {
    "--avatar-bg": `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`,
    "--avatar-fg": palette[2],
  } as CSSProperties;

  return (
    <>
      <span
        className={`avatar avatar-${size} ${clickable ? "clickable-avatar" : ""}`}
        style={style}
        aria-hidden="true"
        title={clickable ? `Click to inspect ${name}'s logs` : name}
        onClick={clickable ? (e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(true); } : undefined}
      >
        <ChemDecoration hash={hash} />
      </span>

      {clickable && (
        <UserLogsModal
          name={name}
          open={isOpen}
          onClose={() => setIsOpen(false)}
          headerAvatar={
            <span className="avatar avatar-md" style={style}>
              <ChemDecoration hash={hash} />
            </span>
          }
        />
      )}
    </>
  );
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
