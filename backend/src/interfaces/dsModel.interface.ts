// TBD: Implementation depends on DS team delivery.
// Required before GET /jobs/:id/core-skills can use the real model.
// Current implementation: mock in src/services/dsModel.ts (title-keyed hardcoded skills).
// Production replacement: vector DB lookup via normalizedTitle semantic similarity.
//
// TBD: Transport - HTTP REST, gRPC, or SDK import
// TBD: Retry policy - suggest 2 retries, 10s timeout
// TBD: Full response contract with DS team

export interface ICoreSkillsProvider {
  /**
   * Returns exactly 5 canonical core skills for a given job.
   * Output must be deterministic for the same normalizedTitle.
   *
   * @param normalizedTitle  Stable job identifier (e.g. "software-engineer")
   * @returns string[5]      Ordered, deduplicated core skills
   * @throws DsModelError    On model unavailability, timeout, or malformed response
   */
  getCoreSkills(normalizedTitle: string): Promise<string[]>;
}
