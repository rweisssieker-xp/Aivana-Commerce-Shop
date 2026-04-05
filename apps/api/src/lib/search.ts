import { prisma } from "./prisma.js";
import { cosineSimilarity, embedOpenAIText, jsonToFloatArray } from "./embeddings.js";

export interface SearchCitation {
  type: "product";
  productId: string;
  variantIds: string[];
  title: string;
  snippet: string;
  matchedOn: "name" | "description" | "keyword_fallback" | "semantic";
}

export interface SearchResponse {
  query: string;
  mode: "keyword_fallback" | "semantic" | "hybrid";
  results: Array<{
    productId: string;
    title: string;
    score: number;
    citations: SearchCitation[];
  }>;
}

function buildCitation(
  p: { id: string; name: string; description: string | null; variants: { id: string }[] },
  matchedOn: SearchCitation["matchedOn"],
  q: string
): SearchCitation {
  const snippetBase = p.description && p.description.length > 0 ? p.description : p.name;
  const snippet = snippetBase.slice(0, 240) + (snippetBase.length > 240 ? "…" : "");
  return {
    type: "product",
    productId: p.id,
    variantIds: p.variants.map((v) => v.id),
    title: p.name,
    snippet,
    matchedOn,
  };
}

export async function searchProducts(tenantId: string, query: string): Promise<SearchResponse> {
  const q = query.trim();
  if (q.length === 0) {
    return { query: q, mode: "keyword_fallback", results: [] };
  }

  const keywordProducts = await prisma.product.findMany({
    where: {
      tenantId,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    },
    include: { variants: true },
    take: 25,
  });

  const keywordResults = keywordProducts.map((p, index) => {
    const nameHit = p.name.toLowerCase().includes(q.toLowerCase());
    const descHit = (p.description ?? "").toLowerCase().includes(q.toLowerCase());
    const matchedOn: SearchCitation["matchedOn"] = nameHit
      ? "name"
      : descHit
        ? "description"
        : "keyword_fallback";
    return {
      productId: p.id,
      title: p.name,
      score: Math.max(0, 1 - index * 0.01),
      citations: [buildCitation(p, matchedOn, q)],
    };
  });

  if (!process.env.OPENAI_API_KEY) {
    return { query: q, mode: "keyword_fallback", results: keywordResults };
  }

  try {
    const queryVec = await embedOpenAIText(q);
    const embeddings = await prisma.productEmbedding.findMany({
      where: { tenantId },
      take: 500,
      include: {
        product: { include: { variants: true } },
      },
    });

    const semanticScored: Array<{ productId: string; title: string; score: number; citations: SearchCitation[] }> = [];
    for (const row of embeddings) {
      const vec = jsonToFloatArray(row.values);
      if (!vec || vec.length !== queryVec.length) {
        continue;
      }
      const sim = cosineSimilarity(queryVec, vec);
      if (sim < 0.15) {
        continue;
      }
      const p = row.product;
      semanticScored.push({
        productId: p.id,
        title: p.name,
        score: sim,
        citations: [buildCitation(p, "semantic", q)],
      });
    }
    semanticScored.sort((a, b) => b.score - a.score);
    const topSemantic = semanticScored.slice(0, 25);

    const merged = new Map<string, (typeof keywordResults)[0]>();
    for (const r of keywordResults) {
      merged.set(r.productId, r);
    }
    for (const r of topSemantic) {
      const existing = merged.get(r.productId);
      if (!existing || r.score > existing.score) {
        merged.set(r.productId, r);
      }
    }
    const hybrid = [...merged.values()].sort((a, b) => b.score - a.score).slice(0, 25);
    return { query: q, mode: "hybrid", results: hybrid };
  } catch {
    return { query: q, mode: "keyword_fallback", results: keywordResults };
  }
}
