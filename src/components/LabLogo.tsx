/**
 * Exact brand mark for the lab logbook: EMI (Ethiopian Metrology Institute).
 * Uses the provided PNG logo asset directly without any additional elements.
 */
export function LabLogo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <img 
      src="/emi-logo.png" 
      alt="Ethiopian Metrology Institute Logo" 
      height={size}
      className={className}
      style={{ display: "block", objectFit: "contain", width: "auto" }}
    />
  );
}
