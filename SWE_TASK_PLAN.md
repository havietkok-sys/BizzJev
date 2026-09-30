# BizzJev svenska/engelska — arbetsplan

Status: språkfunktionen och den parade svensk/engelska batchutvärderingen är implementerade och verifierade.

## Lägesbild och handover

- **Nu:** 01–11 är klara. Den parade 100 + 100-körningen och rapporten är sparade under `data/results/swedish-language-evaluation-20260930/`.
- **Next:** Ingen ytterligare språkjustering är planerad. Nya ändringar kräver ett konkret verksamhetsmål eller en mätbar felkostnad.
- **Testansvar:** Implementerande agent kör lokala flödestester och redovisar kommandon/resultat. Livebatchen ska ha ett explicit tak och redovisa verkliga utgående försök.
- **Handover-format:** `Done: <ID + vad som ändrades>`. `Test: <kommandon och resultat, eller exakt varför ej kört>`. `Next: <nästa ID och konkret första steg>`. `Risk/blocker: <endast om något återstår>`.
- **Arbetsregel:** Markera ett moment som Done först när dess delmoment, kontroll och handover är klara. Skriv inte Done enbart för att kod har lagts till.

### Baslinje före implementation (2026-09-30)

- `npm run build` i `web/lab`: godkänd.
- `dotnet test src/BizzJev.Lab.Tests/BizzJev.Lab.Tests.csproj --no-restore -c Release`: 165 godkända, 0 misslyckade.
- Debug-körningen kunde inte kopiera `BizzJev.Lab.exe` eftersom den används av en annan process. Release-körningen gav en fungerande, separat testbaslinje. Ingen process stoppades.
- Detta verifierar nuvarande kod och testkommandon. Språkflödet kontrolleras när moment 01–09 är implementerade.

### Handover-logg

- **Done 01:** Kontraktet nedan anger språkfält, default, versionsspårning och senarelagd batch. **Test:** dokumentgranskning mot båda befintliga API-flödena. **Next:** integrera UI och backend enligt kontraktet.
- **Done 03:** Svenska instruktioner/kriterier för elva gates (`v1-sv`) och svensk visningsmetadata. **Test:** falsk HTTP-transport kontrollerar frågeobjektet; gate-spårets fokustest 12/12. **Next:** färdigställ Gate Studio-flödet i 04.
- **Done 05–06:** Svenska Pipeline-frågor (`pipeline-sv-v1`), språkstyrd definition/analys/replay och språk i historik. **Test:** fokustest 43/43; replay utan Jev-anrop; keyless historikläsning kontrolleras separat. **Next:** färdigställ Pipeline-vyn i 08 och kör sammanhållet flödestest.
- **Done 02, 07–09:** Språkväxlare, översikt, analys, Pipeline, Gate Studio, bibliotek, hjälp och tekniska vyer fungerar på båda språken. Sparade testfall och historik hålls isär per språk. **Test:** frontend-build godkänd och båda språken manuellt genomgångna i den lokalt serverade appen. **Next:** sammanhållen slutkontroll.
- **Done 10:** README/startguide uppdaterade, frontend-bundle inlagd i backend och flödet kontrollerat utan liveanrop. **Test:** 170/170 backendtester, frontend-build, Pipeline-textkontroll och lokala HTTP-kontroller godkända. **Risk:** svensk semantisk träffsäkerhet är ännu inte mätt i batch.
- **Done 11:** Ett låst svenskt 100-fallsdataset parades med den engelska baslinjen och kördes med exakt 100 + 100 Jev-anrop utan retries. **Test:** 172/172 backendtester, frontend-build, 200/200 registrerade utgående försök och 0 API-fel. **Resultat:** svensk/engelsk makro-F1 82,6/84,0 %, mikro-F1 84,3/85,4 %, exakt fallträff 35/35 %. **Beslut:** svenskstödet är godkänt; inga generella promptändringar planeras.

## Mål och ramar

En språkväxlare låter användaren välja svenska eller engelska. Valet styr all synlig UI-text, demoexempel och de frågor/kriterier som backend skickar till Jev i både vanliga gate-analyser och Decision Pipeline. Resultat, historik och utvärderingar visar vilket språk och vilken definitionsversion som användes.

- Engelska är standard för befintliga installationer och historiska resultat utan språkfält.
- `gateId`, API-fältnamn, Choice-värden (`Technical`, `Billing` osv.), policyns trösklar och interna felkoder är stabila. Deras visade etiketter översätts.
- Befintliga engelska definitioner och mätresultat behålls. Svenska frågor får en egen versionsidentitet; vi hävdar inte att en översättning har samma träffsäkerhet.
- Språk i kundtexten gissas inte automatiskt. Användaren väljer språkläge; både svenska och engelska texter ska kunna analyseras i båda lägena.
- Inga nya paket behövs för två språk.

## Språk- och versionskontrakt (01)

- Språkkoderna är exakt `en` och `sv`. Saknat språk betyder `en`, även för befintliga sparade poster. Annan kod ger HTTP 400 med tydligt fel; ingen tyst fallback.
- GET-anrop som hämtar definitioner, gates eller historik använder `?language=sv`. POST-anrop som kör analys, gate-utkast eller replay har `"language":"sv"` i JSON-kroppen. Exempel: `POST /api/analyze` med `{"customerText":"...","language":"sv"}` och `POST /api/decision-pipeline/analyze` med samma fält.
- Svar för gates/definition, analys, replay och sparad körning anger `language` samt relevant `gateSetVersion`, `promptVersion` eller `semanticVersion`. UI visar körningens språk från svaret även om användaren byter gränssnittsspråk efteråt.
- Engelska behåller befintliga Jev-frågor. Svenska har egna versionssatta definitioner. `gateId`, Choice-nycklar och policyns maskinläsbara värden ändras inte; bara frågetexterna och UI-etiketterna lokaliseras.
- Replay väljer definition utifrån sparat språk och kräver matchande `semanticVersion`; ingen Jev-begäran görs. Äldre replay-kropp utan språk tolkas som engelska.
- Historik över båda språk kan visas, men jämförelse får bara göras inom samma språk/definitionsfamilj. Full utvärdering och `draft-evaluate` använder det valda språkets dataset.
- Sparade manuella testfall märks med språk; äldre fall utan språk är engelska. Batchkörningar läser endast fall med valt språk.

## Arbetsmoment

Varje moment är en liten, granskningsbar ändring med egen kontroll. `Beroende` anger vad som måste vara klart först. Moment utan inbördes beroende kan göras parallellt i separata agentuppgifter eller commits, men ändringar i samma fil integreras sekventiellt.

| ID | Moment | Berör främst | Beroende | Klar när |
|---|---|---|---|---|
| 01 | **Kontrakt och versionsregler.** Bestäm `en`/`sv`, default, vilka API-anrop som tar språk, hur svar/historik märks och hur gamla poster tolkas. Dokumentera skillnaden mellan visad översättning och text skickad till Jev. | `web/lab/src/api.ts`, backend-modeller/API, denna plan | – | Ett kort kontrakt och konkreta exempel för analys, replay, historik och felaktig språkkod finns. |
| 02 | **Språkväxlarens grund.** Lagra valt språk lokalt, sätt sidans `lang`, visa ett tillgängligt val i apphuvudet och ge komponenter en liten gemensam textfunktion. | `App.tsx`, gemensam UI-kod | 01 | Valet lever kvar efter omladdning och fungerar med tangentbord/skärmläsare. |
| 03 | **Svenska Noul-gater.** Översätt samtliga Jev-sända `instructions` och `criteria` i gate-definitionerna. Ge svensk uppsättning egen version; behåll ID, trösklar och engelska original. | `config/gates.v1.json`, `GateStore`, `JevGateClient` | 01 | Vald uppsättning ger faktiskt svenska frågor i utgående Jev-payload; engelskt läge ger samma payload som tidigare. |
| 04 | **Gate-API och Gate Studio.** För språk genom analys, definitioner, versioner, aktiv gate, utkasttest och utvärdering. Lokala gate-versioner hålls åtskilda per språk så redigering på svenska inte ändrar engelska frågor. | `Program.cs`, `GateStore.cs`, `GateStudio.tsx`, `api.ts` | 02, 03 | Visad/redigerad definition är den som skickas till Jev; byte av språk förväxlar inte osparade utkast eller aktiva versioner. |
| 05 | **Svenska Decision Pipeline-frågor.** Översätt Choice-instruktioner och kriterier, Score-instruktioner och nivåbeskrivningar samt Noul-instruktioner och kriterier. Behåll Choice-nycklarna som policy och validering kräver. | `config/decision-pipeline.v1.json`, ny svensk definition, `PipelineModels.cs` | 01 | Den svenska frågeuppsättningen är fullständig, valideras och har egen semanticVersion; de tre frågorna går i ett anrop. |
| 06 | **Pipeline-API, replay och historik.** Välj definition på servern från explicit språk i anropet, returnera språk/version och bind replay till rätt version. Sparade körningar visar vilken definition som användes. | `DecisionPipelineEndpoints.cs`, klient/modeller, eval-endpoints | 05 | Replay använder sparade svar utan Jev-anrop; fel version avvisas tydligt; äldre engelska körningar fungerar. |
| 07 | **Översikt och analysvy.** Översätt navigation, översikt, analys, delade etiketter och svenska exempel. Skicka språket i analysanrop och markera resultatets faktiska språk vid byte efter körning. | `Overview.tsx`, `AnalyzeScreen.tsx`, `examples.ts`, delade komponenter | 02, 04 | Hela enkla demoflödet fungerar på båda språken; språkbyte översätter inte ett gammalt resultat som om det körts om. |
| 08 | **Pipeline-vy och hjälpinnehåll.** Översätt flöde, nivåer, förklaringar, fel och hjälptexter; visa interna Choice/Score-värden med lokaliserade etiketter utan att ändra rådata. | `DecisionPipeline.tsx`, `help/*`, delade komponenter | 02, 06 | Båda språken är begripliga i analys, policy, replay och teknisk vy; rå JSON visar exakt anrop och svar. |
| 09 | **Bibliotek och resterande Gate Studio.** Översätt resterande UI och proveniens. Skilj engelska och svenska sparade körningar i filter och jämförelser; blanda inte språk i samma resultatserie. | `LibraryScreen.tsx`, `GateStudio.tsx`, eval-kod | 04, 06, 07, 08 | Alla vyer täcks och historiska körningar visar språk och version. |
| 10 | **Flödestest och dokumentation.** Uppdatera startguide/README, kör frontend-build och backend-tester, gör manuellt språkbyte i varje vy och kontrollera utgående payload. | tester, `README.md`, `docs/` | 03–09 | Lokala tester och ett komplett flöde per språk passerar; större batchutvärdering är uttryckligen uppskjuten. |

## Delmoment och Done

### 01 — Kontrakt och versionsregler
- [x] Dokumentera `en`/`sv`, default, ogiltigt språk och format för API-anrop/svar.
- [x] Bestäm hur språk + definitionsversion följer med sparade resultat, replay och gamla poster.
- [x] **Done:** Kontraktsexempel kan användas direkt för både gate- och Pipeline-flöde.

### 02 — Språkväxlarens grund
- [x] Skapa valt språk och lagring utan nytt paket; sätt dokumentets `lang`.
- [x] Lägg till åtkomlig språkväxlare och gemensam uppslagning av UI-text.
- [x] **Done:** Språkvalet överlever omladdning och styr minst navigationen i båda lägena.

### 03 — Svenska Noul-gater
- [x] Översätt samtliga Jev-sända instruktioner och kriterier; ge dem svensk version.
- [x] Kontrollera exakt utgående frågeobjekt för `en` och `sv` utan liveanrop.
- [x] **Done:** Varje gate använder rätt språk; engelska payloaden är oförändrad.

### 04 — Gate-API och Gate Studio
- [x] För språk genom analys, gate-lista, versioner, utkasttest och sparande.
- [x] Håll lokala versioner och aktiva val åtskilda per språk.
- [x] **Done:** Ett svenskt utkast kan testas/sparas utan att ändra den engelska gaten.

### 05 — Svenska Decision Pipeline-frågor
- [x] Översätt Choice, Score och Noul fullständigt; behåll stabila svarsvärden.
- [x] Ge svensk definition egen `semanticVersion` och validera formen lokalt.
- [x] **Done:** Alla tre svenska frågorna byggs i ett korrekt Jev-anrop.

### 06 — Pipeline-API, replay och historik
- [x] Välj definition från explicit språk och returnera språk/version i resultatet.
- [x] Koppla replay och sparade körningar till rätt definitionsversion.
- [x] **Done:** Replay gör noll Jev-anrop och fel version avvisas; äldre poster kan läsas.

### 07 — Översikt och analysvy
- [x] Översätt navigation, översikt, analys och svenska demoexempel.
- [x] Skicka valt språk och märk resultat med körningens faktiska språk/version.
- [x] **Done:** Ett sammanhängande enkelt demoflöde fungerar på båda språken.

### 08 — Pipeline-vy och hjälp
- [x] Översätt synliga texter, hjälpartiklar och resultatsammanhang.
- [x] Visa lokaliserade etiketter medan rådata och teknisk vy förblir exakta.
- [x] **Done:** Analys → policy → replay går att följa i båda språken.

### 09 — Bibliotek och Gate Studio
- [x] Översätt återstående UI, felmeddelanden och proveniens.
- [x] Visa/filtera historik enligt språk och version; förhindra blandade jämförelser.
- [x] Spara och filtrera manuella testfall per språk så svensk text inte hamnar i engelsk batch.
- [x] **Done:** Alla vyer täcks och gamla engelska resultat kan fortfarande öppnas.

### 10 — Flödestest och dokumentation
- [x] Kör frontend-build och relevanta befintliga backend-tester.
- [x] Kör små lokala kontraktstester: `en`/`sv`, ogiltigt språk, rätt payload, sparande och replay.
- [x] Kontrollera manuellt båda språkens hela UI-flöde; dokumentera kommandon och utfall.
- [x] Uppdatera README/startguide och skriv handover med kvarstående semantisk osäkerhet.
- [x] **Done:** Flödet är verifierat utan att köra en stor batch eller hävda svensk träffsäkerhet.

### 11 — parad batchutvärdering
- [x] Översätt och lås 100 svenska syntetiska testfall med parade ID och identiska förväntade etiketter.
- [x] Kör exakt 100 engelska + 100 svenska liveanrop utan retries eller lokalt sparade extrafall.
- [x] Skapa en fristående HTML-rapport, sammanfattande JSON, CSV och spara båda råresultaten.
- [x] **Done:** 200 utgående försök, 0 API-fel och rapporten visuellt kontrollerad.
- [x] **Done:** Resultatet är bedömt som tillräckligt stabilt inom domänen; framtida ändringar kräver ett konkret verksamhetsmål eller en mätbar felkostnad.

## Rekommenderad ordning och arbetsdelning

1. Gör **01–02** först: kontraktet och språkvalet sätter formen för resten.
2. Därefter kan **03–04** (Noul-gater) och **05–06** (Decision Pipeline) arbetas separat. Samma API-/modellfiler kräver en tydlig integrationspunkt efteråt.
3. **07** och **08** kan delas mellan UI-arbeten när respektive backendflöde är klart. **09** tar de vyer och datamängder som beror på båda.
4. Avsluta med **10** och en sammanhållen granskning av svenska och engelska från start till sparat resultat.

## Kontrollfall som måste överleva hela arbetet

- `en` utan tidigare sparat språk beter sig som dagens app och skickar oförändrade engelska frågor.
- `sv` skickar svenska `instructions` och `criteria` för alla valda gates respektive alla tre Pipeline-frågor, i rätt struktur.
- Språkbyte efter en analys ändrar UI-språk men märker fortsatt resultatet med språket och versionen från körningen.
- Ogiltigt språk ger ett tydligt klientfel och leder aldrig tyst till fel frågeuppsättning.
- Gate Studio sparar/versionerar inom rätt språk; replay och utvärdering använder rätt definition utan att blanda gamla resultat.
- Bygg- och kontraktstester kräver inga liveanrop. Den separata livejämförelsen är sparad med råresultat och verkligt anropsantal.
