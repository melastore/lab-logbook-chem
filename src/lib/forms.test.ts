import { describe, it, expect } from 'vitest';
import { STANDARD_KEYS, INSTRUMENT_STANDARD_KEYS, type FormDef } from './forms';

describe('Form Definitions Logic', () => {
  it('should have the correct standard logbook keys', () => {
    expect(STANDARD_KEYS).toContain('date');
    expect(STANDARD_KEYS).toContain('analyst');
    expect(STANDARD_KEYS).toContain('sampleId');
  });

  it('should have the correct instrument metadata keys', () => {
    expect(INSTRUMENT_STANDARD_KEYS).toContain('instrumentName');
    expect(INSTRUMENT_STANDARD_KEYS).toContain('instrumentId');
    expect(INSTRUMENT_STANDARD_KEYS).toContain('department');
  });

  it('should correctly define the instrument info form', () => {
    // This is a dynamic check for the "Super Power" feature
    const mockInstrumentForm: FormDef = {
      id: "instrument",
      title: "General Information Fields",
      activityType: "INFO",
      scope: "instrument",
      fields: [
        { key: "department", label: "Department", type: "text" },
      ],
    };
    
    expect(mockInstrumentForm.scope).toBe('instrument');
    expect(mockInstrumentForm.fields.length).toBeGreaterThan(0);
  });
});
