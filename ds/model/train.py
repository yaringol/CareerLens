"""
Standalone training script — equivalent to running the Train section of training.ipynb.
Produces model.joblib + canonical_titles.json in ds/model/.
"""
import json
import os
import sys
from collections import defaultdict
from datetime import datetime

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
EXTRACTOR  = os.path.join(BASE_DIR, '..', 'extractor')

# ── Canonical title set ───────────────────────────────────────────────────────

CANONICAL_TITLE_VARIANTS = {
    # ── Original 5 POC titles ─────────────────────────────────────────────────
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

# ── Normalization constants ───────────────────────────────────────────────────

ROLE_NAME_NOISE = {w for title in CANONICAL_TITLES
                   for w in [title.lower(), title.lower() + 's']}

UNIVERSAL_NOISE = {
    'scale', 'scalable', 'scalability',
    'collaborate', 'collaborates', 'collaboration', 'collaborations',
    'communication', 'communications', 'communication skills',
    'best practices', 'best practice',
    'leadership', 'reliability', 'research',
    'track', 'translate', 'innovative', 'innovation', 'innovations',
    'workflow', 'workflows', 'computer science',
    'problem solve', 'problem solving',
    'management', 'manage', 'english', 'nice', 'plan', 'act', 'eye',
    'com', 'job description', 'product name', 'brand names',
} | ROLE_NAME_NOISE

SKILL_NORMALIZE = {
    'algorithms': 'algorithm', 'integrations': 'integration',
    'operations': 'operation', 'systems': 'system', 'platforms': 'platform',
    'pipelines': 'pipeline', 'services': 'service', 'frameworks': 'framework',
    'databases': 'database', 'technologies': 'technology',
    'environments': 'environment', 'deployments': 'deployment',
    'applications': 'application', 'solutions': 'solution',
    'requirements': 'requirement', 'components': 'component',
    'repositories': 'repository', 'features': 'feature',
    'microservices': 'microservice', 'containers': 'container',
}

def normalize_skill(sk):
    sk = sk.lower().strip()
    return SKILL_NORMALIZE.get(sk, sk)

def is_valid_skill(sk, canonical):
    if len(sk) < 3:
        return False
    if sk in UNIVERSAL_NOISE:
        return False
    if canonical.lower() in sk:
        return False
    return not any(tok in sk.split() for tok in canonical.lower().split())

def resolve_canonical(og_title, actual_title):
    if og_title in CANONICAL_TITLES:
        return og_title
    if actual_title and actual_title.lower() in VARIANT_TO_CANONICAL:
        return VARIANT_TO_CANONICAL[actual_title.lower()]
    return None

def extract_weighted_skills(item, canonical):
    full_raw = {m['doc_node_value'].lower() for m in item['skills'].get('full_matches', [])}
    scores = defaultdict(float)
    for sk in full_raw:
        sk = normalize_skill(sk)
        if is_valid_skill(sk, canonical):
            scores[sk] += 1.0
    for m in item['skills'].get('ngram_matches', []):
        sk_raw = m['doc_node_value'].lower()
        if sk_raw in full_raw:
            continue
        score = m.get('score', 0.5)
        if score < 0.75:
            continue
        sk = normalize_skill(sk_raw)
        if is_valid_skill(sk, canonical):
            scores[sk] += score
    return dict(scores)

# ── Load & aggregate ──────────────────────────────────────────────────────────

role_skill_scores = {t: defaultdict(float) for t in CANONICAL_TITLES}
role_skill_counts = {t: defaultdict(int)   for t in CANONICAL_TITLES}
record_counts     = defaultdict(int)

datasets = {
    'linkedin': os.path.join(EXTRACTOR, 'linkedin_translated_skills.jsonl'),
    'alljobs':  os.path.join(EXTRACTOR, 'alljobs_translated_skills.jsonl'),
}

for source, path in datasets.items():
    with open(path, encoding='utf-8') as f:
        for line in f:
            try:
                item = json.loads(line)
                og_title     = item.get('og_title') or item.get('og_tite')
                actual_title = item.get('title', '')
                canonical    = resolve_canonical(og_title, actual_title)
                if canonical is None:
                    continue
                total = (len(item['skills'].get('full_matches', [])) +
                         len(item['skills'].get('ngram_matches', [])))
                if total < 5:
                    continue
                weighted = extract_weighted_skills(item, canonical)
                if not weighted:
                    continue
                for skill, score in weighted.items():
                    role_skill_scores[canonical][skill] += score
                    role_skill_counts[canonical][skill] += 1
                record_counts[canonical] += 1
            except (json.JSONDecodeError, KeyError):
                continue

print("Records loaded per role:")
for title in CANONICAL_TITLES:
    n = record_counts[title]
    print(f"  {n:4}  {title}  ({len(role_skill_scores[title])} unique skills)")

# ── Sort skills (backward-compat list) ───────────────────────────────────────

role_sorted_skills = {
    title: [sk for sk, _ in sorted(
        role_skill_scores[title].items(), key=lambda x: -x[1] / max(record_counts[title], 1)
    )]
    for title in CANONICAL_TITLES
}

# ── Feature matrix ────────────────────────────────────────────────────────────

def compute_feature_matrix(role_skill_scores, role_skill_counts, record_counts):
    n_titles = len(CANONICAL_TITLES)
    skill_title_count = defaultdict(int)
    for skills in role_skill_scores.values():
        for skill in skills:
            skill_title_count[skill] += 1

    fm = {}
    for title in CANONICAL_TITLES:
        n = record_counts[title]
        if n == 0:
            continue
        fm[title] = {}
        for skill, total_score in role_skill_scores[title].items():
            frequency  = role_skill_counts[title][skill]
            prevalence = total_score / n
            idf        = np.log(n_titles / skill_title_count[skill]) if skill_title_count[skill] > 0 else 0
            specificity = idf / np.log(max(n_titles, 2))
            fm[title][skill] = {
                'frequency':         frequency,
                'prevalence':        prevalence,
                'title_specificity': float(np.clip(specificity, 0.0, 1.0)),
            }

    for title in fm:
        max_prev = max(f['prevalence'] for f in fm[title].values())
        if max_prev > 0:
            for skill in fm[title]:
                fm[title][skill]['prevalence'] /= max_prev
    return fm

feature_matrix = compute_feature_matrix(role_skill_scores, role_skill_counts, record_counts)

# ── Build KNN ─────────────────────────────────────────────────────────────────

variant_titles = []
variant_labels = []
for canonical, variants in CANONICAL_TITLE_VARIANTS.items():
    for v in variants:
        variant_titles.append(v)
        variant_labels.append(canonical)

skills_data = [role_sorted_skills.get(label, []) for label in variant_labels]

vectorizer = TfidfVectorizer(analyzer='char_wb', ngram_range=(2, 4))
X = vectorizer.fit_transform(variant_titles)

knn = NearestNeighbors(n_neighbors=3, metric='cosine')
knn.fit(X)

print(f"\nKNN trained on {len(variant_titles)} variants for {len(CANONICAL_TITLES)} titles")

# ── Save model ────────────────────────────────────────────────────────────────

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

model_artifacts = {
    'vectorizer':     vectorizer,
    'knn_model':      knn,
    'skills':         skills_data,
    'titles':         variant_labels,
    'variant_titles': variant_titles,
    'feature_matrix': feature_matrix,
    'trained_at':     timestamp,
}

versioned = os.path.join(BASE_DIR, f'model_{timestamp}.joblib')
latest    = os.path.join(BASE_DIR, 'model.joblib')
joblib.dump(model_artifacts, versioned)
joblib.dump(model_artifacts, latest)
print(f"Saved: {latest}")

# ── Save canonical_titles.json ────────────────────────────────────────────────

def confidence_level(n):
    if n >= 100: return 'high'
    if n >= 50:  return 'medium'
    return 'low'

canonical_data = {
    'canonical_titles':  CANONICAL_TITLES,
    'record_counts':     {t: int(record_counts[t]) for t in CANONICAL_TITLES},
    'confidence_levels': {t: confidence_level(int(record_counts[t])) for t in CANONICAL_TITLES},
    'generated_at':      timestamp,
}

json_path = os.path.join(BASE_DIR, 'canonical_titles.json')
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(canonical_data, f, indent=2, ensure_ascii=False)
print(f"Saved: {json_path}")

# ── Sanity check ──────────────────────────────────────────────────────────────
print("\nTop 5 skills per original POC title:")
poc = ["Software Engineer", "Data Scientist", "Product Manager", "DevOps Engineer", "Frontend Developer"]
for title in poc:
    idx = variant_labels.index(title)
    print(f"  {title}: {skills_data[idx][:5]}")
