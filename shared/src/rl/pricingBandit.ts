import { redis } from '../clients.js';
import { logger } from '../logger.js';
import type { CustomerTier, Dialect } from '../types.js';

export const BANDIT_ARMS = [0.0, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30] as const;
export type BanditArm = typeof BANDIT_ARMS[number];

export const VECTOR_DIMENSION = 6;

export interface BanditContextInput {
  customerLtv?: number;
  orderCount?: number;
  daysSinceLastOrder?: number;
  productMargin?: number;
  basePrice?: number;
  dialect?: Dialect | string;
  timeOfDayHour?: number;
}

export interface BanditArmSelection {
  arm: BanditArm;
  proposedDiscount: number;
  proposedPrice: number;
  ucbScore: number;
  contextVector: number[];
  eligibleArms: BanditArm[];
}

/**
 * Robust 6x6 Matrix inversion using Gauss-Jordan elimination with partial pivoting.
 */
export function invertMatrix(A: number[][]): number[][] {
  const n = A.length;
  // Deep clone and augment with identity matrix
  const M: number[][] = A.map((row, i) => {
    const aug = new Array(2 * n).fill(0);
    for (let j = 0; j < n; j++) aug[j] = row[j];
    aug[n + i] = 1;
    return aug;
  });

  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
        maxRow = k;
      }
    }
    const temp = M[i];
    M[i] = M[maxRow];
    M[maxRow] = temp;

    const pivot = M[i][i];
    // Regularization epsilon to avoid singular breakdown
    const denom = Math.abs(pivot) < 1e-7 ? (pivot < 0 ? -1e-7 : 1e-7) : pivot;

    for (let j = 0; j < 2 * n; j++) {
      M[i][j] /= denom;
    }

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = M[k][i];
        for (let j = 0; j < 2 * n; j++) {
          M[k][j] -= factor * M[i][j];
        }
      }
    }
  }

  // Extract inverted matrix from right half
  return M.map(row => row.slice(n, 2 * n));
}

/**
 * Vector dot product.
 */
function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/**
 * Matrix-vector product: M * v.
 */
function matrixVectorProduct(M: number[][], v: number[]): number[] {
  return M.map(row => dotProduct(row, v));
}

/**
 * Quadratic form: x^T * M * x.
 */
function quadraticForm(M: number[][], x: number[]): number {
  const Mx = matrixVectorProduct(M, x);
  return dotProduct(x, Mx);
}

/**
 * Identity matrix generator.
 */
function identityMatrix(size: number): number[][] {
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => (i === j ? 1.0 : 0.0))
  );
}

export class PricingBanditEngine {
  private static instance: PricingBanditEngine;
  private alpha: number = 0.4; // Exploration parameter
  private memoryA: Map<number, number[][]> = new Map();
  private memoryB: Map<number, number[]> = new Map();

  private constructor() {
    // Initialize in-memory matrices
    for (const arm of BANDIT_ARMS) {
      this.memoryA.set(arm, identityMatrix(VECTOR_DIMENSION));
      this.memoryB.set(arm, new Array(VECTOR_DIMENSION).fill(0.0));
    }
  }

  public static getInstance(): PricingBanditEngine {
    if (!PricingBanditEngine.instance) {
      PricingBanditEngine.instance = new PricingBanditEngine();
    }
    return PricingBanditEngine.instance;
  }

  /**
   * Constructs the normalized 6-dimensional context vector:
   * x = [LTV percentile, order recency, product margin, order value bucket, dialect encoding, time of day]
   */
  public buildContextVector(input: BanditContextInput): number[] {
    const ltv = input.customerLtv || 0;
    const ltvNorm = Math.min(ltv / 150_000, 1.0);

    const days = input.daysSinceLastOrder !== undefined ? input.daysSinceLastOrder : 15;
    const recencyNorm = Math.min(days / 60, 1.0);

    const margin = input.productMargin !== undefined ? input.productMargin : 0.35;
    const marginNorm = Math.max(0.05, Math.min(margin, 0.95));

    const price = input.basePrice || 25_000;
    const valueBucketNorm = Math.min(price / 100_000, 1.0);

    const dialectMap: Record<string, number> = {
      pidgin: 0.2,
      yoruba: 0.4,
      igbo: 0.6,
      hausa: 0.8,
      english: 1.0,
    };
    const dialectNorm = dialectMap[String(input.dialect || 'pidgin').toLowerCase()] || 0.2;

    const hour = input.timeOfDayHour !== undefined ? input.timeOfDayHour : new Date().getHours();
    const timeNorm = Math.min(hour / 24.0, 1.0);

    return [ltvNorm, recencyNorm, marginNorm, valueBucketNorm, dialectNorm, timeNorm];
  }

  /**
   * Load state for a specific arm from Redis with fast in-memory fallback.
   */
  private async loadArmState(arm: BanditArm): Promise<{ A: number[][]; b: number[] }> {
    const armKey = Math.round(arm * 100);
    const keyA = `bandit:pricing:arm:${armKey}:A`;
    const keyB = `bandit:pricing:arm:${armKey}:b`;

    try {
      const [rawA, rawB] = await Promise.all([redis.get(keyA), redis.get(keyB)]);
      if (rawA && rawB) {
        const A = JSON.parse(rawA);
        const b = JSON.parse(rawB);
        this.memoryA.set(arm, A);
        this.memoryB.set(arm, b);
        return { A, b };
      }
    } catch (err) {
      logger.warn(`[Bandit] Redis state load failed for arm ${arm}, using memory:`, err);
    }

    return {
      A: this.memoryA.get(arm) || identityMatrix(VECTOR_DIMENSION),
      b: this.memoryB.get(arm) || new Array(VECTOR_DIMENSION).fill(0.0),
    };
  }

  /**
   * Propose optimal discount level within the Authorized Price Range circuit breaker.
   * GUARANTEE: Never proposes a discount that breaches range.floor.
   */
  public async selectDiscount(
    range: { anchor: number; floor: number; maxDiscount: number },
    input: BanditContextInput
  ): Promise<BanditArmSelection> {
    const x = this.buildContextVector(input);

    // 1. Filter strictly eligible arms where price >= range.floor and discount <= maxDiscount
    const eligibleArms = BANDIT_ARMS.filter((arm) => {
      if (arm > range.maxDiscount + 1e-4) return false;
      const resultingPrice = range.anchor * (1 - arm);
      return resultingPrice >= range.floor - 0.5; // Epsilon for rounding
    });

    const activeEligible = eligibleArms.length > 0 ? eligibleArms : [0.0 as BanditArm];

    let bestArm: BanditArm = activeEligible[0];
    let highestScore = -Infinity;

    // 2. Compute LinUCB score for each eligible arm
    for (const arm of activeEligible) {
      const { A, b } = await this.loadArmState(arm);
      const AInv = invertMatrix(A);
      const theta = matrixVectorProduct(AInv, b);

      const meanExpected = dotProduct(x, theta);
      const variance = Math.max(0, quadraticForm(AInv, x));
      const ucbBonus = this.alpha * Math.sqrt(variance);

      const score = meanExpected + ucbBonus;

      if (score > highestScore) {
        highestScore = score;
        bestArm = arm;
      }
    }

    const proposedPrice = Math.round(range.anchor * (1 - bestArm));

    return {
      arm: bestArm,
      proposedDiscount: bestArm,
      proposedPrice,
      ucbScore: highestScore,
      contextVector: x,
      eligibleArms: activeEligible,
    };
  }

  /**
   * Update the bandit model with the realized reward.
   * r = 1{order_completed} * margin_realized - lambda * 1{merchant_override}
   */
  public async recordFeedback(arm: BanditArm, x: number[], reward: number): Promise<void> {
    const armKey = Math.round(arm * 100);
    const keyA = `bandit:pricing:arm:${armKey}:A`;
    const keyB = `bandit:pricing:arm:${armKey}:b`;

    const { A, b } = await this.loadArmState(arm);

    // A <- A + x * x^T
    for (let i = 0; i < VECTOR_DIMENSION; i++) {
      for (let j = 0; j < VECTOR_DIMENSION; j++) {
        A[i][j] += x[i] * x[j];
      }
    }

    // b <- b + r * x
    for (let i = 0; i < VECTOR_DIMENSION; i++) {
      b[i] += reward * x[i];
    }

    this.memoryA.set(arm, A);
    this.memoryB.set(arm, b);

    try {
      await Promise.all([
        redis.set(keyA, JSON.stringify(A)),
        redis.set(keyB, JSON.stringify(b)),
      ]);
      logger.info(`[Bandit] 🎯 Updated Arm ${arm * 100}% with reward ${reward.toFixed(2)}`);
    } catch (err) {
      logger.error(`[Bandit] Failed to save updated bandit weights to Redis:`, err);
    }
  }
}

export const pricingBandit = PricingBanditEngine.getInstance();
