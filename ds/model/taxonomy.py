"""
Shared title taxonomy — the single source of truth for the 59 canonical titles.

Both models import from here:
  - Model 1 (title->skills, train.py) uses CANONICAL_TITLE_VARIANTS / VARIANT_TO_CANONICAL.
  - Model 2 (CV->title, train_cv_classifier.py) trains directly on CANONICAL_TITLES,
    using PRIMARY_KEYWORD_TO_CANONICAL (lang-uk datasets) and MASTER_RAW_TO_CANONICAL
    (master_resumes.jsonl) to project every data source onto the same label space.

OTHER_LABEL is an explicit rejection class ("not an engineering CV") trained from the
non-engineering lang-uk records. It is never returned to callers — the DS server
filters it out and low remaining confidence routes the request to the LLM fallback.
"""

CANONICAL_TITLE_VARIANTS = {
    # ── Original 5 core titles ────────────────────────────────────────────────
    "Software Engineer": [
        "Software Engineer", "Senior Software Engineer", "Backend Engineer",
        "Senior Backend Engineer", "Backend Software Engineer", "Full Stack Engineer",
        "Senior Full Stack Engineer", "SW Engineer", "Senior SW Engineer",
        "Junior Software Engineer", "Python Developer",
    ],
    "Data Scientist": ["Data Scientist", "Senior Data Scientist"],
    "Product Manager": [
        "Product Manager", "Senior Product Manager", "Group Product Manager",
        "Product Owner", "Technical Product Manager", "Associate Product Manager",
    ],
    "DevOps Engineer": [
        "DevOps Engineer", "Senior DevOps Engineer", "Cloud Engineer",
        "Site Reliability Engineer", "SRE", "Infrastructure Engineer",
        "Azure DevOps Engineer", "Junior DevOps Engineer",
    ],
    "Frontend Developer": [
        "Frontend Developer", "Senior Frontend Developer", "Frontend Engineer",
        "Senior Frontend Engineer", "React Developer", "UI Developer",
        "UI Engineer", "Web Developer",
    ],
    # ── New high-confidence titles (≥100 records) ─────────────────────────────
    "SOC Analyst": [
        "SOC Analyst", "SOC Analyst Tier 1", "SOC Analyst Tier 2",
        "Security Operations Center Analyst", "Cybersecurity SOC Analyst",
    ],
    "Detection Engineer": [
        "Detection Engineer", "Senior Detection Engineer",
        "Detection & Response Engineer", "Threat Detection Engineer",
    ],
    "Digital Forensics": [
        "Digital Forensics", "Digital Forensics Analyst", "Digital Forensics Engineer",
        "DFIR Analyst", "Forensics Analyst",
    ],
    "Backend Developer": [
        "Backend Developer", "Senior Backend Developer", "Junior Backend Developer",
        "Node.js Developer", "Java Backend Developer", "Python Backend Developer",
    ],
    "Incident Response": [
        "Incident Response", "Incident Response Engineer", "Incident Responder",
        "IR Engineer", "Security Incident Response Analyst",
    ],
    "Security Analyst": [
        "Security Analyst", "Senior Security Analyst", "Information Security Analyst",
        "Cyber Security Analyst", "IT Security Analyst",
    ],
    "Cyber Security": [
        "Cyber Security", "Cyber Security Engineer", "Cybersecurity Engineer",
        "Cybersecurity Specialist", "Cyber Security Specialist",
    ],
    "QA Automation Engineer": [
        "QA Automation Engineer", "QA Engineer", "Automation QA Engineer",
        "SDET", "Quality Assurance Engineer", "Software Test Engineer",
    ],
    "Threat Intelligence": [
        "Threat Intelligence", "Threat Intelligence Analyst", "CTI Analyst",
        "Cyber Threat Intelligence Analyst", "Threat Intel Analyst",
    ],
    "Embedded Engineer": [
        "Embedded Engineer", "Embedded Software Engineer", "Embedded Systems Engineer",
        "Embedded SW Engineer", "Firmware & Embedded Engineer",
    ],
    "Fullstack Engineer": [
        "Fullstack Engineer", "Full Stack Engineer", "Full Stack Developer",
        "Fullstack Developer", "Senior Full Stack Developer",
    ],
    "Cloud Security": [
        "Cloud Security", "Cloud Security Engineer", "Cloud Security Architect",
        "Senior Cloud Security Engineer", "AWS Security Engineer",
    ],
    "C++ Developer": [
        "C++ Developer", "C++ Engineer", "C/C++ Developer",
        "Senior C++ Developer", "C++ Software Engineer",
    ],
    "Distributed Systems Engineer": [
        "Distributed Systems Engineer", "Senior Distributed Systems Engineer",
        "Distributed Systems Developer", "Systems Software Engineer",
    ],
    "Security Operations": [
        "Security Operations", "Security Operations Engineer",
        "Security Operations Analyst", "SecOps Engineer",
    ],
    "UX Designer": [
        "UX Designer", "UX/UI Designer", "Senior UX Designer",
        "Product Designer", "User Experience Designer",
    ],
    "Security Architect": [
        "Security Architect", "Senior Security Architect",
        "Lead Security Architect", "Enterprise Security Architect",
    ],
    "Firmware Engineer": [
        "Firmware Engineer", "Senior Firmware Engineer", "Firmware Developer",
        "Embedded Firmware Engineer",
    ],
    # ── Medium-confidence titles (50–99 records) ──────────────────────────────
    "Machine Learning Engineer": [
        "Machine Learning Engineer", "ML Engineer", "Senior ML Engineer",
        "Applied ML Engineer", "ML Software Engineer",
    ],
    "AI Researcher": [
        "AI Researcher", "AI Research Engineer", "Research Scientist",
        "Applied AI Researcher", "AI Scientist",
    ],
    "Malware Researcher": [
        "Malware Researcher", "Malware Analyst", "Malware Engineer",
        "Threat Researcher",
    ],
    "Threat Analyst": [
        "Threat Analyst", "Cyber Threat Analyst", "Security Threat Analyst",
    ],
    "Security Researcher": [
        "Security Researcher", "Security Research Engineer",
        "Vulnerability Researcher", "Security Research Analyst",
    ],
    "Driver Developer": [
        "Driver Developer", "Kernel Driver Developer", "Windows Driver Developer",
        "Linux Driver Developer", "Device Driver Engineer",
    ],
    "Solutions Architect": [
        "Solutions Architect", "Enterprise Architect", "Technical Architect",
        "Cloud Solutions Architect", "Senior Solutions Architect",
    ],
    "NLP Engineer": [
        "NLP Engineer", "Natural Language Processing Engineer",
        "NLP Researcher", "NLP Data Scientist", "NLP Scientist",
    ],
    "Chip Design Engineer": [
        "Chip Design Engineer", "VLSI Design Engineer", "ASIC Design Engineer",
        "IC Design Engineer", "SoC Design Engineer",
    ],
    "Penetration Tester": [
        "Penetration Tester", "Pen Tester", "Ethical Hacker",
        "Red Team Engineer", "Offensive Security Engineer",
    ],
    "Security Consultant": [
        "Security Consultant", "Cyber Security Consultant",
        "Information Security Consultant", "Senior Security Consultant",
    ],
    "Go Developer": [
        "Go Developer", "Golang Developer", "Go Engineer",
        "Backend Go Developer", "Go Software Engineer",
    ],
    "UI Designer": [
        "UI Designer", "UI/UX Designer", "Visual Designer",
        "Senior UI Designer",
    ],
    "Reverse Engineer": [
        "Reverse Engineer", "Reverse Engineering Researcher",
        "Software Reverse Engineer", "RE Engineer",
    ],
    "Platform Engineer": [
        "Platform Engineer", "Senior Platform Engineer",
        "Infrastructure Platform Engineer", "Developer Platform Engineer",
    ],
    "VLSI Engineer": [
        "VLSI Engineer", "VLSI Design Engineer", "RTL Engineer",
        "Digital Design Engineer",
    ],
    "Computer Vision Engineer": [
        "Computer Vision Engineer", "CV Engineer",
        "Computer Vision Researcher", "Vision AI Engineer",
    ],
    "Data Engineer": [
        "Data Engineer", "Senior Data Engineer",
        "Data Infrastructure Engineer", "Big Data Engineer",
    ],
    "Kubernetes Engineer": [
        "Kubernetes Engineer", "K8s Engineer",
        "Container Platform Engineer", "Cloud Kubernetes Engineer",
    ],
    "Algorithm Engineer": [
        "Algorithm Engineer", "Algorithms Engineer",
        "Software Engineer - Algorithms", "Algorithm Developer",
    ],
    "Hardware Engineer": [
        "Hardware Engineer", "HW Engineer",
        "Hardware Design Engineer", "Senior Hardware Engineer",
    ],
    "MLOps Engineer": [
        "MLOps Engineer", "ML Ops Engineer",
        "ML Platform Engineer", "AI Infrastructure Engineer",
    ],
    "Product Security Engineer": [
        "Product Security Engineer", "AppSec Engineer",
        "Application Security Engineer", "Product Security Researcher",
    ],
    # ── Lower-confidence titles (20–49 records) ───────────────────────────────
    "Deep Learning Engineer": [
        "Deep Learning Engineer", "DL Engineer", "Deep Learning Researcher",
    ],
    "FPGA Engineer": [
        "FPGA Engineer", "FPGA Developer", "FPGA Design Engineer", "FPGA Architect",
    ],
    "Verification Engineer": [
        "Verification Engineer", "HW Verification Engineer",
        "RTL Verification Engineer", "Design Verification Engineer",
    ],
    "Cloud Architect": [
        "Cloud Architect", "Senior Cloud Architect",
        "Cloud Infrastructure Architect",
    ],
    "Vulnerability Researcher": [
        "Vulnerability Researcher", "Security Vulnerability Researcher",
        "Bug Hunter", "Exploit Researcher",
    ],
    "Exploit Developer": [
        "Exploit Developer", "Exploit Engineer",
        "Offensive Research Engineer", "Exploit Writer",
    ],
    "Cryptographer": [
        "Cryptographer", "Cryptography Engineer",
        "Crypto Engineer", "Applied Cryptographer",
    ],
    "Rust Developer": [
        "Rust Developer", "Rust Engineer", "Systems Rust Developer",
    ],
    "Kernel Developer": [
        "Kernel Developer", "Linux Kernel Developer",
        "OS Developer", "Kernel Engineer",
    ],
    "Java Developer": [
        "Java Developer", "Java Engineer", "Senior Java Developer",
        "Java Software Engineer",
    ],
    "Reinforcement Learning Researcher": [
        "Reinforcement Learning Researcher", "RL Researcher", "RL Engineer",
        "Reinforcement Learning Engineer",
    ],
    "Cloud Native Engineer": [
        "Cloud Native Engineer", "Cloud Engineering Specialist",
        "Cloud-Native Developer",
    ],
    "Technical Product Manager (TPM)": [
        "Technical Product Manager (TPM)", "Technical Product Manager",
        "TPM", "Technical PM",
    ],
}

CANONICAL_TITLES = list(CANONICAL_TITLE_VARIANTS.keys())

VARIANT_TO_CANONICAL = {
    v.lower(): canonical
    for canonical, variants in CANONICAL_TITLE_VARIANTS.items()
    for v in variants
}

# Explicit rejection class for the CV->title classifier: "not an engineering CV".
# Trained from real non-engineering lang-uk records so the model has somewhere to
# put a marketing/HR/sales CV instead of forcing it into Software Engineer.
OTHER_LABEL = "__other__"


# ── lang-uk (djinni) Primary Keyword -> canonical title ────────────────────────
# Keys cover every Primary Keyword observed in careerlens.lang-uk-cv (42) and
# careerlens.lang-uk-job (45). Values: a canonical title, OTHER_LABEL for clearly
# non-engineering roles (kept as rejection-class data), or None to drop the record
# (tags too ambiguous to label reliably).
PRIMARY_KEYWORD_TO_CANONICAL = {
    # frontend
    "JavaScript":       "Frontend Developer",
    "React":            "Frontend Developer",
    # backend
    "Node.js":          "Backend Developer",
    "PHP":              "Backend Developer",
    "Ruby":             "Backend Developer",
    # language-specific canonicals
    "Java":             "Java Developer",
    "C++":              "C++ Developer",
    "Golang":           "Go Developer",
    "Rust":             "Rust Developer",
    # general software engineering (heterogeneous bucket, capped hard at training)
    ".NET":             "Software Engineer",
    "Python":           "Software Engineer",
    "Scala":            "Software Engineer",
    "iOS":              "Software Engineer",
    "Android":          "Software Engineer",
    "Flutter":          "Software Engineer",
    "Unity":            "Software Engineer",
    # QA
    "QA":               "QA Automation Engineer",
    "QA Automation":    "QA Automation Engineer",
    # infra
    "DevOps":           "DevOps Engineer",
    "Sysadmin":         "DevOps Engineer",
    # data
    "Data Science":     "Data Scientist",
    "Data Analyst":     "Data Scientist",
    "Data Engineer":    "Data Engineer",
    "SQL":              "Data Engineer",
    # security
    "Security":         "Cyber Security",
    # product / design
    "Product Manager":  "Product Manager",
    "Product Owner":    "Product Manager",
    "Design":           "UX Designer",
    # ── clearly non-engineering -> rejection class ────────────────────────────
    "Marketing":            OTHER_LABEL,
    "HR":                   OTHER_LABEL,
    "Sales":                OTHER_LABEL,
    "Recruiter":            OTHER_LABEL,
    "Artist":               OTHER_LABEL,
    "Lead Generation":      OTHER_LABEL,
    "SEO":                  OTHER_LABEL,
    "Technical Writing":    OTHER_LABEL,
    "Scrum Master":         OTHER_LABEL,
    "Business Analyst":     OTHER_LABEL,
    "Project Manager":      OTHER_LABEL,
    # ── too ambiguous to label -> dropped ─────────────────────────────────────
    "Support":          None,
    "Lead":             None,
    "Salesforce":       None,
    "SAP":              None,
    "Block-chain":      None,
    "Other":            None,
}


def lang_uk_label(primary_keyword):
    """Map a lang-uk Primary Keyword to a training label (canonical / OTHER_LABEL),
    or None when the record should be dropped."""
    if not primary_keyword:
        return None
    return PRIMARY_KEYWORD_TO_CANONICAL.get(str(primary_keyword).strip())


# ── master_resumes.jsonl raw title -> canonical title ──────────────────────────
# Direct projection of the 65 raw titles (str.title()-cased) onto the 59-title
# space. Replaces the old two-step label_map scheme (consolidate() to 38 classes
# + CLASSIFIER_TO_SUPPORTED back to 59) with a single map: each raw title lands
# either on its own canonical title or on the closest *semantically* correct one
# (same curated targets the old CLASSIFIER_TO_SUPPORTED used). Non-IC titles go
# to OTHER_LABEL (real rejection data in full-resume format); titles that are
# engineering but unmappable are dropped (None).
MASTER_RAW_TO_CANONICAL = {
    # already canonical / direct
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
    "Information Security Analyst": "Security Analyst",
    "Penetration Tester":           "Penetration Tester",
    "Embedded Systems Engineer":    "Embedded Engineer",
    "Qa Engineer":                  "QA Automation Engineer",
    "Technical Architect":          "Solutions Architect",
    "Solutions Architect":          "Solutions Architect",
    # formerly own-class labels -> curated semantic canonical
    "Database Administrator":       "Data Engineer",
    "Javascript Developer":         "Frontend Developer",
    "Angular Developer":            "Frontend Developer",
    "Vue Developer":                "Frontend Developer",
    "Ai Engineer":                  "Machine Learning Engineer",
    "Ios Developer":                "Software Engineer",
    "Android Developer":            "Software Engineer",
    "Mobile Developer":             "Software Engineer",
    "React Native Developer":       "Frontend Developer",
    "Flutter Developer":            "Software Engineer",
    "Systems Engineer":             "DevOps Engineer",
    "Security Engineer":            "Cyber Security",
    "Database Engineer":            "Data Engineer",
    "Sql Developer":                "Data Engineer",
    "Nosql Developer":              "Data Engineer",
    "Blockchain Developer":         "Backend Developer",
    "Automation Engineer":          "QA Automation Engineer",
    # small synonym variants -> their parent's canonical
    "Jr. Java Developer":                    "Java Developer",
    "Java Web Developer":                    "Java Developer",
    "Python Developer/Analyst":              "Software Engineer",
    "Python Restful Api Developer":          "Software Engineer",
    "Python Api Developer":                  "Software Engineer",
    "Machine Learning Engineer Intern":      "Machine Learning Engineer",
    "Cloud Operations Architect (Devops)":   "DevOps Engineer",
    "Network Security Engineer":             "Cyber Security",
    "Network And Security Engineer":         "Cyber Security",
    "Data Science Consultant":               "Data Scientist",
    "Adjunct Faculty & Data Scientist":      "Data Scientist",
    "Software Testing & Automation Engineer": "QA Automation Engineer",
    # non-IC -> rejection class (real full-resume negatives)
    "Operations Manager":            OTHER_LABEL,
    "Senior Business Analyst - Rpa": OTHER_LABEL,
    "Project Manager":               OTHER_LABEL,
    "Advocate":                      OTHER_LABEL,
    "Business Analyst":              OTHER_LABEL,
    # engineering but unmappable to the 59 -> dropped
    "Electrical Engineer":          None,
    "Sap Technical Architect":      None,
}


def master_label(raw_title):
    """Map a master_resumes raw title to a training label, or None to drop."""
    if not raw_title:
        return None
    return MASTER_RAW_TO_CANONICAL.get(str(raw_title).strip().title())
