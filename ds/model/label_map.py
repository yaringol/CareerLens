"""
Label consolidation for the CV→title classifier (tfid.ipynb).

master_resumes.jsonl carries 65 raw current-job titles. Left as-is they hurt
learning: true synonyms are split across classes (React / Web → Frontend) and a
long tail of ~19 rare titles (down to single examples) can't be learned.

This module maps every raw title to a clean final label using an *extended*
scheme (see plan snazzy-bouncing-widget.md):
  1. Titles that fall on the system's canonical set → canonical name. The
     canonical names/merges mirror CANONICAL_TITLE_VARIANTS in train.py
     (kept inline here so importing this module has no training side-effects).
  2. The 17 well-populated roles (~100 records each) that are NOT in the
     canonical set → kept as their own clean class.
  3. Small synonym variants (<20 records) → merged into their obvious parent.
  4. Non-IC / out-of-scope noise → dropped (mapped to None).

Result: ~38 clean classes, ~99% of records retained.

Usage:
    from label_map import consolidate
    final = consolidate(raw_title)   # str, or None to drop the record
"""

# raw title (Python str.title()-cased) -> final label, or None to drop.
RAW_TO_FINAL = {
    # ── Mapped onto the canonical set (mirrors train.py) ──────────────────────
    "Java Developer":               "Java Developer",
    "Python Developer":             "Software Engineer",
    "Devops Engineer":              "DevOps Engineer",
    "Data Scientist":               "Data Scientist",
    "Full Stack Developer":         "Fullstack Engineer",
    "Backend Developer":            "Backend Developer",
    "Frontend Developer":           "Frontend Developer",
    "Software Engineer":            "Software Engineer",
    "Cloud Engineer":               "DevOps Engineer",
    "React Developer":              "Frontend Developer",
    "Node.Js Developer":            "Backend Developer",
    "Web Developer":                "Frontend Developer",
    "Machine Learning Engineer":    "Machine Learning Engineer",
    "Data Engineer":                "Data Engineer",
    "Mlops Engineer":               "MLOps Engineer",
    "Deep Learning Engineer":       "Deep Learning Engineer",
    "Computer Vision Engineer":     "Computer Vision Engineer",
    "Nlp Engineer":                 "NLP Engineer",
    "Site Reliability Engineer":    "DevOps Engineer",
    "Infrastructure Engineer":      "DevOps Engineer",
    "Kubernetes Engineer":          "Kubernetes Engineer",
    "Platform Engineer":            "Platform Engineer",
    "Cybersecurity Engineer":       "Cyber Security",
    "Information Security Analyst":  "Security Analyst",
    "Penetration Tester":           "Penetration Tester",
    "Embedded Systems Engineer":    "Embedded Engineer",
    "Qa Engineer":                  "QA Automation Engineer",
    "Technical Architect":          "Solutions Architect",
    "Solutions Architect":          "Solutions Architect",

    # ── 17 well-populated roles kept as their own class (clean names) ─────────
    "Database Administrator":       "Database Administrator",
    "Javascript Developer":         "JavaScript Developer",
    "Angular Developer":            "Angular Developer",
    "Vue Developer":                "Vue Developer",
    "Ai Engineer":                  "AI Engineer",
    "Ios Developer":                "iOS Developer",
    "Android Developer":            "Android Developer",
    "Mobile Developer":             "Mobile Developer",
    "React Native Developer":       "React Native Developer",
    "Flutter Developer":            "Flutter Developer",
    "Systems Engineer":             "Systems Engineer",
    "Security Engineer":            "Security Engineer",
    "Database Engineer":            "Database Engineer",
    "Sql Developer":                "SQL Developer",
    "Nosql Developer":              "NoSQL Developer",
    "Blockchain Developer":         "Blockchain Developer",
    "Automation Engineer":          "Automation Engineer",

    # ── Small synonym variants (<20 records) merged into their parent ─────────
    "Jr. Java Developer":                    "Java Developer",
    "Java Web Developer":                    "Java Developer",
    "Python Developer/Analyst":              "Software Engineer",
    "Python Restful Api Developer":          "Software Engineer",
    "Python Api Developer":                  "Software Engineer",
    "Machine Learning Engineer Intern":      "Machine Learning Engineer",
    "Cloud Operations Architect (Devops)":   "DevOps Engineer",
    "Network Security Engineer":             "Security Engineer",
    "Network And Security Engineer":         "Security Engineer",
    "Data Science Consultant":               "Data Scientist",
    "Adjunct Faculty & Data Scientist":      "Data Scientist",
    "Software Testing & Automation Engineer": "QA Automation Engineer",

    # ── Non-IC / out-of-scope noise → dropped ─────────────────────────────────
    "Operations Manager":           None,
    "Senior Business Analyst - Rpa": None,
    "Electrical Engineer":          None,
    "Sap Technical Architect":      None,
    "Project Manager":              None,
    "Advocate":                     None,
    "Business Analyst":             None,
}


def consolidate(label):
    """Map a raw job title to its clean final label.

    Returns the final label (str), or None if the record should be dropped
    (explicit noise, or an unrecognised title not in the mapping).
    """
    if not label:
        return None
    return RAW_TO_FINAL.get(label.strip().title())


# Distinct kept labels - handy for sanity checks / ordering.
FINAL_LABELS = sorted({v for v in RAW_TO_FINAL.values() if v is not None})


# ── Alignment to the skills taxonomy (/title/skills KNN) ──────────────────────
# The classifier predicts one of the 38 FINAL_LABELS, but role focus-skills are
# fetched via getCoreSkills → /title/skills, whose KNN only knows train.py's
# canonical set (CANONICAL_TITLES). For the ~17 labels absent there we map to the
# closest *semantically* sensible supported title. We deliberately do NOT reuse
# the char-ngram title KNN for this - it matches on spelling, not meaning
# (e.g. "iOS Developer"→"Kernel Developer", "JavaScript Developer"→"Java
# Developer", "SQL Developer"→"Frontend Developer"), which would fetch the wrong
# skills. Targets below are all present in train.py CANONICAL_TITLES.
CLASSIFIER_TO_SUPPORTED = {
    # already supported by the KNN → identity
    "Backend Developer":         "Backend Developer",
    "Computer Vision Engineer":  "Computer Vision Engineer",
    "Cyber Security":            "Cyber Security",
    "Data Engineer":             "Data Engineer",
    "Data Scientist":            "Data Scientist",
    "Deep Learning Engineer":    "Deep Learning Engineer",
    "DevOps Engineer":           "DevOps Engineer",
    "Embedded Engineer":         "Embedded Engineer",
    "Frontend Developer":        "Frontend Developer",
    "Fullstack Engineer":        "Fullstack Engineer",
    "Java Developer":            "Java Developer",
    "Kubernetes Engineer":       "Kubernetes Engineer",
    "MLOps Engineer":            "MLOps Engineer",
    "Machine Learning Engineer": "Machine Learning Engineer",
    "NLP Engineer":              "NLP Engineer",
    "Penetration Tester":        "Penetration Tester",
    "Platform Engineer":         "Platform Engineer",
    "QA Automation Engineer":    "QA Automation Engineer",
    "Security Analyst":          "Security Analyst",
    "Software Engineer":         "Software Engineer",
    "Solutions Architect":       "Solutions Architect",
    # not in the KNN set → curated semantic fallback
    "AI Engineer":               "Machine Learning Engineer",
    "Android Developer":         "Software Engineer",
    "Angular Developer":         "Frontend Developer",
    "Automation Engineer":       "QA Automation Engineer",
    "Blockchain Developer":      "Backend Developer",
    "Database Administrator":    "Data Engineer",
    "Database Engineer":         "Data Engineer",
    "Flutter Developer":         "Software Engineer",
    "JavaScript Developer":      "Frontend Developer",
    "Mobile Developer":          "Software Engineer",
    "NoSQL Developer":           "Data Engineer",
    "React Native Developer":    "Frontend Developer",
    "SQL Developer":             "Data Engineer",
    "Security Engineer":         "Cyber Security",
    "Systems Engineer":          "DevOps Engineer",
    "iOS Developer":             "Software Engineer",
    "Vue Developer":             "Frontend Developer",
}


def to_supported_title(label):
    """Map a classifier label to a title the /title/skills KNN supports.

    Falls back to the label itself if unknown (KNN will char-ngram-snap it).
    """
    return CLASSIFIER_TO_SUPPORTED.get(label, label)
