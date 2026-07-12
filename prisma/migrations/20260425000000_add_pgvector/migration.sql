-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add a dedicated vector column for embeddings
ALTER TABLE "KnowledgeEntry" ADD COLUMN IF NOT EXISTS embedding_vector vector(1536);

-- Create an IVFFlat index for approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_knowledge_entry_embedding 
  ON "KnowledgeEntry" 
  USING ivfflat (embedding_vector vector_cosine_ops) 
  WITH (lists = 100);