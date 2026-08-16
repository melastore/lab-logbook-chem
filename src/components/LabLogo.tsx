import Image from "next/image";

// Intrinsic size of public/emi-logo.png. next/image needs both dimensions up
// front to reserve the space, and keeping the real ratio here means callers can
// go on asking for a height alone.
const LOGO_WIDTH = 312;
const LOGO_HEIGHT = 161;
const RATIO = LOGO_WIDTH / LOGO_HEIGHT;

/**
 * Exact brand mark for the lab logbook: EMI (Ethiopian Metrology Institute).
 * Clean and professional presentation.
 */
export function LabLogo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <div className={`lab-logo-container ${className || ""}`}>
      <Image
        src="/emi-logo.png"
        alt="Ethiopian Metrology Institute"
        width={Math.round(size * RATIO)}
        height={size}
        priority
        className="lab-logo-img"
      />
    </div>
  );
}
