# CFPB CCDB export (21 Aug 2026) — full inspection counts

- Source: `data/raw/cfpb/CCDB_Export_21_August_2026.csv` (raw file untouched; analysis is read-only)
- Rows: 667140 | Columns: 16 | Date received range: 2026-08-01 .. 2026-08-31
- **Rows with non-empty narrative: 1** | without: 667139
- Verified twice (pandas + stdlib csv module): both count exactly 1 narrative row.
- The single narrative row is Complaint ID 25206546 (shown at bottom).

## Columns (in order)

Date received, Product, Sub-product, Issue, Sub-issue, Consumer complaint narrative, Company public response, Company, State, ZIP code, Tags, Submitted via, Date sent to company, Company response to consumer, Timely response?, Complaint ID

## Missing values per column (all rows)

| column | missing |
|---|---|
| Date received | 0 |
| Product | 0 |
| Sub-product | 0 |
| Issue | 0 |
| Sub-issue | 6651 |
| Consumer complaint narrative | 667139 |
| Company public response | 544042 |
| Company | 0 |
| State | 531 |
| ZIP code | 588 |
| Tags | 653242 |
| Submitted via | 0 |
| Date sent to company | 0 |
| Company response to consumer | 0 |
| Timely response? | 0 |
| Complaint ID | 0 |

## Product counts — all rows (11 unique)

| value | count |
|---|---|
| Credit reporting or other personal consumer reports | 619520 |
| Debt collection | 20398 |
| Credit card | 7996 |
| Checking or savings account | 7552 |
| Money transfer, virtual currency, or money service | 3093 |
| Mortgage | 2714 |
| Vehicle loan or lease | 2001 |
| Payday loan, title loan, personal loan, or advance loan | 1654 |
| Student loan | 1407 |
| Prepaid card | 491 |
| Debt or credit management | 314 |

## Issue counts — all rows (84 unique)

| value | count |
|---|---|
| Incorrect information on your report | 374109 |
| Problem with a company's investigation into an existing problem | 126539 |
| Improper use of your report | 115528 |
| Attempts to collect debt not owed | 10439 |
| Managing an account | 4555 |
| Written notification about debt | 3601 |
| Took or threatened to take negative or legal action | 3105 |
| Problem with a purchase shown on your statement | 2724 |
| False statements or representation | 2058 |
| Unable to get your credit report or credit score | 1940 |
| Problem with fraud alerts or security freezes | 1676 |
| Trouble during payment process | 1306 |
| Problem with a lender or other company charging your account | 1022 |
| Other features, terms, or problems | 976 |
| Getting a credit card | 947 |
| Closing an account | 934 |
| Fees or interest | 899 |
| Dealing with your lender or servicer | 893 |
| Struggling to pay mortgage | 877 |
| Fraud or scam | 832 |
| Credit monitoring or identity theft protection services | 806 |
| Problem when making payments | 677 |
| Communication tactics | 624 |
| Managing the loan or lease | 600 |
| Unauthorized transactions or other transaction problem | 599 |
| Opening an account | 576 |
| Closing your account | 562 |
| Repossession | 522 |
| Other transaction problem | 475 |
| Problem caused by your funds being low | 411 |
| Advertising and marketing, including promotional offers | 387 |
| Charged fees or interest you didn't expect | 369 |
| Electronic communications | 353 |
| Trouble using your card | 353 |
| Trouble accessing funds in your mobile or digital wallet | 342 |
| Problems at the end of the loan or lease | 341 |
| Problem with a company's investigation into an existing issue | 299 |
| Struggling to repay your loan | 261 |
| Struggling to pay your loan | 260 |
| Money was not available when promised | 252 |
| Applying for a mortgage or refinancing an existing mortgage | 229 |
| Managing, opening, or closing your mobile wallet account | 226 |
| Threatened to contact someone or share information improperly | 218 |
| Getting the loan | 202 |
| Getting a loan or lease | 192 |
| Closing on a mortgage | 182 |
| Problem with a purchase or transfer | 180 |
| Trouble using the card | 160 |
| Confusing or missing disclosures | 158 |
| Problem with additional add-on products or services | 149 |
| Struggling to pay your bill | 135 |
| Problem with the payoff process at the end of the loan | 117 |
| Unexpected or other fees | 110 |
| Other service problem | 107 |
| Problem getting a card or closing an account | 90 |
| Problem with customer service | 88 |
| Didn't provide services promised | 82 |
| Confusing or misleading advertising or marketing | 59 |
| Charged upfront or unexpected fees | 51 |
| Identity theft protection or other monitoring services | 48 |
| Lost or stolen money order | 33 |
| Can't stop withdrawals from your bank account | 33 |
| Unauthorized withdrawals or charges | 27 |
| Wrong amount charged or received | 27 |
| Getting a line of credit | 26 |
| Getting a loan | 26 |
| Can't contact lender or servicer | 23 |
| Received a loan you didn't apply for | 21 |
| Issues with repayment | 18 |
| Problem adding money | 11 |
| Loan payment wasn't credited to your account | 10 |
| Money was taken from your bank account on the wrong day or for the wrong amount | 10 |
| Was approved for a loan, but didn't receive the money | 9 |
| Problems receiving the advance | 8 |
| Vehicle was repossessed or sold the vehicle | 8 |
| Problem with cash advance | 7 |
| Overdraft, savings, or rewards features | 6 |
| Credit limit changed | 5 |
| Issue with income share agreement | 5 |
| Unexpected fees | 4 |
| Advertising | 4 |
| Issue where my lender is my school | 4 |
| Incorrect exchange rate | 2 |
| Was approved for a loan, but didn't receive money | 1 |

## Product -> Issue counts — all rows

| Product | Issue | count |
|---|---|---|
| Credit reporting or other personal consumer reports | Incorrect information on your report | 373198 |
| Credit reporting or other personal consumer reports | Problem with a company's investigation into an existing problem | 126172 |
| Credit reporting or other personal consumer reports | Improper use of your report | 115443 |
| Debt collection | Attempts to collect debt not owed | 10439 |
| Checking or savings account | Managing an account | 4555 |
| Debt collection | Written notification about debt | 3601 |
| Debt collection | Took or threatened to take negative or legal action | 3105 |
| Credit card | Problem with a purchase shown on your statement | 2724 |
| Debt collection | False statements or representation | 2058 |
| Credit reporting or other personal consumer reports | Unable to get your credit report or credit score | 1930 |
| Credit reporting or other personal consumer reports | Problem with fraud alerts or security freezes | 1660 |
| Mortgage | Trouble during payment process | 1306 |
| Checking or savings account | Problem with a lender or other company charging your account | 1022 |
| Credit card | Other features, terms, or problems | 976 |
| Credit card | Getting a credit card | 947 |
| Checking or savings account | Closing an account | 934 |
| Credit card | Fees or interest | 899 |
| Student loan | Dealing with your lender or servicer | 893 |
| Mortgage | Struggling to pay mortgage | 877 |
| Money transfer, virtual currency, or money service | Fraud or scam | 832 |
| Credit reporting or other personal consumer reports | Credit monitoring or identity theft protection services | 770 |
| Debt collection | Communication tactics | 624 |
| Vehicle loan or lease | Managing the loan or lease | 600 |
| Money transfer, virtual currency, or money service | Unauthorized transactions or other transaction problem | 599 |
| Checking or savings account | Opening an account | 576 |
| Credit card | Closing your account | 562 |
| Vehicle loan or lease | Repossession | 522 |
| Money transfer, virtual currency, or money service | Other transaction problem | 475 |
| Credit card | Incorrect information on your report | 415 |
| Checking or savings account | Problem caused by your funds being low | 411 |
| Credit card | Advertising and marketing, including promotional offers | 387 |
| Payday loan, title loan, personal loan, or advance loan | Charged fees or interest you didn't expect | 369 |
| Credit card | Problem when making payments | 368 |
| Debt collection | Electronic communications | 353 |
| Credit card | Trouble using your card | 353 |
| Money transfer, virtual currency, or money service | Trouble accessing funds in your mobile or digital wallet | 342 |
| Vehicle loan or lease | Problems at the end of the loan or lease | 341 |
| Payday loan, title loan, personal loan, or advance loan | Problem when making payments | 309 |
| Credit reporting or other personal consumer reports | Problem with a company's investigation into an existing issue | 299 |
| Student loan | Struggling to repay your loan | 261 |
| Money transfer, virtual currency, or money service | Money was not available when promised | 252 |
| Mortgage | Applying for a mortgage or refinancing an existing mortgage | 229 |
| Money transfer, virtual currency, or money service | Managing, opening, or closing your mobile wallet account | 226 |
| Debt collection | Threatened to contact someone or share information improperly | 218 |
| Payday loan, title loan, personal loan, or advance loan | Getting the loan | 202 |
| Vehicle loan or lease | Getting a loan or lease | 192 |
| Mortgage | Closing on a mortgage | 182 |
| Prepaid card | Problem with a purchase or transfer | 180 |
| Credit card | Problem with a company's investigation into an existing problem | 178 |
| Prepaid card | Trouble using the card | 160 |
| Payday loan, title loan, personal loan, or advance loan | Struggling to pay your loan | 159 |
| Student loan | Incorrect information on your report | 155 |
| Vehicle loan or lease | Incorrect information on your report | 152 |
| Payday loan, title loan, personal loan, or advance loan | Problem with additional add-on products or services | 149 |
| Credit card | Struggling to pay your bill | 135 |
| Payday loan, title loan, personal loan, or advance loan | Problem with the payoff process at the end of the loan | 117 |
| Money transfer, virtual currency, or money service | Other service problem | 107 |
| Vehicle loan or lease | Struggling to pay your loan | 101 |
| Prepaid card | Problem getting a card or closing an account | 90 |
| Debt or credit management | Confusing or missing disclosures | 88 |
| Payday loan, title loan, personal loan, or advance loan | Incorrect information on your report | 87 |
| Debt or credit management | Didn't provide services promised | 82 |
| Mortgage | Incorrect information on your report | 81 |
| Vehicle loan or lease | Problem with a company's investigation into an existing problem | 60 |
| Money transfer, virtual currency, or money service | Confusing or missing disclosures | 59 |
| Prepaid card | Unexpected or other fees | 57 |
| Money transfer, virtual currency, or money service | Unexpected or other fees | 53 |
| Debt or credit management | Charged upfront or unexpected fees | 51 |
| Money transfer, virtual currency, or money service | Problem with customer service | 50 |
| Credit reporting or other personal consumer reports | Identity theft protection or other monitoring services | 48 |
| Student loan | Problem with a company's investigation into an existing problem | 43 |
| Credit card | Improper use of your report | 38 |
| Debt or credit management | Problem with customer service | 38 |
| Payday loan, title loan, personal loan, or advance loan | Problem with a company's investigation into an existing problem | 35 |
| Payday loan, title loan, personal loan, or advance loan | Can't stop withdrawals from your bank account | 33 |
| Money transfer, virtual currency, or money service | Lost or stolen money order | 33 |
| Mortgage | Problem with a company's investigation into an existing problem | 30 |
| Debt or credit management | Confusing or misleading advertising or marketing | 28 |
| Debt or credit management | Unauthorized withdrawals or charges | 27 |
| Money transfer, virtual currency, or money service | Wrong amount charged or received | 27 |
| Payday loan, title loan, personal loan, or advance loan | Getting a line of credit | 26 |
| Student loan | Getting a loan | 26 |
| Payday loan, title loan, personal loan, or advance loan | Can't contact lender or servicer | 23 |
| Vehicle loan or lease | Improper use of your report | 22 |
| Payday loan, title loan, personal loan, or advance loan | Received a loan you didn't apply for | 21 |
| Checking or savings account | Problem with a company's investigation into an existing problem | 21 |
| Checking or savings account | Incorrect information on your report | 21 |
| Money transfer, virtual currency, or money service | Confusing or misleading advertising or marketing | 19 |
| Payday loan, title loan, personal loan, or advance loan | Issues with repayment | 18 |
| Payday loan, title loan, personal loan, or advance loan | Confusing or misleading advertising or marketing | 12 |
| Money transfer, virtual currency, or money service | Problem adding money | 11 |
| Student loan | Improper use of your report | 11 |
| Payday loan, title loan, personal loan, or advance loan | Confusing or missing disclosures | 11 |
| Payday loan, title loan, personal loan, or advance loan | Loan payment wasn't credited to your account | 10 |
| Payday loan, title loan, personal loan, or advance loan | Money was taken from your bank account on the wrong day or for the wrong amount | 10 |
| Credit card | Credit monitoring or identity theft protection services | 10 |
| Payday loan, title loan, personal loan, or advance loan | Credit monitoring or identity theft protection services | 9 |
| Payday loan, title loan, personal loan, or advance loan | Was approved for a loan, but didn't receive the money | 9 |
| Payday loan, title loan, personal loan, or advance loan | Vehicle was repossessed or sold the vehicle | 8 |
| Payday loan, title loan, personal loan, or advance loan | Problems receiving the advance | 8 |
| Payday loan, title loan, personal loan, or advance loan | Problem with cash advance | 7 |
| Checking or savings account | Improper use of your report | 6 |
| Money transfer, virtual currency, or money service | Overdraft, savings, or rewards features | 6 |
| Vehicle loan or lease | Credit monitoring or identity theft protection services | 6 |
| Payday loan, title loan, personal loan, or advance loan | Credit limit changed | 5 |
| Vehicle loan or lease | Problem with fraud alerts or security freezes | 5 |
| Payday loan, title loan, personal loan, or advance loan | Improper use of your report | 5 |
| Student loan | Issue with income share agreement | 5 |
| Payday loan, title loan, personal loan, or advance loan | Unexpected fees | 4 |
| Student loan | Issue where my lender is my school | 4 |
| Payday loan, title loan, personal loan, or advance loan | Unable to get your credit report or credit score | 4 |
| Prepaid card | Advertising | 4 |
| Mortgage | Credit monitoring or identity theft protection services | 4 |
| Student loan | Credit monitoring or identity theft protection services | 4 |
| Checking or savings account | Problem with fraud alerts or security freezes | 3 |
| Mortgage | Improper use of your report | 3 |
| Checking or savings account | Credit monitoring or identity theft protection services | 3 |
| Student loan | Problem with fraud alerts or security freezes | 3 |
| Payday loan, title loan, personal loan, or advance loan | Problem with fraud alerts or security freezes | 3 |
| Credit card | Unable to get your credit report or credit score | 2 |
| Credit card | Problem with fraud alerts or security freezes | 2 |
| Money transfer, virtual currency, or money service | Incorrect exchange rate | 2 |
| Mortgage | Unable to get your credit report or credit score | 2 |
| Student loan | Unable to get your credit report or credit score | 2 |
| Payday loan, title loan, personal loan, or advance loan | Was approved for a loan, but didn't receive money | 1 |

## Product counts — rows WITH narrative

| value | count |
|---|---|
| Credit reporting or other personal consumer reports | 1 |

## Issue counts — rows WITH narrative

| value | count |
|---|---|
| Problem with a company's investigation into an existing problem | 1 |

## Product -> Issue counts — rows WITH narrative

| Product | Issue | count |
|---|---|---|
| Credit reporting or other personal consumer reports | Problem with a company's investigation into an existing problem | 1 |

## Rows with narratives — full field dump

### Complaint ID 25206546

- Product: Credit reporting or other personal consumer reports
- Sub-product: Credit reporting
- Issue: Problem with a company's investigation into an existing problem
- Sub-issue: Their investigation did not fix an error on your report
- Narrative: They claim on my credit report that this item is charged off, however I make timely payments on the account. Each payment I make extends the negative report time frame. Am I better off, just NOT paying these liars?
