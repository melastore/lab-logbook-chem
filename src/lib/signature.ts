export type AnalystSignaturePayload = {
  version: 1;
  typed: string;
  image: string;
  signedAt: string;
  signedBy: string;
  username: string;
};

const prefix = "sig:v1:";

export function encodeAnalystSignature(input: Omit<AnalystSignaturePayload, "version">) {
  return `${prefix}${JSON.stringify({ version: 1, ...input })}`;
}

export function parseAnalystSignature(value: string): AnalystSignaturePayload {
  if (!value.startsWith(prefix)) {
    return {
      version: 1,
      typed: value,
      image: "",
      signedAt: "",
      signedBy: "",
      username: "",
    };
  }

  try {
    const parsed = JSON.parse(value.slice(prefix.length)) as Partial<AnalystSignaturePayload>;
    return {
      version: 1,
      typed: typeof parsed.typed === "string" ? parsed.typed : "",
      image: typeof parsed.image === "string" ? parsed.image : "",
      signedAt: typeof parsed.signedAt === "string" ? parsed.signedAt : "",
      signedBy: typeof parsed.signedBy === "string" ? parsed.signedBy : "",
      username: typeof parsed.username === "string" ? parsed.username : "",
    };
  } catch {
    return {
      version: 1,
      typed: value,
      image: "",
      signedAt: "",
      signedBy: "",
      username: "",
    };
  }
}

export function signatureSummary(value: string) {
  const signature = parseAnalystSignature(value);
  if (signature.image) return "Drawn signature";
  return signature.typed || "Not signed";
}
