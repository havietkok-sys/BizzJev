namespace BizzJev.Lab.Application.Evaluation;

public static class Metrics
{
    private static double? SafeDiv(double a, double b) => b == 0 ? null : a / b;

    private static double? ComputeF1(double? precision, double? recall)
    {
        if (precision is not double p || recall is not double r || p + r == 0) return null;
        return Math.Round(2 * p * r / (p + r), 3);
    }
    private static double? Median(List<double> xs) => xs.Count == 0 ? null : xs.OrderBy(x => x).ToList()[xs.Count / 2];

    public static List<GateMetric> Compute(IEnumerable<CaseRun> runs, IReadOnlyCollection<string> gateIds)
    {
        var result = new List<GateMetric>();
        foreach (var gateId in gateIds)
        {
            int tp = 0, fp = 0, fn = 0, tn = 0, unclear = 0;
            var yesProbs = new List<double>();
            var noProbs = new List<double>();
            foreach (var run in runs)
            {
                var expected = run.Expected.FirstOrDefault(e => e.GateId == gateId)?.Label;
                var signal = run.Signals.FirstOrDefault(s => s.GateId == gateId);
                if (expected is null or "UNCLEAR") { if (expected == "UNCLEAR") unclear++; continue; }
                if (signal?.Success != true) continue;
                var predictedYes = (run.Policy.First(p => p.GateId == gateId).Result) == PolicyResult.Yes;
                if (predictedYes) yesProbs.Add(signal.Probability!.Value); else noProbs.Add(signal.Probability!.Value);
                if (expected == "YES") { if (predictedYes) tp++; else fn++; }
                else { if (predictedYes) fp++; else tn++; }
            }
            var precision = SafeDiv(tp, tp + fp);
            var recall = SafeDiv(tp, tp + fn);
            result.Add(new GateMetric
            {
                GateId = gateId, Tp = tp, Fp = fp, Fn = fn, Tn = tn, Unclear = unclear,
                Precision = precision is null ? null : Math.Round(precision.Value, 3),
                Recall = recall is null ? null : Math.Round(recall.Value, 3),
                F1 = ComputeF1(precision, recall),
                YesMedianProbability = Median(yesProbs) is double y ? Math.Round(y, 3) : null,
                NoMedianProbability = Median(noProbs) is double n ? Math.Round(n, 3) : null
            });
        }
        return result;
    }

    public static string? WeakestRoutingGate(IReadOnlyList<GateMetric> metrics, IReadOnlyDictionary<string, SemanticGateDefinition> gates)
    {
        var routing = metrics.Where(m => gates.TryGetValue(m.GateId, out var g) && g.Category == "routing").ToList();
        return routing.Count == 0 ? null
            : routing.MinBy(m => m.F1 ?? double.NegativeInfinity)!.GateId;
    }

    public static IReadOnlyList<CaseTypeMetric> ByCaseType(IReadOnlyList<CaseRun> runs, IReadOnlyCollection<string> gateIds)
        => runs.GroupBy(r => r.CaseType)
               .Select(g => new CaseTypeMetric { CaseType = g.Key, Gates = Compute(g.ToList(), gateIds) })
               .ToList();
}
