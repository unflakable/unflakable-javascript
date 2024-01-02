// Copyright (c) 2023-2024 Developer Innovations, LLC

// Reporter stats from running a single spec.
export type ReporterStats = Mocha.Stats & {
  quarantinedFailures?: number;
  quarantinedFlakes?: number;
  unquarantinedFlakes?: number;
  quarantinedPending?: number;
  unquarantinedPending?: number;
  quarantinedSkipped?: number;
  unquarantinedSkipped?: number;
};

// Aggregated reporter stats across all specs.
export type TotalReporterStats = {
  failedTests: number;
  failedOrFlakySpecs: number;
  flakyTests: number;
  passedTests: number;
  quarantinedPending: number;
  unquarantinedPending: number;
  quarantinedTests: number;
  quarantinedSkipped: number;
  unquarantinedSkipped: number;
};

// On certain spec errors (e.g., if webpack compilation fails for component tests), reporterStats
// will be `null`. In that case, we just populate the reporter stats from Cypress's stats.
export const reporterStatsOrDefault = (
  results: CypressCommandLine.RunResult
): ReporterStats =>
  results.reporterStats !== null
    ? (results.reporterStats as ReporterStats)
    : {
        suites: results.stats.suites,
        tests: results.stats.tests,
        passes: results.stats.passes,
        pending: results.stats.pending,
        failures: results.stats.failures,
      };

export const aggregateRunStats = (
  runs: CypressCommandLine.RunResult[]
): TotalReporterStats =>
  runs.reduce(
    (
      totals: TotalReporterStats,
      run: CypressCommandLine.RunResult
    ): TotalReporterStats => {
      const reporterStats = reporterStatsOrDefault(run);
      return {
        failedTests: totals.failedTests + reporterStats.failures,
        failedOrFlakySpecs:
          totals.failedOrFlakySpecs +
          (reporterStats.failures +
            (reporterStats.unquarantinedFlakes ?? 0) +
            (reporterStats.unquarantinedSkipped ?? 0) >
          0
            ? 1
            : 0),
        flakyTests:
          totals.flakyTests + (reporterStats.unquarantinedFlakes ?? 0),
        passedTests: totals.passedTests + reporterStats.passes,
        quarantinedPending:
          totals.quarantinedPending + (reporterStats.quarantinedPending ?? 0),
        unquarantinedPending:
          totals.unquarantinedPending +
          (reporterStats.unquarantinedPending ?? 0),
        quarantinedTests:
          totals.quarantinedTests +
          (reporterStats.quarantinedFailures ?? 0) +
          (reporterStats.quarantinedFlakes ?? 0),
        quarantinedSkipped:
          totals.quarantinedSkipped + (reporterStats.quarantinedSkipped ?? 0),
        unquarantinedSkipped:
          totals.unquarantinedSkipped +
          (reporterStats.unquarantinedSkipped ?? 0),
      };
    },
    {
      failedTests: 0,
      failedOrFlakySpecs: 0,
      flakyTests: 0,
      quarantinedPending: 0,
      unquarantinedPending: 0,
      quarantinedTests: 0,
      passedTests: 0,
      quarantinedSkipped: 0,
      unquarantinedSkipped: 0,
    }
  );
