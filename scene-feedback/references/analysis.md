# Analyze collected responses

Read [CSV fields and response statuses][csv] and the guide's [Reading the CSV][reading]
before interpreting exports. Apply their rules for test data, participation, skips, text
answers, scale meaning, comparability, and limits of conclusions.

Use the supplied goal; clarify only context that changes interpretation. Without a specific
goal, begin with an overview of recurring experiences and questions to investigate.

- Obtain relevant CSV parts, note coverage, and deduplicate repeated exports by response `id`.
  If exports are missing, use [Review][review] to explain retrieval.
- Report response counts and distinct respondents; repeated answers are not independent
  players. Keep addresses out of the readout. Absent rows do not prove a question was shown.
- Compare versions or platforms where relevant, checking wording, question order/context,
  timing, and recruitment (including invitation eligibility, route, and incentive terms)
  before treating playtests as comparable. Keep differently recruited runs identifiable;
  survey opt-in does not establish enjoyment. Summarize comment themes with representative
  excerpts and preserve conflicting experiences.
- Return coverage/exclusions, findings tied to the goal, uncertainty, and what to inspect
  or change next. Suggest a comparable follow-up test; distinguish evidence from hypotheses.

For theme synthesis in any output format, including coverage, denominators, overlap, and
traceability, read [shared synthesis](analysis-patterns.md#find-patterns-without-losing-the-answers).
For conflicting answers or cohort differences, consult
[investigative patterns](analysis-patterns.md) for useful lines of inquiry.

When analyzing CSV, explicitly offer an optional, self-contained HTML readout with grouped
answers and supporting evidence, unless the creator has already chosen an output format.
Continue the analysis while they decide; create HTML when they choose it. For HTML, read
[Adaptive HTML feedback readout](html-readout.md) and choose views from the data
and goal rather than imposing a dashboard.

[review]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#4-review
[csv]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md#stored-csv
[reading]: https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/QUESTION_GUIDE.md#reading-the-csv
