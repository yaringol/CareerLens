# CareerLens — Verified Literature Dossier (M17)

**Purpose:** Raw material for the project book's Literature Review chapter (written in M09). Each source below is mapped to a *verified* CareerLens component (per the M17 kickoff architecture audit, 2026-07-20), with an explicit relevance statement and a book-placement recommendation.

**Date:** 2026-07-20

**Verification statement:** Every source in this dossier was verified on 2026-07-20 by fetching its authoritative page (ACL Anthology, arXiv abstract page, publisher page, dblp record, Semantic Scholar API record, or — for the industry report — the publisher's own PDF) and confirming the exact title, authors, year, and venue. No source is cited from memory. Sources that could not be fetched and confirmed were discarded. The "Verified:" line under each entry names the page(s) actually fetched.

**System components referenced below** (verified against the live artifacts):
- **Model 2 (CV→job-title):** TF-IDF + MLPClassifier(256) over 59 classes + `__other__`; beat a Logistic-Regression baseline (62.3% vs 57.6% accuracy).
- **Title normalization:** SBERT `all-MiniLM-L6-v2` embeddings + nearest-centroid over 59 canonical titles (92.6% held-out).
- **Skill extraction:** SkillNer (spaCy-based) with its built-in EMSI/Lightcast-derived SKILL_DB (31,278 skills); ESCO/O*NET as taxonomy background only.
- **Model 1 (title→skills):** statistical aggregation of extracted skills per role with IDF-based specificity and recency weighting (no gradient training).
- **Scoring agent:** LLM-as-a-judge — `gpt-4o-mini` scores each of 10 skills 1–10 against the CV; global match score.
- **Data-leakage experiment:** 77% of training CVs contained the job title verbatim; scrubbing dropped F1 0.981 → 0.932.

---

## Topic 1 — ATS and resume screening: efficacy, bias, rejection rates

### [1] J. B. Fuller, M. Raman, E. Sage-Gavin, and K. Hines, *Hidden Workers: Untapped Talent*, white paper, Harvard Business School Project on Managing the Future of Work and Accenture, Sep. 2021.

- **Verified URL:** https://www.hbs.edu/managing-the-future-of-work/research/Pages/hidden-workers-untapped-talent.aspx (report page); full PDF: https://www.hbs.edu/ris/Publication%20Files/hiddenworkers09032021_Fuller_white_paper_33a2047f-41dd-47b1-9a8d-bd08cf3bfa94.pdf
- **Verified:** HBS project page fetched; full 74-page PDF downloaded and text-extracted — title page, author list, and the statistics below confirmed directly from the primary document (pp. 5, 22, 28).
- **Summary:** A two-year Harvard Business School / Accenture study (surveying 8,720 "hidden workers" and 2,275 executives in the US, UK, and Germany) on how automated hiring technology systematically excludes qualified candidates. Employers report using a Recruitment Management System (RMS) to initially filter or rank potential middle-skills (94%) and high-skills (92%) candidates. A large majority — 88% of employers — acknowledge that qualified *high-skills* candidates are vetted out of the process because they do not match the exact criteria established by the job description; the figure rises to 94% for middle-skills workers. The excluded populations (caregivers, veterans, immigrants, workers with non-linear careers) perform at or above the level of traditionally sourced hires when actually employed.
- **Relevance to CareerLens:** This is the primary citable evidence for the project's core problem statement — that candidates are rejected by keyword/criteria filters over *phrasing*, not ability. It directly motivates the whole product (CV-vs-JD analysis, the Improve flow that rewrites the CV against the target role's skills) and provides the hard numbers the original spec asserted without a source.
- **Book placement:** Ch.1 Background (problem statement, with the 88%/94% figures) + opening of Ch.2 Literature Review.

### [2] M. Raghavan, S. Barocas, J. Kleinberg, and K. Levy, "Mitigating bias in algorithmic hiring: Evaluating claims and practices," in *Proc. 2020 Conf. on Fairness, Accountability, and Transparency (FAT\* '20)*, Barcelona, Spain, 2020, pp. 469–481, doi: 10.1145/3351095.3372828.

- **Verified URL:** https://arxiv.org/abs/1906.09208 (ACM DL record: https://dl.acm.org/doi/10.1145/3351095.3372828)
- **Verified:** arXiv abstract page fetched (title, authors, ACM DOI); venue and pages 469–481 confirmed via dblp record (dblp.org/rec/conf/fat/RaghavanBKL20.html).
- **Summary:** The authors survey 18 vendors of algorithmic pre-employment assessments and document what these companies disclose about development, validation, and bias mitigation. They find the industry's practices largely opaque, with significant tensions between technical de-biasing methods and antidiscrimination law, and with critical questions (choice of prediction target, data collection) unaddressed. The paper became a standard reference for fairness auditing in algorithmic hiring.
- **Relevance to CareerLens:** Establishes that opaque automated screening is a documented fairness problem, reinforcing the problem domain from the accountability side. It also cuts the other way: CareerLens's own automated pipeline (Model 2 classification + LLM scoring) inherits the same transparency obligations the paper demands of vendors — material for an honest limitations discussion.
- **Book placement:** Ch.2 Literature Review (problem domain); bias angle also feeds Ch.4.5 Discussion.

---

## Topic 2 — Resume parsing / information extraction

### [3] B. Gaur, G. S. Saluja, H. B. Sivakumar, and S. Singh, "Semi-supervised deep learning based named entity recognition model to parse education section of resumes," *Neural Computing and Applications*, vol. 33, pp. 5705–5718, 2021, doi: 10.1007/s00521-020-05351-2.

- **Verified URL:** https://link.springer.com/article/10.1007/s00521-020-05351-2
- **Verified:** Springer article page fetched — title, all four authors, journal, volume, pages 5705–5718, DOI confirmed.
- **Summary:** Peer-reviewed work on parsing a specific resume section (education) with NER. Because large annotated resume corpora are scarce, the authors train a deep model on a small seed set, predict entities on unlabeled education sections, correct predictions with reference lists, and retrain iteratively, reaching 92.06% accuracy. The paper documents why resume text is hard for machine processing: heterogeneous layouts, section conventions, and free-form phrasing.
- **Relevance to CareerLens:** Directly supports the PDF-extraction and section-detection module (CV → structured text before Model 2 / SkillNer run). It also justifies CareerLens's pragmatic design: rather than training a custom resume-NER (which needs annotated data we do not have), CareerLens combines direct PDF text extraction (pdf-parse; the spec planned PyMuPDF — corrected against code 2026-07-21) with a pre-built skill extractor — the annotation-scarcity problem this paper works around is exactly the constraint that shaped that decision.
- **Book placement:** Ch.2 Literature Review (parsing subsection); background for the extraction module in Ch.4 Comparison.

---

## Topic 3 — Skill extraction and skill taxonomies (SkillNer / EMSI-Lightcast; ESCO/O*NET as background)

### [4] M. Zhang, K. Jensen, S. Sonniks, and B. Plank, "SkillSpan: Hard and soft skill extraction from English job postings," in *Proc. 2022 Conf. of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (NAACL-HLT)*, Seattle, WA, USA, 2022, pp. 4962–4984, doi: 10.18653/v1/2022.naacl-main.366.

- **Verified URL:** https://aclanthology.org/2022.naacl-main.366/
- **Verified:** ACL Anthology page fetched — title, authors, venue, pages, DOI confirmed.
- **Summary:** Introduces SKILLSPAN, a span-level skill-extraction dataset of 14.5K sentences and over 12.5K annotated spans from job postings, with annotation guidelines grounded in the ESCO taxonomy and distinguishing hard vs soft skills. The authors benchmark BERT baselines and domain-adapted language models, finding that domain-adapted models significantly outperform their non-adapted counterparts. The paper frames skill extraction as harder than classic NER because skill spans are longer and syntactically more complex.
- **Relevance to CareerLens:** The academic anchor for the skill-extraction task at the heart of Model 1 (title→skills aggregation is only as good as the extraction feeding it). Its ESCO-based annotation scheme supplies the taxonomy background (ESCO/O*NET) the spec mentions, while CareerLens's production extractor actually uses the EMSI/Lightcast-derived database via SkillNer [5]. Its finding that trained, domain-adapted extractors beat generic ones is a documented limitation of our rule-based choice (see Red Flags).
- **Book placement:** Ch.2 Literature Review (skill extraction); Ch.4 Comparison (trained extractors vs SkillNer).

### [5] A. Ait Aomar, *SkillNER: An NLP module to automatically extract skills and certifications from unstructured job postings, texts, and applicant's resumes*, open-source software, version 1.0.3, MIT License, 2021. [Online]. Available: https://github.com/AnasAito/SkillNER

- **Verified URL:** https://github.com/AnasAito/SkillNER (package: https://pypi.org/project/skillNer/)
- **Verified:** GitHub repository fetched — name, author, purpose, spaCy (`en_core_web_lg`) + PhraseMatcher architecture, EMSI skills database as the knowledge base, MIT license, v1.0.3 (2021) all confirmed. Note: SkillNer has **no peer-reviewed publication**; this is a software citation, which is the correct citable form for it.
- **Summary:** SkillNer is the spaCy-based open-source skill extractor used in production by CareerLens. It is rule- and pattern-based (PhraseMatcher over a curated skill vocabulary) rather than a trained neural model, and links matched surface forms against the open EMSI (now Lightcast) skills database to canonicalize skills and prevent duplicates. The bundled SKILL_DB used by CareerLens contains 31,278 skills.
- **Relevance to CareerLens:** This is the exact tool behind skill extraction for both CVs and job postings — the input to Model 1's IDF-specificity aggregation and to the 10-skill list the LLM judge scores. Citing the software (with its EMSI/Lightcast lineage) replaces the spec's earlier vague "ESCO/O*NET" attribution with the correct one.
- **Book placement:** Ch.2 Literature Review (tools) and wherever the implementation chapter describes the extraction pipeline.

### (Topic 3/8 bridge — see [13] Senger et al., listed under Topic 8, which surveys the whole skill-extraction-from-job-postings field and its taxonomies.)

---

## Topic 4 — Text classification: TF-IDF representations; shallow MLP vs linear baselines; many classes

### [6] K. Sparck Jones, "A statistical interpretation of term specificity and its application in retrieval," *Journal of Documentation*, vol. 28, no. 1, pp. 11–21, 1972, doi: 10.1108/eb026526.

- **Verified URL:** https://www.emerald.com/insight/content/doi/10.1108/eb026526/full/html
- **Verified:** Emerald publisher page fetched — title, author, journal, volume/issue/pages, DOI confirmed.
- **Summary:** The classic paper that originated inverse document frequency (IDF). Sparck Jones argues that a term's specificity should be interpreted *statistically* — as a function of how the term is used across a collection, not of its meaning — and shows experimentally that matches on rarer, more specific terms should be weighted higher than matches on frequent terms. This weighting principle became the "IDF" in TF-IDF and underlies virtually all sparse text representation since.
- **Relevance to CareerLens:** Double duty. (a) It is the theoretical root of the TF-IDF vectorizer feeding Model 2's MLP. (b) More distinctively, Model 1's *IDF-based specificity weighting* — down-weighting skills that appear across all roles and surfacing role-specific ones — is a direct application of Sparck Jones's principle to skill aggregation, and should be cited as such.
- **Book placement:** Ch.2 Literature Review (representations; the allowed "classic").

### [7] A. Joulin, E. Grave, P. Bojanowski, and T. Mikolov, "Bag of tricks for efficient text classification," in *Proc. 15th Conf. of the European Chapter of the Association for Computational Linguistics (EACL), Vol. 2, Short Papers*, Valencia, Spain, 2017, pp. 427–431.

- **Verified URL:** https://aclanthology.org/E17-2068/ (arXiv: https://arxiv.org/abs/1607.01759)
- **Verified:** ACL Anthology page fetched — title, authors, venue, pages confirmed.
- **Summary:** The fastText paper: a simple shallow classifier over bag-of-words/n-gram features is shown to be on par with deep learning classifiers in accuracy while being orders of magnitude faster — training on a billion words in minutes on CPU and classifying among 312K classes in under a minute. It is the standard evidence that for many text-classification problems, shallow models over sparse lexical features remain highly competitive, including at extreme class counts.
- **Relevance to CareerLens:** Justifies Model 2's architecture class: a shallow pipeline (TF-IDF + MLP(256)) over 59+1 classes instead of a fine-tuned transformer — appropriate for a small dataset and a CPU-deployable product. It simultaneously tempers the MLP-vs-LogReg story: the literature says linear models are often *enough*, so the observed 57.6% → 62.3% gain from one hidden layer is a meaningful but expectedly modest improvement (see Red Flags).
- **Book placement:** Ch.2 Literature Review; Ch.4 Comparison (model-choice rationale).

---

## Topic 5 — Sentence embeddings (SBERT / all-MiniLM) + nearest-centroid classification

### [8] N. Reimers and I. Gurevych, "Sentence-BERT: Sentence embeddings using Siamese BERT-networks," in *Proc. 2019 Conf. on Empirical Methods in Natural Language Processing and 9th Int. Joint Conf. on Natural Language Processing (EMNLP-IJCNLP)*, Hong Kong, China, 2019, pp. 3982–3992, doi: 10.18653/v1/D19-1410.

- **Verified URL:** https://aclanthology.org/D19-1410/
- **Verified:** ACL Anthology page fetched — title, authors, venue, pages, DOI confirmed.
- **Summary:** Introduces SBERT: Siamese/triplet fine-tuning of BERT so that individual sentences map to fixed vectors whose cosine similarity is semantically meaningful. This turns semantic comparison from an expensive cross-encoder pass into cheap vector arithmetic (a similarity search drops from ~65 hours to ~5 seconds in their benchmark) while beating prior sentence-embedding methods. SBERT is the foundation of the `sentence-transformers` ecosystem from which `all-MiniLM-L6-v2` comes.
- **Relevance to CareerLens:** The direct citation for the title-normalization component: raw scraped/user job titles are embedded with `all-MiniLM-L6-v2` (a sentence-transformers model in the SBERT lineage) and assigned to one of 59 canonical titles. The efficiency argument is exactly why normalization can run per-request in the product.
- **Book placement:** Ch.2 Literature Review (embeddings).

### [9] J. Snell, K. Swersky, and R. S. Zemel, "Prototypical networks for few-shot learning," in *Advances in Neural Information Processing Systems 30 (NIPS 2017)*, Long Beach, CA, USA, 2017, pp. 4077–4087.

- **Verified URL:** https://arxiv.org/abs/1703.05175
- **Verified:** arXiv abstract page fetched (title, authors, year); venue and pages 4077–4087 confirmed via dblp record (dblp.org/rec/conf/nips/SnellSZ17.html).
- **Summary:** Proposes classifying by distance to class *prototypes* — the mean (centroid) of each class's examples in a learned embedding space. The key result is that this deliberately simple inductive bias beats far more complex meta-learning architectures in limited-data regimes, and extends to zero-shot settings. It is the canonical modern justification for centroid-based classification over learned embeddings.
- **Relevance to CareerLens:** The academic backing for the title normalizer's *nearest-centroid* design: with few examples per canonical title, computing one SBERT centroid per class and assigning by nearest centroid is precisely the prototype approach, and the paper explains why it is the right bias for small per-class data (92.6% held-out supports this empirically).
- **Book placement:** Ch.2 Literature Review; Ch.4 Comparison (why not train a 59-class classifier for normalization).

---

## Topic 6 — Job–CV matching / semantic matching

### [10] D. Lavi, V. Medentsiy, and D. Graus, "conSultantBERT: Fine-tuned Siamese Sentence-BERT for matching jobs and job seekers," in *Proc. Workshop on Recommender Systems for Human Resources (RecSys in HR 2021), co-located with ACM RecSys 2021*, Amsterdam, Netherlands, 2021. arXiv:2109.06501.

- **Verified URL:** https://arxiv.org/abs/2109.06501 (workshop proceedings: https://ceur-ws.org/Vol-2967/paper_8.pdf)
- **Verified:** arXiv abstract page fetched — title, authors, year, RecSys in HR 2021 acceptance note confirmed.
- **Summary:** An industry-academic paper (Randstad) that fine-tunes a Siamese SBERT on more than 270,000 resume–vacancy pairs labeled by staffing consultants to produce a resume/vacancy matching model. The fine-tuned model substantially outperforms baselines built on TF-IDF-weighted feature vectors and on off-the-shelf BERT embeddings, and handles noisy parsed resumes and cross-lingual matching. It is one of the most directly comparable published systems to CareerLens's core task.
- **Relevance to CareerLens:** The closest published relative of the product's core: semantic CV-vs-vacancy matching over parsed resume text. It validates the overall approach (sentence-embedding similarity between CV and job content) while contradicting one specific CareerLens choice — its TF-IDF baselines lose to embeddings, whereas CareerLens's Model 2 kept a TF-IDF pipeline (see Red Flags for the honest reconciliation).
- **Book placement:** Ch.2 Literature Review (matching); Ch.4 Comparison to existing approaches; contradiction discussed in Ch.4.5.

---

## Topic 7 — LLM-as-a-judge: reliability, consistency, bias

### [11] L. Zheng, W.-L. Chiang, Y. Sheng, S. Zhuang, Z. Wu, Y. Zhuang, Z. Lin, Z. Li, D. Li, E. P. Xing, H. Zhang, J. E. Gonzalez, and I. Stoica, "Judging LLM-as-a-judge with MT-Bench and Chatbot Arena," in *Advances in Neural Information Processing Systems 36 (NeurIPS 2023), Datasets and Benchmarks Track*, New Orleans, LA, USA, 2023. arXiv:2306.05685.

- **Verified URL:** https://arxiv.org/abs/2306.05685 (proceedings: https://proceedings.neurips.cc/paper_files/paper/2023/hash/91f18a1287b398d378ef22505bf41832-Abstract-Datasets_and_Benchmarks.html)
- **Verified:** arXiv abstract page fetched — title, full author list, NeurIPS 2023 Datasets and Benchmarks venue confirmed.
- **Summary:** The paper that named and systematized the "LLM-as-a-judge" paradigm. Strong LLM judges (GPT-4) reach over 80% agreement with human preferences — the same level as human–human agreement — making LLM judging a scalable, explainable approximation of human evaluation. Crucially, it also catalogs the paradigm's failure modes: position bias, verbosity bias, self-enhancement bias, and limited reasoning/grading ability, and proposes mitigations (swapping positions, reference-guided grading).
- **Relevance to CareerLens:** The foundational citation for the scoring agent's design: `gpt-4o-mini` grading each of 10 skills 1–10 against the CV *is* LLM-as-a-judge (single-answer grading variant). The 80%+ human-agreement result is the defense against "how do you know the score is right"; the documented biases are the required caveats and map directly to the M05 consistency work.
- **Book placement:** Ch.2 Literature Review (evaluation); defense + caveats in Ch.4.5 Discussion.

### [12] P. Wang, L. Li, L. Chen, Z. Cai, D. Zhu, B. Lin, Y. Cao, L. Kong, Q. Liu, T. Liu, and Z. Sui, "Large language models are not fair evaluators," in *Proc. 62nd Annu. Meeting of the Association for Computational Linguistics (ACL), Vol. 1: Long Papers*, Bangkok, Thailand, 2024, pp. 9440–9450, doi: 10.18653/v1/2024.acl-long.511.

- **Verified URL:** https://aclanthology.org/2024.acl-long.511/
- **Verified:** ACL Anthology page fetched — title, full author list, venue, pages, DOI confirmed.
- **Summary:** Demonstrates that LLM evaluators exhibit severe positional bias: merely reordering candidate responses can flip rankings, letting a weaker model "beat" a stronger one on a majority of queries. The authors propose a calibration framework — multiple evidence generation before scoring, balanced position aggregation, and human-in-the-loop for high-variance cases — that realigns judge output with human judgment.
- **Relevance to CareerLens:** The strongest published challenge to the scoring agent's reliability. CareerLens's judge does absolute per-skill grading rather than pairwise comparison, which structurally avoids *positional* bias — a point worth making explicitly — but the paper's broader finding (LLM scores are prompt-order- and framing-sensitive) motivates the consistency checks and score-calibration concerns already flagged for the gpt-4o-mini scorer.
- **Book placement:** Ch.4.5 Discussion (limitations of LLM scoring); cited from Ch.2's evaluation subsection.

---

## Topic 8 — Labour-market skill-trend mining

### [13] E. Senger, M. Zhang, R. van der Goot, and B. Plank, "Deep learning-based computational job market analysis: A survey on skill extraction and classification from job postings," in *Proc. First Workshop on Natural Language Processing for Human Resources (NLP4HR 2024), co-located with EACL 2024*, St. Julian's, Malta, 2024, pp. 1–15, doi: 10.18653/v1/2024.nlp4hr-1.1.

- **Verified URL:** https://aclanthology.org/2024.nlp4hr-1.1/ (arXiv: https://arxiv.org/abs/2402.05617)
- **Verified:** ACL Anthology page fetched — title, authors, venue, pages 1–15, DOI confirmed.
- **Summary:** A survey consolidating the emerging field of *computational job market analysis*: deep-learning methods, public datasets, and terminology for extracting and classifying skills from large volumes of online job postings, including their mapping onto taxonomies (ESCO and related). It standardizes definitions (hard vs soft skills, extraction vs classification) and positions job-posting mining as the data source for labour-market intelligence — tracking which skills employers demand.
- **Relevance to CareerLens:** Frames the historical job-postings pipeline and the Trending/Stable skill features as an instance of a recognized research field: CareerLens mines postings per role over time, aggregates extracted skills (Model 1), and surfaces demand dynamics via recency weighting. Note for the book: direct academic literature on *temporal skill-trend* mining specifically is thin; this survey is the field's consolidation point and is used here as the adjacent-literature anchor (as anticipated in the kickoff risk table), doubling as a second academic anchor for Topic 3.
- **Book placement:** Ch.2 Literature Review (labour-market analytics) + Ch.1 Background (context for the historical pipeline).

---

## Topic 9 — Data leakage and shortcut learning in text classification

### [14] R. Geirhos, J.-H. Jacobsen, C. Michaelis, R. Zemel, W. Brendel, M. Bethge, and F. A. Wichmann, "Shortcut learning in deep neural networks," *Nature Machine Intelligence*, vol. 2, pp. 665–673, 2020, doi: 10.1038/s42256-020-00257-z.

- **Verified URL:** https://arxiv.org/abs/2004.07780 (journal DOI confirmed on the arXiv record; Nature page: https://www.nature.com/articles/s42256-020-00257-z)
- **Verified:** arXiv abstract page fetched — title, full author list, Nature Machine Intelligence journal reference and DOI confirmed (the Nature page itself sits behind a cookie redirect; the arXiv record carries the journal reference).
- **Summary:** A perspective paper unifying many deep-learning failures under one concept: *shortcut learning* — models latch onto decision rules (spurious cues) that maximize benchmark performance but do not transfer to realistic conditions. The authors show shortcuts arise whenever the training data offers an easier-to-exploit signal than the intended one, and recommend evaluating models under distribution shift to expose them.
- **Relevance to CareerLens:** The exact theoretical frame for the Model 2 leakage finding: with 77% of training CVs containing the job title verbatim, the easiest signal for the classifier was literal title matching — a textbook shortcut. Scrubbing the title removed the shortcut, and the F1 drop from 0.981 to 0.932 is the honest, transfer-relevant number. This citation turns the scrub experiment from a bug-fix anecdote into a methodological contribution.
- **Book placement:** Ch.2 Literature Review (leakage subsection) + Ch.4.5 Discussion.

### [15] S. Kapoor and A. Narayanan, "Leakage and the reproducibility crisis in machine-learning-based science," *Patterns*, vol. 4, no. 9, Art. no. 100804, 2023, doi: 10.1016/j.patter.2023.100804.

- **Verified URL:** https://arxiv.org/abs/2207.07048 (journal record confirmed via Semantic Scholar API and dblp; publisher page: https://www.cell.com/patterns/fulltext/S2666-3899(23)00159-9)
- **Verified:** arXiv abstract page fetched (title, authors, taxonomy claim); journal, year 2023, volume 4, issue 9, article 100804 and DOI confirmed via the Semantic Scholar API record and the dblp record (dblp.org/rec/journals/patterns/KapoorN23.html).
- **Summary:** A systematic survey showing data leakage is a pervasive, reproducibility-destroying error: the authors identify 17 scientific fields with leakage affecting 329 papers, and present a fine-grained taxonomy of 8 leakage types, from textbook train–test contamination to subtler forms such as features that proxy the label. In their civil-war-prediction case study, every paper claiming complex ML beat logistic regression failed to reproduce once leakage was fixed. They propose "model info sheets" for reporting ML-based scientific claims.
- **Relevance to CareerLens:** The verbatim job title inside training CVs is a proxy-for-the-label feature — squarely inside this taxonomy. The paper's central empirical pattern (impressive numbers collapse when leakage is fixed) is exactly what CareerLens observed (0.981 → 0.932) and *chose to report honestly*; it also mandates a caveat that Model 2's MLP-vs-LogReg comparison (62.3% vs 57.6%) is only meaningful on scrubbed data (see Red Flags).
- **Book placement:** Ch.2 Literature Review + Ch.4.5 Discussion (methodological honesty).

---

## Red flags / contradicting findings (gold for Ch.4.5 Discussion)

1. **Embeddings beat TF-IDF for CV–vacancy text — the opposite of what CareerLens shipped for Model 2.** conSultantBERT [10] reports that fine-tuned SBERT embeddings substantially outperform TF-IDF feature baselines for resume–vacancy matching. CareerLens nonetheless ships TF-IDF+MLP for Model 2 (CV→title classification) and reserves SBERT for title normalization. The honest reconciliation for the book: (a) the tasks differ — [10] is pairwise matching, Model 2 is 59+1-class classification; (b) [10]'s advantage came from *fine-tuning* on 270K labeled pairs, a supervision scale CareerLens does not have — off-the-shelf embeddings were not the winning configuration even in [10]; (c) fastText [7] documents that shallow/sparse lexical models remain competitive for classification. This tension should be discussed, not hidden.
2. **LLM judges are demonstrably inconsistent and biased.** Wang et al. [12] show rankings can be flipped by reordering candidates; Zheng et al. [11] document verbosity and self-enhancement biases and weak fine-grained grading ability. CareerLens's scoring agent (gpt-4o-mini, per-skill 1–10) avoids pairwise positional bias by construction, but score calibration, run-to-run consistency, and verbosity sensitivity remain open concerns — these citations both defend the paradigm (80%+ human agreement [11]) and bound the claim.
3. **"Complex model beats simple baseline" claims often die when leakage is fixed.** Kapoor & Narayanan [15] found that every complex-beats-logistic-regression claim in their case study failed under leakage correction. Model 2's headline comparison (MLP 62.3% vs LogReg 57.6%) is credible only if both were evaluated on the title-scrubbed data; the book must state this explicitly alongside the 0.981→0.932 F1 story ([14], [15] make this a strength if reported, a liability if glossed).
4. **Shallow ≠ free lunch: linear models are often "enough."** fastText [7] is routinely on par with deep classifiers; a ~4.7-point accuracy gain from adding one hidden layer is consistent with the literature but modest — the book should present MLP(256) as an empirically validated increment, not a categorical superiority claim.
5. **Trained, domain-adapted skill extractors outperform rule-based matching.** SkillSpan [4] (and the surrounding field surveyed in [13]) shows domain-adapted neural extractors significantly beat generic approaches; SkillNer [5] is gazetteer/PhraseMatcher-based and unpublished academically. CareerLens's choice is defensible (zero training data required, 31,278-skill curated vocabulary, deterministic behavior) but its recall ceiling on novel or freely-phrased skills is a known limitation to acknowledge.

---

## References (IEEE, ready to paste)

[1] J. B. Fuller, M. Raman, E. Sage-Gavin, and K. Hines, *Hidden Workers: Untapped Talent*, white paper, Harvard Business School Project on Managing the Future of Work and Accenture, Sep. 2021. [Online]. Available: https://www.hbs.edu/managing-the-future-of-work/research/Pages/hidden-workers-untapped-talent.aspx

[2] M. Raghavan, S. Barocas, J. Kleinberg, and K. Levy, "Mitigating bias in algorithmic hiring: Evaluating claims and practices," in *Proc. 2020 Conf. Fairness, Accountability, and Transparency (FAT\* '20)*, Barcelona, Spain, 2020, pp. 469–481, doi: 10.1145/3351095.3372828.

[3] B. Gaur, G. S. Saluja, H. B. Sivakumar, and S. Singh, "Semi-supervised deep learning based named entity recognition model to parse education section of resumes," *Neural Comput. Appl.*, vol. 33, pp. 5705–5718, 2021, doi: 10.1007/s00521-020-05351-2.

[4] M. Zhang, K. Jensen, S. Sonniks, and B. Plank, "SkillSpan: Hard and soft skill extraction from English job postings," in *Proc. 2022 Conf. North Amer. Chapter Assoc. Comput. Linguistics: Human Lang. Technol. (NAACL-HLT)*, Seattle, WA, USA, 2022, pp. 4962–4984, doi: 10.18653/v1/2022.naacl-main.366.

[5] A. Ait Aomar, *SkillNER*, open-source software, ver. 1.0.3, MIT License, 2021. [Online]. Available: https://github.com/AnasAito/SkillNER

[6] K. Sparck Jones, "A statistical interpretation of term specificity and its application in retrieval," *J. Documentation*, vol. 28, no. 1, pp. 11–21, 1972, doi: 10.1108/eb026526.

[7] A. Joulin, E. Grave, P. Bojanowski, and T. Mikolov, "Bag of tricks for efficient text classification," in *Proc. 15th Conf. Eur. Chapter Assoc. Comput. Linguistics (EACL), Vol. 2, Short Papers*, Valencia, Spain, 2017, pp. 427–431.

[8] N. Reimers and I. Gurevych, "Sentence-BERT: Sentence embeddings using Siamese BERT-networks," in *Proc. 2019 Conf. Empirical Methods Natural Lang. Process. and 9th Int. Joint Conf. Natural Lang. Process. (EMNLP-IJCNLP)*, Hong Kong, China, 2019, pp. 3982–3992, doi: 10.18653/v1/D19-1410.

[9] J. Snell, K. Swersky, and R. S. Zemel, "Prototypical networks for few-shot learning," in *Adv. Neural Inf. Process. Syst. 30 (NIPS 2017)*, Long Beach, CA, USA, 2017, pp. 4077–4087.

[10] D. Lavi, V. Medentsiy, and D. Graus, "conSultantBERT: Fine-tuned Siamese Sentence-BERT for matching jobs and job seekers," in *Proc. Workshop Recommender Syst. for Human Resources (RecSys in HR 2021)*, Amsterdam, Netherlands, 2021. arXiv:2109.06501.

[11] L. Zheng *et al.*, "Judging LLM-as-a-judge with MT-Bench and Chatbot Arena," in *Adv. Neural Inf. Process. Syst. 36 (NeurIPS 2023), Datasets and Benchmarks Track*, New Orleans, LA, USA, 2023. arXiv:2306.05685.

[12] P. Wang *et al.*, "Large language models are not fair evaluators," in *Proc. 62nd Annu. Meeting Assoc. Comput. Linguistics (ACL), Vol. 1: Long Papers*, Bangkok, Thailand, 2024, pp. 9440–9450, doi: 10.18653/v1/2024.acl-long.511.

[13] E. Senger, M. Zhang, R. van der Goot, and B. Plank, "Deep learning-based computational job market analysis: A survey on skill extraction and classification from job postings," in *Proc. 1st Workshop Natural Lang. Process. for Human Resources (NLP4HR 2024)*, St. Julian's, Malta, 2024, pp. 1–15, doi: 10.18653/v1/2024.nlp4hr-1.1.

[14] R. Geirhos, J.-H. Jacobsen, C. Michaelis, R. Zemel, W. Brendel, M. Bethge, and F. A. Wichmann, "Shortcut learning in deep neural networks," *Nature Mach. Intell.*, vol. 2, pp. 665–673, 2020, doi: 10.1038/s42256-020-00257-z.

[15] S. Kapoor and A. Narayanan, "Leakage and the reproducibility crisis in machine-learning-based science," *Patterns*, vol. 4, no. 9, Art. no. 100804, 2023, doi: 10.1016/j.patter.2023.100804.

---

### Appendix — verified spare (not part of the 15 selected)

One additional source was fully verified but left out to respect the 12–15 cap; M09 may swap it in if a dedicated ESCO-taxonomy citation is wanted for the background chapter:

- M. le Vrang, A. Papantoniou, E. Pauwels, P. Fannes, D. Vandensteen, and J. De Smedt, "ESCO: Boosting job matching in Europe with semantic interoperability," *Computer*, vol. 47, no. 10, pp. 57–64, 2014, doi: 10.1109/MC.2014.283. (Verified via the Semantic Scholar API record for DOI 10.1109/MC.2014.283.)

---

## Self-check (M17 Definition of Done)

- **Source count:** 15 selected (within the 12–15 requirement). ✔
- **Topic coverage:** 9/9 —
  1. ATS & resume screening: [1], [2] ✔
  2. Resume parsing / IE: [3] ✔
  3. Skill extraction & taxonomies: [4], [5] (+ survey [13]) ✔
  4. TF-IDF / shallow MLP vs linear: [6], [7] ✔
  5. Sentence embeddings + nearest-centroid: [8], [9] ✔
  6. Job–CV matching: [10] ✔
  7. LLM-as-a-judge: [11], [12] ✔
  8. Labour-market skill trends: [13] (adjacent-literature anchor, per kickoff mitigation) ✔
  9. Data leakage / shortcut learning: [14], [15] ✔
- **Verification:** every entry carries a "Verified:" line naming the page(s) actually fetched on 2026-07-20 (ACL Anthology ×5, arXiv abstract ×6, Emerald ×1, Springer ×1, GitHub ×1, hbs.edu page + primary PDF ×1, plus dblp/Semantic Scholar records for venue details). Zero sources cited from memory; zero unverified sources retained. ✔
- **Recency mix:** 11 of 15 from 2019+; classics/older: Sparck Jones 1972 (allowed classic), Joulin 2017, Snell 2017, and the 2021 SkillNer software release. Industry reports: 1 ([1]), within the 1–3 allowance. ✔
- **Red flags reported:** 5 explicit contradiction/limitation findings recorded above for Ch.4.5. ✔
