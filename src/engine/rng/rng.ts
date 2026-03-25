export type Rng = {
  seed: number;
  nextU32: () => number;
  nextFloat01: () => number;
  int: (minInclusive: number, maxInclusive: number) => number;
};

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return (x ^ (x >>> 14)) >>> 0;
  };
}

export function createRng(seed: number): Rng {
  const nextU32 = mulberry32(seed);

  return {
    seed,
    nextU32: () => nextU32(),
    nextFloat01: () => nextU32() / 4294967296,
    int: (minInclusive, maxInclusive) => {
      const span = maxInclusive - minInclusive + 1;
      return minInclusive + (nextU32() % span);
    },
  };
}
