export type InMemoryValue = {
  value: string;
  expiresAt?: number;
};

export type ZSetEntry = { score: number; member: string };
