# BizzJev – Jev Evaluation Report

**Status:** Pågående experimentrapport
**Jev model:** `jev-1.13.0`
**Projekt:** BizzJev
**Syfte:** Utvärdera TypeSafe Jev som semantisk routingkomponent för inkommande kundärenden.

---

## 1. Syfte

BizzJev är ett litet experimentprojekt för att undersöka hur TypeSafe Jev kan användas för typed semantic judgments i ett vanligt applikationsflöde.

Det första domänfallet är det fiktiva bostadsbolaget **Nordbo Property**.

Ett inkommande kundmeddelande ska klassificeras till en routingkategori:

* Maintenance
* Billing
* Access
* Contract
* Other

Projektet är medvetet litet. Målet i denna fas är inte att bygga ett komplett kundservicesystem utan att förstå:

1. hur Jev beter sig på tydliga klassificeringsfall,
2. hur probability distribution och confidence beter sig vid tvetydighet,
3. hur känsligt resultatet är för hur judgment-frågan formuleras,
4. var semantisk bedömning bör sluta och deterministisk business logic börja.

---

# 2. Teknisk baseline

Den första tekniska milstolpen var att bevisa den minsta externa integrationen:

```text
C#
 ↓
TypeSafe System One API
 ↓
Jev Choice
 ↓
typed response
 ↓
C#
```

Integrationen använder direkt HTTP från .NET utan ytterligare SDK-lager.

Det första autentiserade testet använde ett enkelt Billing-fall:

> I was charged rent twice.

Jev returnerade:

```text
Choice: Billing
Probability: 1.00
Confidence: 1.00
Model: jev-1.13.0
```

Det bekräftade att hela kedjan C# → TypeSafe → Jev → typed Choice fungerade.

---

# 3. Baseline judgment

Det ursprungliga judgmentet bad Jev klassificera kundens **primary reason** för att kontakta Nordbo.

`Choice` innehöll fem konkurrerande alternativ:

```text
Maintenance
Billing
Access
Contract
Other
```

`Other` definierades som att inget av de fyra specifika Nordbo-områdena passar.

Det är viktigt att skilja detta från osäkerhet:

```text
Other
= ärendet passar inte de definierade kategorierna

Uncertainty
= flera tolkningar/kategorier kan konkurrera

Error
= Jev-anropet eller svaret misslyckades
```

---

# 4. Experiment 1 – Basic evaluation

## Mål

Första eval-setet skulle kontrollera om baseline-judgmentet fungerade på tydliga ärenden samt några enkla robustness-fall.

Totalt kördes **10 riktiga Jev-anrop**.

## Testfall

| #  | Fall                                            | Förväntat   |
| -- | ----------------------------------------------- | ----------- |
| 1  | Radiator stopped working                        | Maintenance |
| 2  | Charged rent twice                              | Billing     |
| 3  | Key doesn't open entrance                       | Access      |
| 4  | Terminate lease                                 | Contract    |
| 5  | Buy a mountain bike                             | Other       |
| 6  | Communist hamster + broken radiator             | Maintenance |
| 7  | Flat freezing despite heating                   | Maintenance |
| 8  | Irrelevant weather/football + incorrect invoice | Billing     |
| 9  | Rent question + cannot enter using code         | Access      |
| 10 | Prompt-like instruction + leaking sink          | Maintenance |

## Resultat

```text
Passed: 10
Failed: 0
Total: 10
```

Samtliga tio fall returnerade dessutom:

```text
winning probability = 1.00
confidence          = 1.00
```

med `0.00` på samtliga konkurrerande kategorier.

## Observation

Jev hanterade i detta lilla testset:

* tydliga kategorier,
* implicit problemformulering,
* irrelevant information,
* ett uttalat huvudärende bland flera ämnen,
* instruction-like text inuti kundmeddelandet.

Resultatet var lovande, men testfallen var fortfarande relativt enkla.

Framför allt hade vi ännu inte observerat hur Jev betedde sig när flera kategorier faktiskt var semantiskt rimliga.

---

# 5. Experiment 2 – Ambiguity evaluation

## Mål

Det andra experimentet försökte avsiktligt skapa konflikter mellan kategorier.

Ingen PASS/FAIL-label användes eftersom flera fall saknade ett objektivt korrekt single-choice-svar.

Vi observerade istället:

* vald Choice,
* winning probability,
* runner-up probability,
* margin,
* confidence.

Totalt kördes **9 riktiga Jev-anrop**.

## Resultat

De tydligaste gränsfallen förblev helt koncentrerade.

Exempel:

> The lock on my front door is broken.

gav:

```text
Access      1.00
Maintenance 0.00
Confidence  1.00
```

Även:

> My key sometimes works, but the lock probably needs repairing.

gav `Access 1.00`.

Andra formuleringar skapade däremot verkliga distributionsskillnader.

### Billing vs Maintenance

> My landlord says I need to pay for the broken door.

```text
Billing      0.88
Maintenance  0.08
Other        0.02
Contract     0.01
Access       0.01

Confidence: 0.85
```

### Access vs Contract

> I can't get into my apartment and I also need to terminate my lease.

```text
Access    0.72
Contract  0.28

Confidence: 0.64
```

### Otillräcklig information

> There is a problem with my apartment. Can you help?

gav:

```text
Maintenance  0.67
Other        0.33

Confidence: 0.58
```

Detta var den lägsta observerade confidence-nivån i experimentet.

---

# 6. Upptäckten av order sensitivity

Det mest intressanta resultatet uppstod i två avsiktligt speglade testfall.

### Variant A

> My heating is broken and I was charged rent twice.

Resultat:

```text
Maintenance  0.80
Billing      0.19
Other        0.01

Confidence: 0.76
```

### Variant B

> I was charged rent twice and my heating is broken.

Resultat:

```text
Billing      0.80
Maintenance  0.19
Other        0.01

Confidence: 0.75
```

Den semantiska informationen var i praktiken densamma.

Det enda avsiktliga ingreppet var ordningen.

Ändå speglades beslutet nästan perfekt:

```text
Maintenance först
→ Maintenance .80

Billing först
→ Billing .80
```

---

# 7. Hypotes – “primary” var underdefinierat

Den första misstanken kunde ha varit att Jev hade en generell order bias.

Vid närmare analys uppstod istället en viktig fråga kring själva judgment-specifikationen.

Baseline-instruktionen bad modellen välja kundens:

> primary reason

Men i exemplet:

> My heating is broken and I was charged rent twice.

finns två fullt giltiga ärenden.

Ingenting i texten säger att det ena är viktigare eller mer primärt än det andra.

Begreppet **primary** hade införts av BizzJev-instruktionen men hade inte definierats för multi-intent-fall.

Hypotesen blev därför:

> Order-effekten kanske inte primärt beror på att Jev missförstår texten. Judgmentet kräver ett enda svar på en fråga där specifikationen inte definierar hur två samtidigt giltiga svar ska prioriteras.

För att testa hypotesen behövde exakt denna osäkerhet tas bort utan att ändra kategorierna.

---

# 8. Experiment 3 – Explicit routing priority

## Mål

Ett separat experimentellt Choice-judgment skapades.

Baseline-judgmentet lämnades oförändrat.

Endast instruktionen ändrades.

När flera kategorier samtidigt var giltiga skulle Jev använda en explicit business priority:

```text
Access
  >
Maintenance
  >
Billing
  >
Contract
  >
Other
```

Instruktionen sade dessutom uttryckligen att meddelandets ordningsföljd inte skulle bestämma prioritet.

Fyra par skapades där samma intents förekom i omvänd ordning.

Fem tidigare tydliga single-intent-fall användes som kontroll.

Totalt:

```text
8 paired cases
5 controls
13 Jev requests
```

---

# 9. Priority experiment – resultat

## Pair A – Maintenance vs Billing

```text
A1:
Heating + Billing
→ Maintenance 1.00
→ confidence 1.00

A2:
Billing + Heating
→ Maintenance 1.00
→ confidence 1.00
```

Ordningen hade ingen observerad effekt på vare sig Choice, distribution eller confidence.

---

## Pair B – Access vs Contract

Båda ordningarna gav:

```text
Access 1.00
confidence 1.00
```

Distributionerna var identiska.

---

## Pair C – Billing vs Contract

Första ordningen:

```text
Billing   0.97
Contract  0.03
Confidence 0.96
```

Omvänd ordning:

```text
Billing   0.98
Contract  0.02
Confidence 0.97
```

Choice var alltså stabil.

En liten skillnad på `0.01` observerades i distribution och confidence.

---

## Pair D – Access vs Maintenance

Båda ordningarna gav:

```text
Access 1.00
confidence 1.00
```

Distributionerna var identiska.

---

# 10. Kontrollfall

De fem single-intent-kontrollerna var:

```text
Maintenance
Billing
Access
Contract
Other
```

Samtliga fem fortsatte ge sina tidigare förväntade kategorier.

Ingen regression observerades i kontrollfallen.

---

# 11. Sammanfattning av priority-experimentet

Alla fyra reverserade par gav samma Choice oavsett ordningsföljd.

```text
Pair A: Maintenance / Maintenance
Pair B: Access / Access
Pair C: Billing / Billing
Pair D: Access / Access
```

Tre av fyra par gav exakt samma distribution och confidence mellan ordningsvarianterna.

Pair C skiljde endast `0.01`.

Samtliga fem kontrollfall passerade.

---

# 12. Vad resultaten hittills stödjer

Experimenten ger preliminärt stöd för följande.

### Jev följer tydliga Choice-definitioner väl i detta lilla test

De tio ursprungliga baseline-fallen klassificerades enligt förväntan.

### Jev kan uttrycka semantic competition i distributionen

När judgmentet var underbestämt eller informationen otillräcklig observerades mindre koncentrerade probability distributions och lägre confidence.

### Prompt-/judgment-designen har stor betydelse

Den starkaste observationen hittills är skillnaden mellan:

```text
"Choose the primary reason"
```

och:

```text
"If several categories apply,
use this explicit business priority."
```

Den första formuleringen gav kraftig order sensitivity i ett multi-intent-fall.

När businessregeln gjordes explicit försvann den observerade order-effekten nästan helt i de testade paren.

### Typed output löser inte en underdefinierad fråga

Att Jev producerar ett strikt typed `Choice` innebär inte automatiskt att den semantiska frågan har exakt ett korrekt svar.

Applikationen måste fortfarande definiera vad judgmentet faktiskt betyder.

---

# 13. Vad resultaten INTE visar

Testmängden är fortfarande liten.

Resultaten visar därför inte att:

* Jev generellt är order invariant,
* Jev alltid klassificerar Nordbo-ärenden korrekt,
* confidence är kalibrerad sannolikhet för correctness,
* en viss confidence-nivå automatiskt bör leda till HUMAN_REVIEW,
* den explicita priority-designen är den bästa produktdesignen,
* Choice är den bästa primitive för alla routingproblem,
* resultaten automatiskt generaliserar till svenska kundmeddelanden,
* modellen är robust mot större adversarial- eller verkliga produktionsdata.

Resultaten ska därför behandlas som experimentell evidens, inte produktionsvalidering.

---

# 14. Arkitektonisk lärdom

Experimenten börjar tydliggöra en viktig gräns mellan semantic judgment och business policy.

En möjlig arkitektur är:

```text
Customer message
      ↓
Jev semantic judgment
      ↓
typed probabilities / confidence
      ↓
deterministic application policy
      ↓
routing / review / other action
```

Jev behöver inte äga hela affärsbeslutet.

Exempelvis kan Jev avgöra vilka semantiska egenskaper ett meddelande har medan C# bestämmer vad verksamheten gör med dessa egenskaper.

Detta behöver dock testas vidare innan någon slutlig routingarkitektur väljs.

---

# 15. Nästa forskningsfråga – primitives

Experimenten har också väckt en mer grundläggande fråga:

> Är ett kundmeddelande verkligen alltid ett single-label Choice-problem?

Exempel:

> My heating is broken and I was charged rent twice.

Semantiskt kan båda följande samtidigt vara sanna:

```text
Contains Maintenance issue = YES
Contains Billing issue     = YES
```

En enda Choice tvingar däremot fram konkurrens:

```text
Maintenance VS Billing
```

Nästa steg bör därför vara att förstå och experimentellt jämföra TypeSafe-primitives:

### Choice

Vilket av flera konkurrerande alternativ ska väljas?

### Noul

Gäller ett specifikt villkor?

Flera separata Noul-judgments skulle potentiellt kunna identifiera flera samtidiga intents utan att tvinga fram en vinnare.

### Score

Hur mycket av en definierad egenskap finns?

Det kan vara relevant för kontinuerliga judgment-dimensioner, exempelvis urgency, om dimensionen kan definieras tillräckligt tydligt.

### Confidence

Confidence ska behandlas separat från själva primitive-valet och inte tolkas som sannolikheten att modellen har rätt.

---

# 16. Rekommenderad experimentdisciplin framåt

BizzJev bör fortsätta med samma metod:

```text
Observation
    ↓
Hypotes
    ↓
Ändra EN relevant variabel
    ↓
Kontroller
    ↓
Kör verkliga Jev-anrop
    ↓
Jämför
    ↓
Dokumentera
```

Nuvarande baseline- och experimentversioner bör behållas så att senare ändringar kan jämföras mot tidigare beteende.

Framtida körningar bör även sparas maskinläsbart, exempelvis som JSON, så att experimentresultat kan analyseras och återanvändas utan att vara beroende av terminalutskrifter.

---

# 17. Nuvarande läge

Hittills har BizzJev genomfört:

```text
1 real integration smoke test

10 basic evaluation requests

9 ambiguity experiment requests

13 explicit-priority experiment requests
```

Totalt:

```text
33 strukturerade eval-anrop
+ den ursprungliga integrationens smoke test
```

De viktigaste resultaten hittills är inte bara klassificeringsresultaten.

Projektet har redan demonstrerat en central egenskap hos semantic AI-system:

> Modellens beteende kan inte utvärderas separat från betydelsen av den fråga som applikationen faktiskt har specificerat.

Det observerade multi-intent-problemet såg initialt ut som möjlig model/order bias.

Ett kontrollerat experiment visade därefter att en stor del av beteendet försvann när det tidigare underdefinierade begreppet **primary** ersattes med en explicit businessregel.

Det gör frågedesign, primitive-val och tydlig separation mellan semantic judgment och deterministic business logic till centrala delar av nästa fas av BizzJev.
