# Semantiska Jev-gates — Praktisk lathund och reflektion

## 1. Prompten är en del av själva systemet

När Jev används för semantisk detektion är prompten inte bara en fråga till modellen.

Den definierar den semantiska sensorn.

En dåligt definierad gate ger därför inte bara ett sämre svar. Den kan mäta fel sak.

Tänk:

```text
Mänsklig text
    ↓
Semantisk gate-definition
    ↓
Jev-signal
    ↓
Verksamhetspolicy
    ↓
Åtgärd
```

Varje lager har ett eget ansvar.

---

# 2. Börja med verksamhetsfrågan, inte prompten

Börja inte med:

> Hur promptar jag Jev för churn?

Börja med:

> Vad menar verksamheten med churn-risk, vilka fall måste komma med, vilka ska hållas ute och vad kostar olika typer av fel?

Olika verksamheter kan ge helt olika svar.

Det finns därför ingen universellt korrekt definition av exempelvis churn, billing problem eller cancellation.

Syftet bestämmer gaten.

---

# 3. "Tillförlitlighet" betyder ingenting utan parametrar

Ett system kan inte bara beskrivas som:

> tillförlitligt

eller:

> opålitligt.

Det beror på uppgiften.

Exempel:

```text
Precision: 99 %
Recall:    70 %
```

kan vara fantastiskt om false positives är extremt dyra.

Samma siffror kan vara usla för churn om verksamheten missar 30 % av kunderna som faktiskt håller på att lämna.

Definiera därför först:

* Vad vill vi hitta?
* Vad får vi absolut inte missa?
* Vad får vi absolut inte släppa igenom fel?
* Får flera saker vara sanna samtidigt?
* Kan en människa granska osäkra fall?
* Ska resultatet användas för analytics, routing eller automatisk handling?

Först därefter blir metrics och thresholds meningsfulla.

---

# 4. Bred inuti, skarp i kanten

En bra arbetshypotes för semantic gate-design är:

> **Var bred inom konceptet du vill fånga, men skarp mot närliggande koncept som ska hållas ute.**

Gaten ska förstå många olika sätt att uttrycka samma betydelse.

Den ska inte vara beroende av särskilda nyckelord.

En cancellation-gate bör exempelvis förstå:

* säg upp abonnemanget
* avsluta tjänsten
* jag vill inte fortsätta nästa månad
* stäng mitt konto

utan att kräva ordet "cancel".

Samtidigt måste gränsen mot närliggande betydelser vara hård:

* jag funderar på att lämna
* händer detta igen säger jag upp
* konkurrenten verkar bättre
* jag är skitförbannad

De kan vara churn-risk utan att vara en faktisk uppsägningsbegäran.

---

# 5. Bred betyder inte vag

Dålig bred prompt:

> Är kunden tillräckligt missnöjd för att kanske lämna?

Den blandar ihop:

* irritation
* churn
* generell negativitet
* uppsägning

Bättre:

> Uttrycker kunden att de på ett meningsfullt sätt överväger att lämna, byta leverantör, inte förnya eller på annat sätt ifrågasätter om kundrelationen ska fortsätta?

Och sedan en boundary:

> Generellt missnöje utan att själva kundrelationen verkar vara i riskzonen ska inte räknas.

Bred insida.

Skarp kant.

---

# 6. Målet är inte en lång prompt

Mer text är inte automatiskt bättre.

Extra text är framför allt värdefull när den:

1. breddar korrekt semantisk täckning, eller
2. skärper en riktig boundary.

Resten riskerar att bli brus.

Målet är inte:

> skriv fler instruktioner.

Målet är:

> beskriv den semantiska ytan bättre.

---

# 7. Tvinga inte fram exklusivitet om verkligheten inte är exklusiv

Mänsklig text innehåller ofta flera saker samtidigt.

Exempel:

> Supporten var trevlig, men bredbandet fungerar fortfarande dåligt varje kväll och jag har börjat titta på en annan operatör.

Kan samtidigt innehålla:

* positiv supportupplevelse
* tekniskt problem
* återkommande problem
* olöst problem
* konkurrentövervägande
* churn-risk

Att tvinga texten till en enda kategori kastar bort information.

Kör hellre oberoende gates:

```text
Samma text
   ├─ tekniskt problem?
   ├─ churn?
   ├─ billing?
   ├─ positiv support?
   └─ faktisk uppsägning?
```

Varje gate svarar på sin lokala fråga.

---

# 8. Ett semantiskt beslut per gate

Undvik att bygga flera nivåer av semantiskt resonemang i samma judgment.

Hellre:

```text
Text
 ↓
Gate A
 ↓
typed signal
 ↓
vanlig kod
 ↓
Gate B vid behov
```

än ett stort promptmonster som försöker lösa hela beslutsträdet.

Många små gates är lättare att:

* förstå
* testa
* debugga
* versionera
* kombinera

Tänk dem som semantiska logikgrindar.

---

# 9. Billig compute förändrar bra arkitektur

Om Jev-anrop är mycket billiga finns det ingen anledning att automatiskt minimera antalet calls.

Det kan vara mycket bättre att köra elva rena gates än tre stora gates som blandar flera beslut.

Prioritera:

1. semantisk tydlighet
2. informationsbevarande
3. robusthet
4. observerbarhet

Optimera compute först när det faktiskt blir ett problem.

---

# 10. Separera semantic detection från verksamhetspolicy

Jev producerar signalen.

Verksamheten bestämmer vad den gör med signalen.

Exempel:

```text
Churn-risk = 0.63
```

Verksamhetspolicy:

```text
under 0.40   → NO
0.40–0.84    → REVIEW
0.85+        → YES
```

Jevs `0.63` har inte ändrats.

Det är bara verksamhetens tolkning som ändrats.

Det är en central separation.

---

# 11. Thresholds är policy, inte sanning

Thresholden definierar inte konceptet.

Den definierar när verksamheten agerar.

För churn kan man vilja ha låg review-threshold eftersom det är dyrt att missa riktiga riskfall.

För en känslig automatisk åtgärd kan man vilja ha mycket hög accept-threshold.

Det finns ingen universell optimal threshold.

---

# 12. Men förstå signalen innan threshold väljs

Påståendet:

> välj threshold efter verksamhetens riskaptit

förutsätter att man först förstått hur gaten beter sig.

Anta inte automatiskt:

```text
0.30 = svagt
0.70 = starkt
0.90 = säkert
```

för alla gates.

Titta på:

* tydliga YES
* tydliga NO
* boundary-fall
* indirekta uttryck
* negationer
* motsägelsefulla / ändrade tillstånd

Olika gates kan få helt olika signalfördelningar.

Först karakterisera.

Sedan sätt policy.

---

# 13. Dålig semantic boundary går inte alltid att thresholda bort

Ett viktigt experimentellt fynd var att en bred gate ibland var väldigt självsäker på fel koncept.

Om modellen ger:

```text
0.98
```

på fel närliggande betydelse hjälper det inte att höja threshold från `0.70` till `0.90`.

Då är problemet promptens semantiska gräns.

Tumregel:

```text
Fel grannkoncept får höga scores
→ fixa boundary

Rätta fall får för låga scores
→ undersök semantic interior

Rätt signal men fel verksamhetsbeslut
→ justera threshold/policy
```

Använd inte thresholds för att gömma promptproblem.

---

# 14. Semantic truth och workflow är två olika saker

Vid evaluation behöver man två separata frågor.

## Vad finns faktiskt i texten?

```text
YES
NO
UNCLEAR
```

## Vad ska verksamheten göra?

```text
NO ACTION
HUMAN REVIEW
ACTION
```

`UNCLEAR` beskriver den semantiska bedömningen.

`REVIEW` beskriver workflowet.

De ska inte blandas ihop.

---

# 15. Human review är en feature

REVIEW betyder inte att AI-systemet har misslyckats.

Det kan vara en medveten säkerhetsdesign.

```text
NO
→ för svag signal

REVIEW
→ relevant men människa tittar

YES
→ tillräcklig signal för detta workflow
```

Hur stort review-intervallet är kan styras av:

* risk
* kostnad
* bemanning
* false positive-kostnad
* false negative-kostnad
* hur reversibel handlingen är

---

# 16. Metrics måste följa verksamhetsmålet

Optimera inte allt mot F1.

## Churn

Recall kan vara viktigast.

> Missa inte kunder som håller på att lämna.

## Känslig automation

Precision kan vara viktigast.

> Gör inte fel handling automatiskt.

## Routing

Jämn kvalitet kan vara viktigare än snittet.

```text
Billing    .98
Technical  .97
Contract   .96
Support    .55
```

är inte ett bra routingsystem bara för att snittet ser fint ut.

Den svagaste gaten kan vara viktigast.

## Analytics

Lite brus kan vara acceptabelt om man fortfarande får användbara aggregat.

---

# 17. Automatisk threshold-kalibrering är bra — om målet är definierat

Thresholds kan absolut optimeras automatiskt.

Men optimizern behöver verksamhetskrav.

Exempel:

```text
Churn:
Recall minst 95 %
Human review max 25 %
Bland godkända lösningar: maximera precision
```

En annan gate kanske säger:

```text
False automatic acceptance under 1 %
Fånga så många verkliga fall som möjligt
Osäkerhet → REVIEW
```

Bygg inte en knapp som heter:

> optimera allt.

Optimera mot definierat business objective.

---

# 18. Testa spontana fall, inte bara fixtures

Syntetiska testfall är bra eftersom man vet vad de ska innehålla.

Men om fixtures och promptar skrivs från samma definition kan resultaten bli cirkulära.

Lägg därför till spontana fall som inte fanns under promptdesignen.

Bra exempel:

* konstig formulering
* indirekt språk
* negation
* ändrat tillstånd
* flera signaler samtidigt
* långa texter
* vilseledande ord

Exempel:

> "I'm not happy with the speed but the price is competitive. What is the cost to increase it?"

Orden:

* price
* competitive
* not happy

kan lätt lura dåligt avgränsade gates.

Det gör sådana fall mycket värdefulla.

---

# 19. Failure cases är mer värdefulla än headline accuracy

När något går fel, klassificera felet.

Exempel:

* för smal semantic interior
* läckage från grannkoncept
* lexical shortcut
* negationsfel
* current-state-fel
* otydlig business-definition
* annotatörer oense
* policy/threshold fel

Ett fel berättar vad du ska ändra.

En ensam accuracy-siffra gör ofta inte det.

---

# 20. Versionera semantic gates

Skriv aldrig över en fungerande prompt i tysthet.

```text
Churn v1
   ↓
boundary ändras
   ↓
Churn v2
```

Kör regressionstesten igen.

Visa:

* fixed
* broken
* unchanged
* metrics före
* metrics efter

Om fem fall fixas och tio går sönder var ändringen inte automatiskt bättre.

---

# 21. Bevara historiska definitioner

Varje analys bör veta vilken gate-version som användes.

Technical View ska kunna visa:

* exakt prompt
* TRUE/FALSE criteria
* modellversion
* thresholds
* raw response

även efter att gaten senare ändrats.

Det gör systemet granskningsbart.

---

# 22. Promptdesign är delvis semantic engineering

Ett användbart sätt att tänka är:

> Prompten beskriver en semantisk beslutsyta med språk.

Du försöker få stor korrekt täckning inom rätt område och minimera läckage över gränserna.

Det kräver omdöme.

Det är både engineering och hantverk.

Domänkunskap hjälper enormt eftersom verksamheten kan säga:

* vad som räknas
* vad som inte räknas
* vilka boundaries som är viktiga
* vilka fel som är dyra
* när en människa ska kopplas in

---

# 23. Ibland är business-definitionen svårare än Jev

Exempel:

> "Please cancel my sports package but keep broadband."

Ska detta räknas som:

`explicit_cancellation_intent`?

Det beror helt på vad gaten betyder.

Är målkonceptet:

* cancellation av vilken produktdel som helst?
* avslut av huvudabonnemang?
* full kundrelation?
* account closure?

Jev kan inte lösa en odefinierad business-regel.

Ibland är rätt lösning:

> definiera konceptet bättre

inte:

> optimera modellen mer.

---

# 24. Praktiskt arbetsflöde för en ny gate

## Steg 1 — Definiera verksamhetssyftet

Varför finns signalen?

## Steg 2 — Definiera felkostnaden

Vilket är värst:

* missa ett riktigt fall?
* släppa igenom ett falskt?

## Steg 3 — Definiera semantic target

Vad exakt ska hittas?

## Steg 4 — Definiera semantic interior

Vilka legitima variationer ska räknas?

## Steg 5 — Identifiera närmaste grannkoncept

Vad kommer lätt blandas ihop?

## Steg 6 — Sätt boundaries

Vad måste uttryckligen hållas ute?

## Steg 7 — Skriv instruction + TRUE/FALSE criteria

En lokal semantisk fråga.

## Steg 8 — Testa enkla fall

Verifiera grundbeteendet.

## Steg 9 — Testa boundaries

Ofta viktigare än de enkla fallen.

## Steg 10 — Testa spontana fall

Inte bara fixtures från promptdesignen.

## Steg 11 — Studera signalnivåerna

Förstå probability distribution.

## Steg 12 — Sätt REVIEW / YES thresholds

Utifrån verksamhetsmålet.

## Steg 13 — Spara ny version

Förstör inte den gamla.

## Steg 14 — Regressionstesta

Kontrollera vad som blev bättre och vad som gick sönder.

---

# 25. Snabb felsökningsguide

## Rätta fall missas

Fråga:

> Är semantic interior för smal?

Sänk inte threshold automatiskt.

---

## Grannkoncept kommer in

Fråga:

> Är boundaryn för dåligt definierad?

Höj inte threshold automatiskt.

---

## Signalen verkar rätt men workflow blir fel

Fråga:

> Är policyn fel för verksamhetsmålet?

---

## Människor är oense om facit

Fråga:

> Är själva business-konceptet otydligt?

---

## En gate är dålig men snittet ser bra ut

Lita inte på snittet.

Granska gaten separat.

---

## Flera gates får höga värden

Det kan vara helt korrekt.

Tvinga inte fram en vinnare om verksamheten inte faktiskt behöver det.

---

# 26. Kärnprinciperna

Om bara några saker ska kommas ihåg:

> **Definiera verksamhetssyftet innan prompten.**

> **Bred inuti, skarp i kanten.**

> **Tvinga inte fram exklusivitet när verkligheten innehåller flera koncept.**

> **Ett lokalt semantiskt beslut per gate.**

> **Jev-signal och verksamhetspolicy är olika lager.**

> **Förstå signalen innan thresholds väljs.**

> **Försök inte laga semantic-boundary-fel med thresholds.**

> **Metrics får mening först i relation till verksamhetsmålet.**

> **Human review är en legitim del av arkitekturen.**

> **Versionera prompts och regressionstesta varje semantisk ändring.**

> **När verksamheten vet exakt vad den menar blir det mycket lättare att bygga en tillförlitlig gate.**
