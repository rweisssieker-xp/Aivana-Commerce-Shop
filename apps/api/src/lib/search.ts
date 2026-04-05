import { prisma } from "../lib/prisma.js";

export interface SearchCitation {
  type: "product";
  productId: string;
  variantIds: string[];
  title: string;
  snippet: string;
  matchedOn: "name" | "description" | "keyword_fallback";
}

export interface SearchResponse {
  query: string;
  mode: "keyword_fallback" | "semantic";
  results: Array<{
    productId: string;
    title: string;
    score: number;
    citations: SearchCitation[];
  }>;
}

export async function searchProducts(tenantId: string, query: string): Promise<SearchResponse> {
  const q = query.trim();
  if (q.length === 0) {
    return { query: q, mode: "keyword_fallback", results: [] };
  }

  const products = await prisma.product.findMany({
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

  const results = products.map((p, index) => {
    const nameHit = p.name.toLowerCase().includes(q.toLowerCase());
    const descHit = (p.description ?? "").toLowerCase().includes(q.toLowerCase());
    const matchedOn: SearchCitation["matchedOn"] = nameHit
      ? "name"
      : descHit
        ? "description"
        : "keyword_fallback";
    const snippet =
      (p.description && p.description.length > 0 ? p.description : p.name).slice(0, 240) +
      ((p.description?.length ?? 0) > 240 ? "…" : "");

    const citation: SearchCitation = {
      type: "product",
      productId: p.id,
      variantIds: p.variants.map((v) => v.id),
      title: p.name,
      snippet,
      matchedOn,
    };

    return {
      productId: p.id,
      title: p.name,
      score: Math.max(0, 1 - index * 0.01),
      citations: [citation],
    };
  });

  return { query: q, mode: "keyword_fallback", results };
}
