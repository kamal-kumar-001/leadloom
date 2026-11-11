// The old AIResearcherService was removed: it returned a fixed 0.88 confidence
// and templated claims regardless of input. G4 surfaces only honest heuristics
// until a BYOK LLM path with per-claim provenance exists.
export * from './website-signals.service';
