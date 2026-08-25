-- infra/migrations/007_visual_search.sql

-- Enable the pgvector extension if it's not already enabled (Neon supports this natively)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding columns to the products table
-- We use 512 dimensions because the Xenova/clip-vit-base-patch32 model outputs 512-dim vectors
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_embedding vector(512);

-- Create an HNSW index for ultra-fast similarity search on the image embedding
-- vector_cosine_ops is best suited for CLIP embeddings since they are normalized
CREATE INDEX IF NOT EXISTS products_image_embedding_idx ON products USING hnsw (image_embedding vector_cosine_ops);
