# Visual Context Resolution Service

> **ACE WhatsApp — Core Microservice #9**  
> Stack: **Rust + Python**  
> Role: Resolves deictic references ("that blue dress in your reel") to specific SKUs

## Responsibility

Enables customers to reference merchant's social media posts without being precise. The AI understands "that one" and resolves it to a specific SKU using visual AI and vector search.

## Key Functions

### Social Media Scraping Daemon
- Continuous background scraper for merchant's Instagram, Facebook, TikTok (future)
- Triggered on new merchant posts (webhook-based where available, polling fallback)
- Downloads all media: images, video frames (extracted at 1 fps), carousel slides

### Visual Embedding Pipeline
- Runs CLIP / ViT models on all media frames
- Generates semantic vector embeddings per product visible in each post
- Stores embeddings in Qdrant with metadata: `{merchant_id, post_id, timestamp, platform}`

### Deictic Reference Resolution
- Receives query from Intent Parser: `{reference: "blue dress in your last reel", merchant_id: "..."}`
- Translates query to CLIP embedding
- Searches Qdrant: finds nearest-neighbour product embeddings for this merchant
- Returns: matched `SKU`, confidence score, product image URL

### SKU→Catalog Lookup
- Cross-references resolved SKU with merchant's inventory (via PostgreSQL)
- Returns: price, stock level, variants available

## Example Resolution

```
Customer: "How much for the blue dress in your last reel?"

Visual Context Service:
  1. Identifies deictic reference: "last reel" + "blue dress"
  2. Retrieves merchant's latest Instagram Reel (posted 14 hrs ago)
  3. Extracts frames → CLIP embeddings
  4. Searches for blue garments in vector DB
  5. Matches: SKU = "BLUE-SATIN-MIDI-DRESS" (0.97 confidence)
  
Intent Parser receives: product resolved → price negotiation proceeds autonomously
```

## Status

`[ ] Not started — placeholder`
