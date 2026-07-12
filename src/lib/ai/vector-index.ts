/**
 * Vector Index Service
 *
 * Batch indexer and query service using pgvector for efficient
 * vector similarity search on KnowledgeEntry embeddings.
 *
 * Uses the dedicated embedding_vector column (vector(1536)) for
 * database-level cosine similarity, with fallback to in-memory
 * computation for entries that only have metadata.embedding.
 *
 * Prerequisites:
 *   - pgvector extension installed (run the migration first)
 *   - OpenAI API key stored in Settings.aiApiKey
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface SearchResult {
  id: string;
  title: string;
  content: string;
  category: string;
  score: number;
}

/**
 * Generate an embedding vector for the given text using OpenAI.
 * Truncates to 8000 characters to stay within token limits.
 */
async function generateEmbedding(
  text: string,
  apiKey: string
): Promise<number[] | null> {
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.substring(0, 8000),
      }),
    });

    if (!response.ok) {
      logger.error(
        `OpenAI embedding API returned ${response.status}: ${response.statusText}`
      );
      return null;
    }

    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch (error) {
    logger.error("Failed to generate embedding:", error);
    return null;
  }
}

/**
 * Calculate cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Format a number array into a pgvector-compatible SQL string literal.
 * Example: '[0.001, 0.002, ...]'
 */
function formatVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

/**
 * Index all KnowledgeEntry records that are missing an embedding.
 *
 * For each entry without metadata.embedding:
 *   1. Generates an embedding using the OpenAI API.
 *   2. Stores it in both metadata.embedding (JSON) and
 *      embedding_vector (pgvector column).
 *
 * Returns the number of entries successfully indexed.
 */
export async function indexAllEntries(apiKey: string): Promise<number> {
  const entries = await prisma.knowledgeEntry.findMany({
    where: {
      isActive: true,
    },
  });

  const pendingEntries = entries.filter((entry: any) => {
    const metadata = (entry.metadata as Record<string, unknown> | null) ?? {};
    return !metadata.embedding;
  });

  if (pendingEntries.length === 0) {
    logger.info("No entries require indexing — all have embeddings.");
    return 0;
  }

  logger.info(`Found ${pendingEntries.length} entries to index.`);

  let indexedCount = 0;

  for (const entry of pendingEntries) {
    try {
      const text = `${entry.title}\n${entry.content}`;
      const embedding = await generateEmbedding(text, apiKey);

      if (!embedding) {
        logger.warn(`Failed to generate embedding for entry ${entry.id}`);
        continue;
      }

      const currentMetadata = (entry.metadata as Record<string, unknown>) || {};

      // Update both the JSON metadata field and the pgvector column
      await prisma.$executeRawUnsafe(
        `UPDATE "KnowledgeEntry"
         SET metadata = $1::jsonb,
             embedding_vector = $2::vector
         WHERE id = $3`,
        JSON.stringify({ ...currentMetadata, embedding }),
        formatVectorLiteral(embedding),
        entry.id
      );

      indexedCount++;
      logger.debug(`Indexed entry ${entry.id} (${indexedCount}/${entries.length})`);
    } catch (error) {
      logger.error(`Error indexing entry ${entry.id}:`, error);
    }
  }

  logger.info(`Indexing complete: ${indexedCount}/${pendingEntries.length} entries processed.`);
  return indexedCount;
}

/**
 * Re-index ALL KnowledgeEntry records regardless of existing embeddings.
 *
 * This is useful after changing the embedding model or when you want
 * to refresh all vectors.
 */
export async function batchReindex(apiKey: string): Promise<number> {
  const entries = await prisma.knowledgeEntry.findMany();

  if (entries.length === 0) {
    logger.info("No entries to re-index.");
    return 0;
  }

  logger.info(`Re-indexing all ${entries.length} entries…`);

  let indexedCount = 0;

  for (const entry of entries) {
    try {
      const text = `${entry.title}\n${entry.content}`;
      const embedding = await generateEmbedding(text, apiKey);

      if (!embedding) {
        logger.warn(`Failed to generate embedding for entry ${entry.id}`);
        continue;
      }

      const currentMetadata = (entry.metadata as Record<string, unknown>) || {};

      await prisma.$executeRawUnsafe(
        `UPDATE "KnowledgeEntry"
         SET metadata = $1::jsonb,
             embedding_vector = $2::vector
         WHERE id = $3`,
        JSON.stringify({ ...currentMetadata, embedding }),
        formatVectorLiteral(embedding),
        entry.id
      );

      indexedCount++;
    } catch (error) {
      logger.error(`Error re-indexing entry ${entry.id}:`, error);
    }
  }

  logger.info(`Re-indexing complete: ${indexedCount}/${entries.length} entries processed.`);
  return indexedCount;
}

/**
 * Run a similarity search against the knowledge base using pgvector.
 *
 * Prioritises the dedicated embedding_vector column (database-level
 * vector search) but falls back to in-memory cosine similarity on
 * metadata.embedding for entries that were never migrated.
 *
 * @param query - The natural-language search query.
 * @param limit  - Maximum number of results to return (default 10).
 * @returns      - Ranked results with similarity scores.
 */
export async function runSimilaritySearch(
  query: string,
  limit = 10
): Promise<SearchResult[]> {
  const settings = await prisma.settings.findFirst({
    select: { aiApiKey: true },
  });

  if (!settings?.aiApiKey) {
    logger.warn("No AI API key configured — cannot perform vector search.");
    return [];
  }

  const queryEmbedding = await generateEmbedding(query, settings.aiApiKey);

  if (!queryEmbedding) {
    logger.error("Failed to generate query embedding.");
    return [];
  }

  const queryVector = formatVectorLiteral(queryEmbedding);
  let results: SearchResult[] = [];

  try {
    const rows = await (prisma as any).$queryRawUnsafe(
      `SELECT
         e.id,
         e.title,
         e.content,
         c.name AS category_name,
         1 - (e.embedding_vector <=> $1::vector) AS score
       FROM "KnowledgeEntry" e
       INNER JOIN "Category" c ON c.id = e."categoryId"
       WHERE e."isActive" = true
         AND e.embedding_vector IS NOT NULL
       ORDER BY e.embedding_vector <=> $1::vector
       LIMIT $2`,
      queryVector,
      limit
    );

    results = rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      category: row.category_name,
      score: row.score,
    }));
  } catch (error) {
    logger.warn(
      "pgvector query failed, falling back to in-memory similarity:",
      error
    );
  }

  if (results.length < limit) {
    try {
      const additionalEntries = await prisma.knowledgeEntry.findMany({
        where: {
          isActive: true,
          embedding_vector: null,
        },
        include: {
          category: { select: { name: true } },
        },
        take: limit - results.length,
      });

      const existingIds = new Set(results.map((r: SearchResult) => r.id));

      for (const entry of additionalEntries) {
        if (existingIds.has(entry.id)) continue;

        const metadata = (entry.metadata as Record<string, unknown> | null) ?? {};
        const entryEmbedding = (metadata as Record<string, unknown>).embedding as number[] | null;

        if (entryEmbedding) {
          const score = cosineSimilarity(queryEmbedding, entryEmbedding);

          if (score > 0.1) {
            results.push({
              id: entry.id,
              title: entry.title,
              content: entry.content,
              category: entry.category.name,
              score,
            });
          }
        }
      }

      results.sort((a: SearchResult, b: SearchResult) => b.score - a.score);
      results = results.slice(0, limit);
    } catch (error) {
      logger.error("Fallback similarity search failed:", error);
    }
  }

  if (results.length === 0) {
    logger.info("No vector results — falling back to metadata-based search.");

    try {
      const allEntries = await prisma.knowledgeEntry.findMany({
        where: { isActive: true },
        include: { category: { select: { name: true } } },
      });

      for (const entry of allEntries) {
        const metadata = (entry.metadata as Record<string, unknown> | null) ?? {};
        const entryEmbedding = (metadata as Record<string, unknown>).embedding as number[] | null;

        if (entryEmbedding) {
          const score = cosineSimilarity(queryEmbedding, entryEmbedding);
          if (score > 0.1) {
            results.push({
              id: entry.id,
              title: entry.title,
              content: entry.content,
              category: entry.category.name,
              score,
            });
          }
        }
      }

      results.sort((a: SearchResult, b: SearchResult) => b.score - a.score);
      results = results.slice(0, limit);
    } catch (error) {
      logger.error("Metadata fallback search failed:", error);
    }
  }

  return results;
}