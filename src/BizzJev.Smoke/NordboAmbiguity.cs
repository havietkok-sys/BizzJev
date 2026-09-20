internal static class NordboAmbiguity
{
    internal static readonly (string Message, string Competing)[] Cases =
    [
        ("The lock on my front door is broken.", "Access, Maintenance"),
        ("My key sometimes works, but the lock probably needs repairing.", "Access, Maintenance"),
        ("My landlord says I need to pay for the broken door.", "Billing, Maintenance"),
        ("I want to know whether my rent changes if I renew my lease.", "Billing, Contract"),
        ("My heating is broken and I was charged rent twice.", "Maintenance, Billing"),
        ("I can't get into my apartment and I also need to terminate my lease.", "Access, Contract"),
        ("I was charged rent twice and my heating is broken.", "Maintenance, Billing"),
        ("Am I responsible under my lease for repairing the broken window, or will you arrange it?", "Contract, Maintenance"),
        ("There is a problem with my apartment. Can you help?", "Maintenance, Access, Billing, Contract, Other")
    ];

    internal static void ListCases()
    {
        Console.WriteLine($"Ambiguity experiment: {Cases.Length} cases, {Cases.Length} sequential requests, no retries (fewer if aborted).");
        for (var i = 0; i < Cases.Length; i++)
            Console.WriteLine($"{i + 1}. {Cases[i].Message}\n   Competing categories: {Cases[i].Competing}");
    }

    internal static string Describe(IEnumerable<double> probabilities, double confidence, string choice, string competing)
    {
        var ranked = probabilities.OrderDescending().ToArray();
        // Descriptive endpoints only, not an automatic routing or confidence policy.
        var shape = ranked[0] == 1 && ranked.Skip(1).All(p => p == 0) ? "fully concentrated" : "split (nonzero mass on multiple options)";
        var surprise = competing.Split(", ").Contains(choice) ? "within noted competitors" : "outside noted competitors (inspect; not a failure)";
        return FormattableString.Invariant($"Choice={choice}; winning={ranked[0]:G17}; second={ranked[1]:G17}; margin={ranked[0] - ranked[1]:G17}; confidence={confidence:G17} ({(confidence == 1 ? "same as basic baseline" : "lower than basic baseline 1.0")}); {shape}; {surprise}");
    }

    internal static void Check()
    {
        foreach (var (message, competing) in Cases)
        {
            NordboChoice.Request(message, "jev-1.13.0");
            if (competing.Split(", ").Any(c => !NordboChoice.Criteria.ContainsKey(c)))
                throw new Exception("Invalid competing category.");
        }
        // Synthetic arithmetic inputs only; these are not Jev responses or expectations.
        var split = Describe([0, 0.5, 0, 0.5, 0], 0.2, "Billing", "Maintenance, Billing");
        var concentrated = Describe([0, 1, 0, 0, 0], 1, "Other", "Maintenance, Billing");
        if (!split.Contains("margin=0;") || !split.Contains("split (")
            || !concentrated.Contains("winning=1; second=0; margin=1;")
            || !concentrated.Contains("fully concentrated") || !concentrated.Contains("outside noted competitors"))
            throw new Exception("Ambiguity arithmetic/reporting check failed.");
    }
}
