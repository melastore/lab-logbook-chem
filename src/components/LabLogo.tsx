/**
 * Exact brand mark for the lab logbook: EMI (Ethiopian Metrology Institute).
 * Clean and professional presentation.
 */
export function LabLogo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <div className={`lab-logo-container ${className || ''}`} style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <img 
        src="/emi-logo.png" 
        alt="Ethiopian Metrology Institute Logo" 
        height={size}
        style={{ 
          display: "block", 
          objectFit: "contain", 
          width: "auto"
        }}
      />
    </div>
  );
}
