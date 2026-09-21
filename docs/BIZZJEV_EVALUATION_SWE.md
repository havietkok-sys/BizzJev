# BizzJev — Utvärdering och lärdomar

[English](BIZZJEV_EVALUATION.md)

## Översikt

BizzJev är en praktisk undersökning av **Jev / TypeSafe System One som ett lager för typade semantiska bedömningar i vanlig programvara**.

Projektet började med en enkel fråga:

> Vad blir möjligt om programvara kan göra semantiska bedömningar av ostrukturerad information och få resultatet som ett avgränsat, typat värde i stället för genererad text?

Traditionell programvara är utmärkt på deterministiska operationer när reglerna kan skrivas uttryckligen. Stora språkmodeller kan tolka tvetydigt naturligt språk, men returnerar vanligtvis genererad text som i sin tur måste tolkas, valideras eller begränsas.

Jev erbjuder en annan programmeringsmodell:

```text
Ostrukturerat tillstånd
        ↓
Semantisk bedömning
        ↓
Typat resultat
Choice / Noul / Score
        ↓
Vanlig programlogik
```

BizzJev undersöker var denna modell är användbar, hur tillförlitlig den är och — lika viktigt — hur lätt det är att ställa fel semantisk fråga.

Detta dokument sammanfattar de experiment som hittills genomförts, antagandena bakom dem, vad resultaten faktiskt visar och vad som fortfarande är okänt.

---

# 1. De tre bedömningstyperna

Den första fasen av BizzJev fokuserade på att förstå tre Jev-primitiver.

### Choice — ”Vilken?”

Choice representerar konkurrens mellan en definierad uppsättning alternativ.

Exempel:

```text
Kundmeddelande
        ↓
Maintenance
Billing
Access
Contract
Other
```

Resultatet innehåller ett valt alternativ och en sannolikhetsfördelning över alternativen.

### Noul — ”Gäller detta?”

Noul bedömer om ett visst semantiskt villkor är uppfyllt.

Till skillnad från Choice konkurrerar oberoende Noul-bedömningar inte med varandra.

Ett meddelande kan därför samtidigt ge:

```text
Innehåller underhållsärende → 0.98
Innehåller fakturaärende   → 0.99
```

Detta är användbart när flera egenskaper med rätta kan vara sanna samtidigt.

### Score — ”Hur mycket?”

Score placerar information på en ordnad semantisk skala.

Till exempel:

```text
0 — allmän informationsförfrågan
1 — mindre olägenhet
2 — betydande störning
3 — allvarlig pågående egendomsskada
4 — omedelbar fara för människor
```

Resultatet kan vara ett decimaltal eftersom det representerar en sannolikhetsviktad position över de definierade nivåerna.

En användbar tankemodell som utvecklades under projektet är:

```text
Choice = Vilken?
Noul   = Gäller detta?
Score  = Hur mycket?
```

Att välja rätt bedömningstyp är en del av att definiera problemet.

---

# 2. Nordbo Property — Kontrollerade experiment

De första experimenten använde ett fiktivt bostadsbolag som heter **Nordbo Property**.

Syftet var inte att bygga en klassificerare för produktion. Nordbo erbjöd en kontrollerad miljö där den förväntade betydelsen var känd i förväg.

De ursprungliga routingkategorierna var:

* Maintenance
* Billing
* Access
* Contract
* Other

## Grundläggande Choice-test

Tio avsiktligt enkla och varierade kundmeddelanden klassificerades.

Exemplen omfattade:

* ett trasigt element,
* dubbla hyresdebiteringar,
* en nyckel som inte öppnade entrén,
* uppsägning av hyresavtal,
* en orelaterad förfrågan om en mountainbike,
* irrelevant text runt ett verkligt problem,
* och instruktionsliknande text som försökte störa klassificeringen.

Resultat:

**10/10 matchade den förväntade kategorin.**

Detta visade att den grundläggande integrationen fungerade och att Jev kunde mappa tydliga meddelanden på naturligt språk till en avgränsad uppsättning routingalternativ.

Det fastställde **inte** någon generell klassificeringsnoggrannhet.

---

# 3. Det första viktiga problemet: Vad betyder ”primary”?

Nästa experiment introducerade meddelanden som innehöll mer än ett verkligt ärende.

Till exempel:

> My heating is broken and I was charged rent twice.

Jev valde:

```text
Maintenance  0.80
Billing      0.19
```

Omvänd ordning:

> I was charged rent twice and my heating is broken.

gav:

```text
Billing      0.80
Maintenance  0.19
```

Vid första anblicken såg detta ut som ett problem med ordningskänslighet.

Den viktiga upptäckten var att själva bedömningen bad Jev identifiera **”primary reason”**, det huvudsakliga skälet till kontakten.

Men systemet definierade aldrig vad *primary* betydde när två oberoende ärenden var lika verkliga.

Modellen behövde därför sluta sig till en regel som programvarans specifikation aldrig hade angett.

---

# 4. Kontrollerat prioritetsexperiment

I stället för att omedelbart behandla beteendet som ett modellfel upprepades experimentet med en uttrycklig affärsregel:

```text
Access
   ↓
Maintenance
   ↓
Billing
   ↓
Contract
   ↓
Other
```

Om flera kategorier passade instruerades Jev uttryckligen att välja den tillämpliga kategori som hade högst prioritet, oavsett ordningen i meddelandet.

Par med flera ärenden i omvänd ordning testades sedan igen.

Den starka ordningseffekten försvann till stor del.

Flera omvända par gav identiska fördelningar, medan ett annat endast skiljde sig med ungefär 0.01.

## Vad detta visade

Det ursprungliga resultatet var inte tillräckligt belägg för ett fel i Jev avseende ordningskänslighet.

Det fanns en mycket enklare förklaring:

**det semantiska kontraktet var underdefinierat.**

Detta gav en av de viktigaste lärdomarna från BizzJev:

> Ett typat resultat kan vara exakt samtidigt som den semantiska fråga som gav upphov till det är tvetydig.

Eller enklare uttryckt:

> Ett perfekt typat svar på en underdefinierad fråga innebär fortfarande ett underdefinierat system.

---

# 5. Noul — Att representera flera samtidiga sanningar

Samma exempel med värme och fakturering representerades sedan på ett annat sätt.

I stället för att fråga:

> Vilken kategori är detta?

ställdes två oberoende frågor:

```text
Innehåller detta meddelande ett Maintenance-ärende?

Innehåller detta meddelande ett Billing-ärende?
```

För:

> My heating is broken and I was charged rent twice.

var resultaten ungefär:

```text
Maintenance-ärende → 0.98
Billing-ärende     → 0.99
```

Efter att meningens ordning hade vänts:

```text
Maintenance-ärende → 0.99
Billing-ärende     → 0.99
```

Detta var bara ett litet utforskande test och bevisar inte generell ordningsinvarians.

Det visade däremot en viktig skillnad i modellering.

Den ursprungliga Choice-frågan tvingade två samtidigt giltiga egenskaper att konkurrera.

Noul-representationen tillät båda att finnas samtidigt.

Detta antyder en bredare designprincip:

> Innan en semantisk bedömning optimeras, kontrollera att resultatstrukturen representerar den verklighet som modelleras.

---

# 6. Score — Semantisk grad

Ett sista kontrollerat experiment testade Score utifrån hur brådskande kundärendet var.

Fem nivåer definierades uttryckligen, från:

```text
0 — ingen angiven konsekvens av att vänta
```

till:

```text
4 — omedelbar fara för människors säkerhet
```

Fem testmeddelanden konstruerades för att representera de fem nivåerna.

Resultaten var:

```text
Allmän informationsförfrågan           → 0.0
Mindre problem med skåphandtag         → 1.0
Avsaknad av varmvatten                → 2.0
Pågående läcka från ett brustet rör   → 3.0
Lägenhetsbrand / instängd person      → 4.0
```

Alla fem matchade den avsedda testnivån.

Även detta var ett kontrollerat experiment för att lära känna primitiverna, inte belägg för noggrannhet i produktion.

Värdet var begreppsmässigt: en semantisk dimension kunde beskrivas uttryckligen och returneras som ett typat numeriskt värde som lämpar sig för vanlig programlogik.

---

# 7. Från syntetiska tester till verkliga data

Kontrollerade exempel är användbara eftersom det förväntade svaret är känt.

De är också riskabla.

Om samma personer — eller språkmodeller — skapar både exemplen och de förväntade svaren kan en utvärdering främst visa överensstämmelse med sina egna antaganden.

BizzJev gick därför vidare till verkliga data från den amerikanska myndigheten Consumer Financial Protection Bureaus databas Consumer Complaint Database.

**Datasetets källa:** [CFPB Consumer Complaint Database Narratives Archive](https://www.consumerfinance.gov/foia-requests/foia-electronic-reading-room/cfpb-consumer-complaint-database-narratives-archive/), **CCDB Export July 2026**. Den lokala källfilen är `data/raw/cfpb/CCDB_Export_20_July_2026.csv`; [prepare_cfpb_debt_benchmark.py](../scripts/prepare_cfpb_debt_benchmark.py) förbereder den första benchmarkutvärderingen. [Rapporten om datamodell och taxonomi](CFPB_DATA_MODEL_AND_TAXONOMY.md) dokumenterar källan och hur dess etiketter ska tolkas.

**Separat dataset för demon:** Semantic Operations Lab för det fiktiva Nordbo Telecom levereras med [100 syntetiska kundmeddelanden och förväntade etiketter](../src/BizzJev.Lab/config/testcases.v1.json), inte CFPB-klagomål. En fullständig demoutvärdering inkluderar även eventuella användarfall som sparats lokalt, vars text kan ha ett annat ursprung. Resultaten från den syntetiska demomängden fastställer inte noggrannhet på verkliga kunddata.

Det valda området var **Debt collection** (inkasso).

Fyra CFPB-värden för `Issue` användes:

1. Attempts to collect debt not owed
2. Written notification about debt
3. False statements or representation
4. Took or threatened to take negative or legal action

En deterministisk förberedelseprocess tog bort exakta dubbletter av berättelser och uteslöt identiska berättelser som hade motstridiga Issue-etiketter.

Den första benchmarkutvärderingen innehöll 100 verkliga konsumentberättelser, balanserade till 25 exempel per Issue.

---

# 8. CFPB-baseline v1

Det första experimentet med verkliga data behandlade de fyra CFPB-värdena för Issue som semantiska kategorier.

Operationella definitioner skrevs för varje kategori, och Jev ombads identifiera det centrala klagomålet i varje berättelse.

Definitionerna försökte skilja mellan begrepp som:

* att bestrida att en skuld finns,
* att efterfråga saknad information för att styrka skulden,
* att hävda att någon uttryckligen lämnat en falsk uppgift,
* och att beskriva en hotad eller genomförd negativ åtgärd.

Bedömningsdefinitionen frystes före körningen.

Resultat:

**39/100 — 39% överensstämmelse med den CFPB Issue som konsumenten valt.**

Per kategori:

| CFPB Issue                                          | Överensstämmelse |
| --------------------------------------------------- | ---------------: |
| Attempts to collect debt not owed                    |             9/25 |
| Written notification about debt                      |            15/25 |
| False statements or representation                   |             8/25 |
| Took or threatened to take negative or legal action   |             7/25 |

Körningen slutfördes utan API-fel.

Vid denna punkt hade det varit frestande att dra slutsatsen:

> Jev uppnådde 39% klassificeringsnoggrannhet.

Den slutsatsen hade varit felaktig.

---

# 9. Utvärderingen ställde fel fråga

Den låga överensstämmelsen ledde till en undersökning av avvikelserna.

Undersökningen fokuserade inledningsvis på berättelsernas semantiska innehåll: om CFPB-etiketten eller Jevs val verkade beskriva texten bättre.

Detta blottlade i sig ett metodproblem.

Den kvalitativa analysen av avvikelserna utfördes av en annan språkmodell. Den var användbar för att formulera hypoteser, men kunde inte fungera som ett oberoende facit.

Den viktigare frågan blev:

> Hur skapades CFPB-värdet för `Issue` från början?

Projektet hade granskat etiketterna.

Det hade inte tillräckligt undersökt processen som skapade dem.

---

# 10. Att förstå CFPB:s datamodell

Dokumentationen för CFPB:s anmälningsprocess förändrade tolkningen av hela benchmarkutvärderingen.

Klagomålsprocessen ber konsumenten att först ange vad klagomålet gäller.

Konsumenten väljer sedan den problemtyp som bäst beskriver klagomålet ur den tillgängliga Issue/Sub-issue-strukturen.

Först därefter skriver konsumenten fritextberättelsen som beskriver vad som hände.

Begreppsmässigt:

```text
Konsumenten har ett problem
        ↓
Väljer Product / Sub-product
        ↓
Väljer en Issue / Sub-issue
        ↓
Skriver en fritextberättelse
```

CFPB-fältet `Issue` representerar därför en **Issue som konsumenten identifierat under en strukturerad anmälningsprocess**.

Det är inte en semantisk klass som CFPB tilldelat i efterhand genom att läsa berättelsen.

Denna skillnad är avgörande.

Den första benchmarkutvärderingen i BizzJev hade underförstått antagit:

```text
Berättelse
    ↓
Korrekt semantisk kategori
    ↓
CFPB Issue
```

Men data skapades snarare så här:

```text
Konsumentens förståelse av problemet
        ↓
Strukturerade CFPB-alternativ
        ↓
Konsumenten väljer Issue
        ↓
Konsumenten skriver senare sin berättelse
```

Det är olika samband.

---

# 11. Omtolkning av resultatet på 39%

Det ursprungliga resultatet på 39% är fortfarande giltigt.

Det som ändrats är vad siffran betyder.

Det fastställer **inte**:

> Jev förstod endast 39% av klagomålen semantiskt.

Det fastställer:

> Med BizzJevs första operationella definitioner valde Jev samma Issue som konsumenten tidigare hade valt i 39 av 100 fall.

Flera faktorer kan med goda skäl minska denna överensstämmelse:

* en konsument kan välja en oväntad kategori,
* flera problem kan förekomma i samma klagomål,
* konsumenten tvingas göra ett enda val,
* information som påverkar det strukturerade valet kanske aldrig nämns i den senare berättelsen,
* kategorier kan överlappa,
* och BizzJevs operationella definitioner kanske inte motsvarar taxonomin i CFPB:s anmälningsprocess.

Experimentet gav alltså ett användbart resultat — men inte det resultat som ursprungligen antogs.

---

# 12. Varför Sub-issue spelar roll

CFPB-datasetet innehåller också `Sub-issue`.

Det ger viktig strukturell information om betydelsen av de bredare överordnade Issue-kategorierna.

I stället för att hitta på en definition enbart utifrån en överordnad etikett som:

```text
Took or threatened to take negative or legal action
```

visar CFPB:s faktiska hierarki vilka mer specifika valbara problem som finns under denna Issue.

Det ger BizzJev en mycket starkare grund för att definiera det semantiska området.

Den viktiga lärdomen är:

> När du utvärderar mot en befintlig taxonomi bör du förstå taxonomins struktur och processen som skapar etiketterna innan du skriver den semantiska bedömningsdefinitionen.

Ett etikettnamn är inte i sig en specifikation.

---

# 13. Prediktion av konsumentvald CFPB Issue v1

En ny utvärderingsmetod har nu förberetts.

Efter deterministisk filtrering och borttagning av exakta dubbletter innehåller de fyra valda CFPB-kategorierna:

**2,021 unika klagomål som uppfyller urvalskraven.**

Fördelning:

| Issue                                               | Godkända fall |
| --------------------------------------------------- | ------------: |
| Attempts to collect debt not owed                    |         1,078 |
| Written notification about debt                      |           408 |
| False statements or representation                   |           349 |
| Took or threatened to take negative or legal action   |           186 |

Data har delats upp i:

```text
DESIGN
1,211 klagomål
~60%

TEST
810 klagomål
~40%
```

Uppdelningen är stratifierad efter både Issue och Sub-issue.

Varje representerad Sub-issue finns i både DESIGN och TEST.

Det finns ingen överlappning av exakt samma berättelser mellan de två mängderna.

## DESIGN

DESIGN-mängden får granskas.

Den finns för att förstå:

```text
CFPB Issue
    ↓
CFPB Sub-issue
    ↓
verkliga berättelser skrivna av konsumenter
```

Den får användas för att utforma och förfina Jev-bedömningen.

## TEST

TEST-mängden hålls undan på nivån enskilda berättelser.

Dess etiketter och sammanlagda fördelning finns i data, men enskilda testberättelser ska inte granskas när bedömningen utformas.

När bedömningen anses färdig kan den frysas och utvärderas mot dessa tidigare osedda fall.

Målmåttet är avsiktligt fortsatt snävt:

> **Överensstämmelse med konsumentvald CFPB Issue**

Det kallas inte semantisk noggrannhet.

---

# 14. Varför uppdelningen spelar roll även utan modellträning

BizzJev tränar inte Jev på dessa klagomål.

Det som utvecklas är den **semantiska specifikationen**.

Processen liknar begreppsmässigt validering inom maskininlärning:

```text
DESIGN-data
      ↓
Människor granskar exempel
      ↓
Utformar semantisk bedömning
      ↓
Experimenterar och förfinar
      ↓
Fryser bedömningen
      ↓
Undanhållna TEST-data
      ↓
Mäter generalisering
```

Utan en undanhållen mängd skulle de som utformar bedömningen gradvis kunna bygga in egenheter från de exempel de redan sett.

I praktiken kan själva prompten eller det semantiska kontraktet överanpassas.

Den undanhållna mängden testar om den slutliga specifikationen generaliserar bortom de fall som användes för att skapa den.

---

# 15. Nuvarande begränsningar i den undanhållna mängden

Den nuvarande uppdelningen är lämplig för fortsatt utveckling, men den är inte helt orörd.

Den tidigare baselinen med 100 fall kom från samma källmaterial.

Av dessa tidigare fall:

* hamnar 59 nu i DESIGN,
* hamnar 41 i TEST.

Några av dessa 41 fall exponerades därför indirekt under det tidigare experimentet.

Denna kontaminering dokumenteras i stället för att döljas.

Om BizzJev senare behöver en striktare slutlig benchmarkutvärdering kan en ny undanhållen mängd utesluta alla tidigare exponerade fall.

Det finns också risker med malltexter och nästan identiska berättelser i CFPB-data. Vissa klagomål har mycket likartade inledningar även efter att exakta dubbletter tagits bort.

Dessa fall har hittills dokumenterats i stället för att filtreras bort aggressivt.

Målet i detta skede är att förstå systemet innan en onödigt komplicerad benchmarkutvärdering konstrueras.

---

# 16. Vad experimenten har visat

Experimenten hittills stöder flera observationer.

### Typade semantiska bedömningar kan integreras naturligt med vanlig programvara

Resultatet kan användas som strukturerat programtillstånd i stället för genererad löptext.

### Den semantiska specifikationen har mycket stor betydelse

Att ändra ett underdefinierat begrepp som ”primary” till en uttrycklig affärsregel förändrade beteendet dramatiskt.

### Valet av primitiv ändrar frågans betydelse

Choice, Noul och Score är inte bara olika resultatformat.

De representerar olika semantiska frågor.

En verklighet med flera ärenden som representeras som en enda Choice kan skapa konkurrens som försvinner när den representeras som oberoende Noul-bedömningar.

### Confidence är inte korrekthet

En koncentrerad sannolikhetsfördelning beskriver bedömningens fördelning.

Den fastställer inte att det valda svaret är objektivt korrekt.

Flera CFPB-avvikelser hade starkt koncentrerade fördelningar.

### Datasetets etiketter måste förstås innan de behandlas som facit

CFPB-experimentet visade detta direkt.

En etiketts betydelse beror inte bara på dess namn utan på processen som skapade den.

### Utvärderingen kan misslyckas även när programvaran fungerar perfekt

Den första CFPB-körningen genomfördes precis som avsett.

API:et fungerade.

Dataprocessen fungerade.

Bedömningen returnerade giltiga typade resultat.

Mätvärdet beräknades korrekt.

Det djupare problemet var begreppsmässigt:

**experimentet missförstod inledningsvis vad dess målvariabel representerade.**

---

# 17. Möjliga användningsområden

Experimenten är fortfarande små, så följande åtskillnad är viktig.

## Visat i kontrollerade experiment

BizzJev har direkt undersökt:

* semantisk routing och klassificering,
* identifiering av flera oberoende semantiska egenskaper,
* semantisk poängsättning längs uttryckligen definierade dimensioner,
* typad integration av semantiska bedömningar i vanligt programflöde.

## Rimliga möjligheter som är värda att testa vidare

Arkitekturen antyder möjliga användningsområden inom:

* routing av supportärenden och arbetsflöden,
* första sortering och prioritering av dokument,
* semantisk validering,
* policy- eller avtalskontroller,
* extraktion av beslutsrelevanta egenskaper ur ostrukturerad text,
* prioritering utifrån semantiska kriterier,
* kvalitetskontrollgrindar,
* kontroller av konsekvens i tillstånd och minne,
* agentbaserade arbetsflöden där genererat innehåll måste omvandlas till avgränsade beslut.

Detta är möjliga användningsområden, inte påståenden om visad tillförlitlighet i produktion.

## När deterministisk kod fortfarande är att föredra

Jev ersätter inte vanlig programlogik.

Om ett beslut tillförlitligt kan uttryckas som:

```text
if x > 10:
    do_something()
```

är vanlig kod billigare, enklare att verifiera och deterministisk.

Den intressanta gränsen finns där programvara behöver resonera om betydelse som inte enkelt kan representeras med uttryckliga regler.

En användbar arkitektur kan därför vara:

```text
Ostrukturerad värld
        ↓
Semantisk bedömning
        ↓
Typat tillstånd
        ↓
Deterministisk programvara
```

---

# 18. Den större ingenjörsmässiga lärdomen

BizzJev började som ett experiment i att använda ett nytt AI-verktyg.

Det blev alltmer ett experiment i **semantisk gränssnittsdesign**.

Traditionell programvaruutveckling lägger mycket stor möda på att definiera gränssnitt mellan deterministiska komponenter:

```text
indatatyp
utdatatyp
felvillkor
tillståndsövergångar
kontrakt
```

Semantiska system kräver ytterligare ett lager:

```text
Vad exakt frågar vi efter?

Vilka åtskillnader finns bland svarsalternativen?

Kan flera svar vara sanna samtidigt?

Vilka belägg skiljer närliggande begrepp åt?

Hur skapades måletiketten ursprungligen?

Vad händer när verkligheten inte passar representationen?
```

Typsäkerhet kan begränsa resultatet.

Den kan inte definiera betydelsen åt oss.

Det förblir ett systemdesignproblem.

## Reflektion och utvärdering

Implementeringen av Jev API-integrationen genomfördes med hjälp av den officiella TypeSafe-skillen. Det var särskilt värdefullt eftersom Jev introducerar begrepp och interaktionsmönster som skiljer sig avsevärt från dem som vanligtvis används med konventionella LLM-API:er.

En viktig observation under utvecklingen var att den största svårigheten inte nödvändigtvis låg i själva API-koden. Det svårare problemet var att få de LLM-baserade utvecklingsverktygen att förstå Jevs syfte i applikationen och korrekt härleda hur Jev skulle användas för att lösa ett visst problem.

Med etablerade tekniker kan en LLM ofta härleda avsikten utifrån välbekanta arkitekturmönster och tidigare inlärda exempel. Med Jev verkade den intuitionen betydligt svagare i detta projekt. Modellen kunde förstå syntaxen för ett API-anrop men ändå missförstå vilket beslut Jev skulle fatta, vilken information som skulle ingå i anropet eller hur frågan till Jev skulle struktureras.

Detta blev särskilt tydligt när själva Jev-frågorna utformades. Små skillnader i hur en fråga, ett kriterium eller en beslutsregel formulerades kunde påtagligt förändra systemets beteende. Flera av dessa formuleringar behövde därför förfinas genom tester, snarare än att kodmodellen kunde härleda dem korrekt från en övergripande beskrivning.

Det innebär att förståelse inte kommer ”gratis” från en LLM. Den relevanta tankemodellen måste förmedlas genom specifikationer, exempel, uttryckliga begränsningar och skyddsräcken. Under längre implementationsuppgifter kan den förståelsen också glida, så att modellen gradvis återgår till mer välbekanta, konventionella LLM- eller API-mönster.

Utvecklingen med Jev blev därför i hög grad specifikationsdriven. Det var ofta nödvändigt att definiera inte bara vad applikationen skulle göra, utan också varför Jev användes, exakt vilket beslut Jev ansvarade för, hur beslutet skulle uttryckas som en fråga och vilka antaganden implementationen inte fick göra.

Tolkningen från detta projekt är att detta handlade mindre om svårigheter med att skriva Jev-kod och mer om följderna av att arbeta med en ny teknik där de LLM-baserade utvecklingsverktygen verkade ha begränsad etablerad implementationsintuition, få tidigare exempel och få inlärda designmönster att förlita sig på. Detta är en reflektion över utvecklingserfarenheten, inte en uppmätt jämförelse mellan kodmodeller eller belägg om deras träningsdata.

---

# 19. Nuvarande status

I detta skede:

* Har Choice, Noul och Score undersökts i kontrollerade tester.
* Har ordningskänslighet orsakad av en underdefinierad routingfråga isolerats experimentellt.
* Har en baseline med verkliga CFPB-data slutförts.
* Uppnådde baselinen **39% överensstämmelse med konsumentvald CFPB Issue**.
* Visade undersökningen att den ursprungliga benchmarkutvärderingen missförstod hur CFPB:s måletiketter skapades.
* Har CFPB:s Issue/Sub-issue-taxonomi och anmälningsprocess nu undersökts.
* Har 2,021 unika verkliga klagomål förberetts för ett omarbetat experiment.
* Utgör 1,211 fall DESIGN-mängden.
* Utgör 810 fall den undanhållna TEST-mängden.
* Har den nya Jev-bedömningen ännu inte utvärderats mot denna TEST-mängd.

Inget påstående om tillförlitlighet i produktion görs för närvarande.

---

# 20. Nästa steg

Nästa steg är avsiktligt enkelt.

Med enbart CFPB:s dokumentation, dess faktiska Issue/Sub-issue-taxonomi, DESIGN-mängden och TypeSafe/Jev-vägledning som underlag:

1. definiera den semantiska prediktionsuppgiften korrekt,
2. välj lämplig Jev-representation,
3. gör mappningen begriplig för en mänsklig granskare,
4. identifiera åtskillnader som fortfarande är underdefinierade,
5. frys bedömningen,
6. och utvärdera den först därefter mot den undanhållna TEST-mängden.

Den viktiga frågan är inte längre bara:

> ”Hur träffsäker är Jev?”

Den mer användbara frågan är:

> **När ett semantiskt problem är uttryckligt och korrekt definierat, hur tillförlitligt kan en typad semantisk bedömning generalisera till tidigare osedd verklig information?**

Det är den frågan BizzJev för närvarande försöker besvara.
