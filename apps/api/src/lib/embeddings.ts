/**
 * OpenAI text-embedding-3-small (1536 dimensions by default).
 */
export async function embedOpenAIText(text: string): Promise<number[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.length === 0) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  const body = {
    model: "text-embedding-3-small",
    input: text.slice(0, 8000),
  };
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI embeddings failed: ${res.status} ${t}`);
  }
  const json = (await res.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const emb = json.data?.[0]?.embedding;
  if (!emb || emb.length === 0) {
    throw new Error("OpenAI returned no embedding");
  }
  return emb;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i] as number;
    const bv = b[i] as number;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}

export function jsonToFloatArray(values: unknown): number[] | null {
  if (!Array.isArray(values)) {
    return null;
  }
  const out: number[] = [];
  for (const v of values) {
    if (typeof v !== "number" || Number.isNaN(v)) {
      return null;
    }
    out.push(v);
  }
  return out;
}
