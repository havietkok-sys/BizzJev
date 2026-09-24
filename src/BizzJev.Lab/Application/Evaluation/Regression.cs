namespace BizzJev.Lab.Application.Evaluation;

public static class Regression
{
    // A case "passed" under a run when every labeled gate's expectation matches the policy YES/NO
    // (UNCLEAR labels never count as pass or fail).
    public static bool CasePassed(CaseRun run, string gateId, string expected)
    {
        var decision = run.Policy.FirstOrDefault(p => p.GateId == gateId);
        if (decision is null) return false;
        return expected == "YES" ? decision.Result == PolicyResult.Yes : decision.Result == PolicyResult.No;
    }

    public static bool CasePassedAll(CaseRun run) =>
        run.Expected.Where(e => e.Label is "YES" or "NO").All(e => CasePassed(run, e.GateId, e.Label));

    public static RegressionComparison Compare(
        string from, string to,
        IReadOnlyList<CaseRun> beforeRuns, IReadOnlyList<CaseRun> afterRuns,
        IReadOnlyCollection<string> gateIds)
    {
        var before = beforeRuns.ToDictionary(r => r.CaseId);
        var fixedCases = new List<string>();
        var broken = new List<string>();
        var unchanged = new List<string>();
        foreach (var after in afterRuns)
        {
            if (!before.TryGetValue(after.CaseId, out var beforeRun)) continue;
            var b = CasePassedAll(beforeRun);
            var a = CasePassedAll(after);
            if (a && !b) fixedCases.Add(after.CaseId);
            else if (!a && b) broken.Add(after.CaseId);
            else unchanged.Add(after.CaseId);
        }
        return new RegressionComparison
        {
            FromVersion = from, ToVersion = to,
            Fixed = fixedCases, Broken = broken, Unchanged = unchanged,
            Before = Metrics.Compute(beforeRuns, gateIds),
            After = Metrics.Compute(afterRuns, gateIds)
        };
    }
}
