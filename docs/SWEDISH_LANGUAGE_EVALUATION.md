# Kort utvärdering av svenskstödet

Den parade utvärderingen körde samma 100 syntetiska fall på engelska och svenska med identiska förväntade etiketter. Körningen använde exakt 200 liveanrop till Jev (`jev-1.13.0`) och gav inga API-fel.

| Mått | Engelska | Svenska | Skillnad |
|---|---:|---:|---:|
| Makro-F1 | 84,0 % | 82,6 % | −1,4 procentenheter |
| Mikro-F1 | 85,4 % | 84,3 % | −1,0 procentenhet |
| Exakt godkända fall | 35,0 % | 35,0 % | 0 |

Den genomsnittliga absoluta skillnaden mellan parade gate-sannolikheter var 0,036. Resultaten visar därför ingen praktiskt betydande språkbarriär i denna domän. Variationen mellan enskilda gates är liten nog att hanteras med verksamhetens befintliga trösklar för `NO`, `REVIEW` och `YES` när kostnaden för falsklarm respektive missar kräver det.

Det hårda måttet ”exakt godkänt fall” kräver att samtliga elva gates blir rätt samtidigt. Vaga, motsägelsefulla eller ofullständiga kundtexter kommer därför fortsatt att ge gränsfall oavsett språk. Det är främst en begränsning i underlaget och den subjektiva domänbedömningen, inte ett belägg för ett svenskt språkproblem.

**Beslut:** svenskstödet godkänns i nuvarande version. Ingen generell omformulering av de svenska frågorna eller ytterligare språkoptimering planeras utifrån denna körning. Framtida threshold-ändringar ska motiveras av ett konkret verksamhetsmål eller en mätbar felkostnad.

Fullständiga diagram, gate-mått och råresultat finns i [den fristående rapporten](../data/results/swedish-language-evaluation-20260930/report.html).
