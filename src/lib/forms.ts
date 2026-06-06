// ─────────────────────────────────────────────────────────────────────────────
// Instrument tree + form field definitions.
// Field labels / titles mirror the controlled "Analytical Instruments
// Laboratory Book Template" exactly. Extra (non-standard) field values are
// stored in the record `metadata` jsonb; the keys listed in STANDARD_KEYS map
// onto first-class logbook_records columns so existing filters/charts keep
// working.
// ─────────────────────────────────────────────────────────────────────────────

export type InstrumentNode = {
  id: string;
  name: string;
  instrumentId: string;
  model: string;
  serialNumber?: string;
  department?: string;
  desk?: string;
  laboratoryName?: string;
  location?: string;
  manufacturer?: string;
  installationDate?: string;
  logbookStartDate?: string;
  logbookEndDate?: string;
  methodUsed?: string;
  metadata?: Record<string, unknown>;
  infoFormId?: string;
};

export type InstrumentGroup = {
  id: string;
  name: string;
  children: InstrumentNode[];
};

// All instruments are Thermo Scientific.
export const INSTRUMENT_TREE: InstrumentGroup[] = [
  {
    id: "elemental",
    name: "Elemental",
    children: [
      {
        id: "icpms",
        name: "ICP-MS",
        instrumentId: "ICP-MS-001",
        model: "iCAP TQ",
        manufacturer: "Thermo Scientific",
        department: "Chemical Metrology Research Lead Executive",
        desk: "Organic and Inorganic Chemistry Metrology Research Desk",
        laboratoryName: "Elemental Analysis Laboratory",
        location: "Block 10 First Floor Room 007",
        installationDate: "2026-03-26",
      },
      { id: "icpoes", name: "ICP-OES", instrumentId: "ICP-OES-001", model: "iCAP PRO", manufacturer: "Thermo Scientific" },
      { id: "aas",    name: "AAS",     instrumentId: "AAS-001",     model: "iCE 3500 AA", manufacturer: "Thermo Scientific" },
    ],
  },
  {
    id: "hplc",
    name: "Liquid Chromatography",
    children: [
      { id: "vanquish",     name: "Vanquish",      instrumentId: "HPLC-VQ-001",  model: "Vanquish Core", manufacturer: "Thermo Scientific" },
      { id: "ultimate3000", name: "Ultimate 3000", instrumentId: "HPLC-U3K-001", model: "Dionex UltiMate 3000", manufacturer: "Thermo Scientific" },
      { id: "lcmsms",       name: "LC-MS/MS",      instrumentId: "LCMS-001",     model: "Vanquish LC + TSQ", manufacturer: "Thermo Scientific" },
    ],
  },
  {
    id: "gc",
    name: "Gas Chromatography",
    children: [
      { id: "trace1310", name: "TRACE 1310", instrumentId: "GC-1310-001", model: "TRACE 1310", manufacturer: "Thermo Scientific" },
      { id: "trace1610", name: "TRACE 1610", instrumentId: "GC-1610-001", model: "TRACE 1610", manufacturer: "Thermo Scientific" },
      { id: "gcmsms",    name: "GC-MS/MS",   instrumentId: "GC-MSMS-001", model: "TSQ 9610 GC-MS/MS", manufacturer: "Thermo Scientific" },
    ],
  },
];

// Keys that map onto first-class logbook_records columns (everything else → metadata).
export const STANDARD_KEYS = new Set([
  "date",
  "analyst",
  "sampleId",
  "measuredValue",
  "methodUsed",
  "startTime",
  "endTime",
  "remarks",
]);

export const INSTRUMENT_STANDARD_KEYS = new Set([
  "categoryId", "instrumentName", "instrumentModel", "serialNumber", "manufacturer",
  "installationDate", "instrumentId", "laboratoryName", "department", "location", "desk",
  "logbookStartDate", "logbookEndDate", "methodUsed", "infoFormId"
]);

export type FieldType = "text" | "date" | "time" | "textarea" | "number" | "select";

export type FormField = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  full?: boolean;
};

export type FormScope = "analytical" | "sample" | "instrument";

export type FormDef = {
  id: string;          // doubles as the default selected form id
  title: string;       // exact template heading
  activityType: string;
  scope: FormScope;    // analytical instrument log vs. sample-preparation log vs. instrument info
  fields: FormField[];
};

// ─── Analytical-instrument forms ─────────────────────────────────────────────

export const DAILY_OPERATION: FormDef = {
  id: "daily",
  title: "Daily Operation Record",
  activityType: "OP",
  scope: "analytical",
  fields: [
    { key: "date",                label: "Date",                type: "date", required: true },
    { key: "analyst",             label: "Analyst Name",        type: "text", required: true, placeholder: "Full name" },
    { key: "activityPerformed",   label: "Activity Performed",  type: "text", required: true, placeholder: "e.g. Sample analysis", full: true },
    { key: "instrumentCondition", label: "Instrument Condition", type: "text", placeholder: "e.g. Normal / OK" },
    { key: "startTime",           label: "Start Time",          type: "time" },
    { key: "endTime",             label: "End Time",            type: "time" },
    { key: "remarks",             label: "Remarks",             type: "textarea", full: true },
  ],
};

export const QUALITY_CALIBRATION: FormDef = {
  id: "quality",
  title: "Quality Control & Calibration Record",
  activityType: "CAL",
  scope: "analytical",
  fields: [
    { key: "date",              label: "Date",                                type: "date", required: true },
    { key: "calibrationType",   label: "Calibration Type",                    type: "text", placeholder: "e.g. Multi-point" },
    { key: "standardUsed",      label: "Standard Used",                       type: "text", placeholder: "e.g. NIST-SRM-123" },
    { key: "concentrationRange", label: "Concentration Range",                type: "text", placeholder: "e.g. 1 - 100 µg/L" },
    { key: "calibrationCurve",  label: "Calibration Curve (R²)",              type: "text", placeholder: "e.g. 0.9999" },
    { key: "qcSampleType",      label: "QC Sample Type (Blank/CRM/Duplicate)", type: "text", placeholder: "e.g. CRM" },
    { key: "expectedValue",     label: "Expected Value",                      type: "text", placeholder: "e.g. 10.0 ppm" },
    { key: "measuredValue",     label: "Measured Value",                      type: "text", placeholder: "e.g. 10.2 ppm" },
    { key: "percentRecovery",   label: "% Recovery",                          type: "text", placeholder: "e.g. 102%" },
    { key: "resultStatus",      label: "Result / Status",                     type: "text", placeholder: "e.g. PASS" },
    { key: "analyst",           label: "Performed By",                        type: "text", required: true, placeholder: "Full name" },
    { key: "approvedBy",        label: "Approved By",                         type: "text", placeholder: "Supervisor name" },
    { key: "dueDate",           label: "Due Date",                            type: "date" },
    { key: "remarks",           label: "Remarks",                             type: "textarea", full: true },
  ],
};

export const MAINTENANCE_TROUBLESHOOT: FormDef = {
  id: "maintenance",
  title: "Maintenance & Troubleshooting Record",
  activityType: "MTN",
  scope: "analytical",
  fields: [
    { key: "date",               label: "Date",                                    type: "date", required: true },
    { key: "maintenanceType",    label: "Maintenance Type",                        type: "text", placeholder: "e.g. Preventive / Annual" },
    { key: "problemDescription", label: "Problem Description",                      type: "textarea", full: true },
    { key: "actionTaken",        label: "Action Taken",                            type: "textarea", full: true },
    { key: "downtime",           label: "Downtime",                                type: "text", placeholder: "e.g. 2 h" },
    { key: "analyst",            label: "Performed By / Engineer",                 type: "text", required: true, placeholder: "Full name" },
    { key: "resolvedBy",         label: "Resolved By",                             type: "text", placeholder: "Full name" },
    { key: "dueDate",            label: "Due Date",                                type: "date" },
    { key: "remarks",            label: "Remarks",                                 type: "textarea", full: true },
  ],
};

export const ANALYTICAL_FORMS: FormDef[] = [
  DAILY_OPERATION,
  QUALITY_CALIBRATION,
  MAINTENANCE_TROUBLESHOOT,
];

// ─── Sample-preparation forms ────────────────────────────────────────────────

export const SAMPLE_PREPARATION: FormDef = {
  id: "sampleprep",
  title: "Sample Preparation Record",
  activityType: "PREP",
  scope: "sample",
  fields: [
    { key: "instrumentUsed",    label: "Instrument Used",    type: "text", placeholder: "e.g. ICP-MS" },
    { key: "date",              label: "Date",               type: "date", required: true },
    { key: "sampleId",          label: "Sample ID",          type: "text", required: true, placeholder: "e.g. S-001" },
    { key: "matrix",            label: "Matrix",             type: "text", placeholder: "e.g. Water / Soil" },
    { key: "methodUsed",        label: "Preparation Method", type: "text", placeholder: "e.g. Acid digestion", full: true },
    { key: "reagentsUsed",      label: "Reagents Used",      type: "text", placeholder: "e.g. HNO₃, HCl", full: true },
    { key: "dilutionFactor",    label: "Dilution Factor",    type: "text", placeholder: "e.g. x10" },
    { key: "analyst",           label: "Analyst",            type: "text", required: true, placeholder: "Full name" },
  ],
};

export const REAGENT_STANDARD: FormDef = {
  id: "reagent",
  title: "Reagent & Standard Preparation Log",
  activityType: "REAG",
  scope: "sample",
  fields: [
    { key: "date",              label: "Date",                          type: "date", required: true },
    { key: "reagentName",       label: "Reagent / Standard Name",       type: "text", required: true, placeholder: "e.g. 1M HNO₃" },
    { key: "batchNo",           label: "Batch / Lot / ID No.",          type: "text", placeholder: "e.g. LOT-2026-01" },
    { key: "concentration",     label: "Concentration / Quantity Received", type: "text", placeholder: "e.g. 1 L" },
    { key: "methodUsed",        label: "Preparation Method",            type: "text", full: true },
    { key: "storageCondition",  label: "Storage Condition",             type: "text", placeholder: "e.g. 2-8 °C" },
    { key: "expiryDate",        label: "Expiry Date",                   type: "date" },
    { key: "analyst",           label: "Prepared By",                   type: "text", required: true, placeholder: "Full name" },
    { key: "verifiedBy",        label: "Verified By",                   type: "text", placeholder: "Full name" },
    { key: "remarks",           label: "Remarks",                       type: "textarea", full: true },
  ],
};

export const SAMPLE_FORMS: FormDef[] = [SAMPLE_PREPARATION, REAGENT_STANDARD];

export const INSTRUMENT_INFO_FORM: FormDef = {
  id: "instrument",
  title: "General Information Fields",
  activityType: "INFO",
  scope: "instrument",
  fields: [
    { key: "department",       label: "Department",        type: "text" },
    { key: "desk",             label: "Desk",              type: "text" },
    { key: "laboratoryName",   label: "Laboratory Name",   type: "text" },
    { key: "location",         label: "Location",          type: "text" },
    { key: "instrumentName",   label: "Instrument Name",   type: "text" },
    { key: "instrumentId",     label: "Instrument ID",     type: "text" },
    { key: "instrumentModel",  label: "Instrument Model",  type: "text" },
    { key: "serialNumber",     label: "Serial Number",     type: "text" },
    { key: "manufacturer",     label: "Manufacturer",      type: "text" },
    { key: "installationDate", label: "Installation Date", type: "date" },
    { key: "logbookStartDate", label: "Logbook Start Date", type: "date" },
    { key: "logbookEndDate",   label: "Logbook End Date",   type: "date" },
    { key: "respAnalyst1Name", label: "Responsible Analyst 1 (Name)", type: "text" },
    { key: "respAnalyst1Sig", label: "Responsible Analyst 1 (Signature Initials/Date)", type: "text" },
    { key: "respAnalyst2Name", label: "Responsible Analyst 2 (Name)", type: "text" },
    { key: "respAnalyst2Sig", label: "Responsible Analyst 2 (Signature Initials/Date)", type: "text" },
    { key: "respAnalyst3Name", label: "Responsible Analyst 3 (Name)", type: "text" },
    { key: "respAnalyst3Sig", label: "Responsible Analyst 3 (Signature Initials/Date)", type: "text" },
    { key: "preparedByName", label: "Prepared By (Name)", type: "text" },
    { key: "preparedBySig", label: "Prepared By (Signature Initials/Date)", type: "text" },
    { key: "approvedByName", label: "Approved By (Name)", type: "text" },
    { key: "approvedBySig", label: "Approved By (Signature Initials/Date)", type: "text" },
  ],
};

export const ALL_FORMS: FormDef[] = [...ANALYTICAL_FORMS, ...SAMPLE_FORMS, INSTRUMENT_INFO_FORM];

export function formByActivityType(activityType: string): FormDef | undefined {
  return ALL_FORMS.find((f) => f.activityType === activityType);
}
