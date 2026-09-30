# Fördjupad utvärdering av Sven/Kev

## Sammanfattning

Sven-adaptern fungerar tekniskt korrekt: samma 100 engelska och 100 svenska fall slutfördes med exakt 200 lokala Kev-anrop, ett anrop per fall och alla elva Noul-frågor i varje anrop. Inga API-fel registrerades och samtliga svar använde modellen `kev-latest`.

Modellkvaliteten når däremot inte Jev-baslinjen i den här konfigurationen. Skillnaden beror delvis på att Sven använder en annan sannolikhetsskala, men threshold-kalibrering kan inte ensam förklara eller ta bort gapet. De threshold-oberoende resultaten visar att Sven framför allt på svenska har svagare semantisk separation och lägre konsekvens mellan parade engelska och svenska fall.

## Metod

- Dataset: 100 parade syntetiska fall med identiska gate-ID:n och förväntade etiketter på engelska och svenska.
- Sven: `kev-latest` via `POST http://127.0.0.1:8009/v1/systemone`.
- Anrop: exakt 100 engelska + 100 svenska, utan retries eller lokalt sparade extrafall.
- Frågor per anrop: samtliga elva Noul-gates i ett gemensamt `questions`-objekt.
- Jämförelse: den tidigare sparade Jev-körningen på samma fall och gate-versioner; inga nya Jev-anrop gjordes.
- Nuvarande F1: befintliga accept-thresholds, som ursprungligen kalibrerades för Jev.
- Bästa F1: gate-specifik threshold vald på samma 100 fall. Detta är ett optimistiskt in-sample-tak, inte ett oberoende testresultat.
- AUROC: threshold-oberoende mått på om positiva fall rangordnas högre än negativa fall.

## Huvudresultat

| Mått | Sven EN | Sven SV | Jev EN | Jev SV |
|---|---:|---:|---:|---:|
| Makro-F1, nuvarande thresholds | 39,2 % | 17,4 % | 84,0 % | 82,6 % |
| Mikro-F1, nuvarande thresholds | 42,7 % | 20,8 % | 85,4 % | 84,3 % |
| Makro-AUROC | 73,4 % | 59,4 % | 98,5 % | 98,7 % |
| Bästa makro-F1, in-sample | 51,9 % | 41,4 % | 91,8 % | 91,5 % |
| Gate-bedömningar korrekta | 75,0 % | 77,2 % | 94,6 % | 94,3 % |
| Binärt exakt fall | 11,0 % | 8,0 % | 59,0 % | 57,0 % |
| Strikt policyfall | 2,0 % | 2,0 % | 35,0 % | 35,0 % |
| REVIEW-andel | 43,0 % | 47,3 % | 8,7 % | 9,5 % |
| Latens p50 | 2 260 ms | 4 843 ms | 258 ms | 253 ms |
| Latens p95 | 2 654 ms | 5 704 ms | 363 ms | 313 ms |

Den relativt höga totala gate-accuracy som Sven får trots låg F1 beror på klassobalans: de flesta gate/fall-kombinationer är negativa. Makro-F1 och AUROC är därför mer informativa för förmågan att hitta de positiva betydelserna.

## Thresholds och semantisk förståelse

Det är riktigt att två modeller kan vara lika användbara trots olika råa sannolikheter. Om båda modellerna konsekvent rangordnar relevanta fall över irrelevanta fall kan varje modell få egna thresholds och nå liknande beslutskvalitet. Därför är rå sannolikhetslikhet inte ett krav.

I den här körningen förbättrar gate-specifik kalibrering Sven tydligt:

- engelska: makro-F1 39,2 → 51,9 %
- svenska: makro-F1 17,4 → 41,4 %

Förbättringen visar att de befintliga Jev-thresholds inte ska återanvändas direkt för Sven. Den kvarvarande skillnaden är dock för stor för att beskrivas som enbart kalibrering. Sven når AUROC 73,4 % på engelska och 59,4 % på svenska, medan Jev ligger nära 99 % på båda språken. Thresholds kan flytta beslutsgränsen men kan inte reparera fall där positiva och negativa exempel rangordnas i fel ordning.

Den svenska och engelska Sven-körningen har Pearson-korrelation 0,409 över 1 100 parade signaler och en genomsnittlig absolut sannolikhetsskillnad på 0,236. Jev-baslinjen har korrelation 0,974 och skillnad 0,036. Resultatet visar alltså lägre språklig konsekvens hos Sven i nuvarande konfiguration.

## Gate-resultat

| Gate | F1 EN | F1 SV | AUROC EN | AUROC SV | Bästa F1 EN* | Bästa F1 SV* | Bästa threshold EN* | Bästa threshold SV* |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Fakturaproblem | 51,4 % | 39,3 % | 68,8 % | 58,0 % | 54,5 % | 46,0 % | 0,758 | 0,411 |
| Tekniskt problem | 47,1 % | 0,0 % | 67,7 % | 44,9 % | 57,8 % | 48,0 % | 0,651 | 0,022 |
| Avtalsproblem | 52,5 % | 35,6 % | 75,1 % | 65,8 % | 57,1 % | 50,0 % | 0,814 | 0,630 |
| Supportkontakt | 33,3 % | 14,8 % | 78,8 % | 52,9 % | 50,0 % | 27,8 % | 0,836 | 0,696 |
| Olöst ärende | 25,0 % | 0,0 % | 68,3 % | 38,8 % | 47,5 % | 37,0 % | 0,459 | 0,059 |
| Återkommande problem | 41,2 % | 0,0 % | 77,5 % | 72,6 % | 57,1 % | 50,0 % | 0,741 | 0,639 |
| Positiv support | 53,8 % | 33,3 % | 82,0 % | 63,4 % | 58,3 % | 37,2 % | 0,920 | 0,540 |
| Negativ support | 46,8 % | 0,0 % | 74,2 % | 59,3 % | 54,3 % | 44,4 % | 0,642 | 0,233 |
| Överväger konkurrent | 10,0 % | 0,0 % | 51,2 % | 55,0 % | 26,5 % | 28,6 % | 0,256 | 0,559 |
| Risk att lämna | 41,5 % | 28,6 % | 76,8 % | 56,3 % | 52,9 % | 36,1 % | 0,836 | 0,224 |
| Uttrycklig uppsägning | 28,6 % | 40,0 % | 86,4 % | 85,8 % | 54,5 % | 50,0 % | 0,933 | 0,882 |

\* Threshold och bästa F1 är optimerade och mätta på samma dataset.

`explicit_cancellation_intent` har den starkaste språkoberoende separationen hos Sven. `competitor_consideration` ligger nära slumpmässig rangordning på båda språken, och flera svenska gates ligger nära eller under 50 % AUROC. Dessa fall kan inte lösas enbart genom att flytta threshold.

## Latens och drift

Sven slutförde alla anrop utan fel, vilket bekräftar att adaptern, batchformatet och svarsmappningen fungerar. Medianlatensen var cirka 2,3 sekunder för engelska och 4,8 sekunder för svenska. Körningen var sekventiell och mätte inte 50 samtidiga användare, köbildning, varm/kall modell eller resursmättnad. Resultatet räcker därför för funktionskontroll men inte som belastningstest.

## Slutsats

Providerarkitekturen är verifierad och Sven/Kev kan användas genom samma webbflöde, policykod och resultatmodell som Jev. Den lokala modellen är tekniskt stabil men når inte jämförbar semantisk kvalitet på den parade regressionssviten i nuvarande konfiguration.

Sven behöver egna thresholds, men även optimala in-sample-thresholds lämnar ett tydligt gap. Innan modellen bedöms som ersättare bör nästa experiment kontrollera om Kev kan ta emot de strukturerade Noul-kriterierna eller en rikare sammanslagen instruktion, därefter kalibrera på ett separat underlag och validera på orörda fall. Upprepade körningar behövs också för att mäta faktisk modellstabilitet över tid; den här körningen mäter konsekvens mellan språk, inte test–retest-konsistens.

Den fullständiga interaktiva rapporten finns i [report.html](report.html). Rådata finns i [english.json](english.json) och [swedish.json](swedish.json); kontrollsummor och källor finns i [run-manifest.json](run-manifest.json).
