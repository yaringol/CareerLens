"""
Curated 2024-2026 market-skill additions per canonical role (M06 phase B/C).

The local lang-uk corpus ends in mid-2023. These lists encode which skills
entered or grew in the market between H2-2023 and 2026, per role, and are the
single source the augmentation generator (augment_2026.py) draws from. Every
record generated from them is marked source='augmented-2026' - synthetic data
is never silently mixed with real postings (project iron rule; methodology is
documented in docs/final-sprint/outputs/06-model1-report.md).

Ramp semantics per skill: (start_period, p_start, p_end)
  - start_period: first half-year the skill appears in ('2023H2' .. '2026H1')
  - p_start/p_end: probability that a synthetic posting of this role in the
    start/final period mentions the skill; linear ramp in between.

FADING_SKILLS lists skills whose market presence declined 2024-2026; the
generator down-weights them when sampling base skills from the real corpus
(they are NOT removed from real data - only from the synthetic continuation).
"""
from __future__ import annotations

PERIODS = ["2023H2", "2024H1", "2024H2", "2025H1", "2025H2", "2026H1"]

# skill -> (start_period, p_start, p_end)
EMERGING_SKILLS: dict[str, dict[str, tuple[str, float, float]]] = {
    "Backend Developer": {
        "llm": ("2023H2", 0.05, 0.45),
        "rag": ("2024H1", 0.03, 0.35),
        "vector database": ("2024H1", 0.03, 0.30),
        "langchain": ("2024H1", 0.03, 0.20),
        "openai api": ("2023H2", 0.05, 0.35),
        "grpc": ("2023H2", 0.10, 0.20),
        "kubernetes": ("2023H2", 0.25, 0.40),
        "event driven architecture": ("2023H2", 0.10, 0.20),
        "ai agents": ("2025H1", 0.05, 0.25),
    },
    "Frontend Developer": {
        "next js": ("2023H2", 0.15, 0.40),
        "tailwind css": ("2023H2", 0.12, 0.35),
        "vite": ("2023H2", 0.08, 0.25),
        "server components": ("2024H1", 0.03, 0.18),
        "web accessibility": ("2023H2", 0.08, 0.18),
        "ai chat interfaces": ("2024H2", 0.03, 0.20),
        "llm": ("2024H1", 0.03, 0.20),
    },
    "Software Engineer": {
        "llm": ("2023H2", 0.08, 0.50),
        "generative ai": ("2023H2", 0.05, 0.40),
        "prompt engineering": ("2023H2", 0.03, 0.25),
        "rag": ("2024H1", 0.03, 0.30),
        "ai agents": ("2025H1", 0.05, 0.30),
        "rust": ("2023H2", 0.06, 0.15),
        "golang": ("2023H2", 0.10, 0.18),
        "ai coding assistants": ("2024H1", 0.05, 0.30),
    },
    "QA Automation Engineer": {
        "playwright": ("2023H2", 0.10, 0.45),
        "cypress": ("2023H2", 0.20, 0.30),
        "api testing": ("2023H2", 0.20, 0.30),
        "ai assisted testing": ("2024H2", 0.03, 0.20),
        "k6": ("2024H1", 0.03, 0.10),
        "contract testing": ("2024H1", 0.04, 0.12),
    },
    "DevOps Engineer": {
        "kubernetes": ("2023H2", 0.40, 0.60),
        "terraform": ("2023H2", 0.30, 0.45),
        "gitops": ("2023H2", 0.08, 0.25),
        "argocd": ("2024H1", 0.05, 0.20),
        "platform engineering": ("2024H1", 0.04, 0.20),
        "observability": ("2023H2", 0.10, 0.28),
        "opentelemetry": ("2024H1", 0.04, 0.18),
        "finops": ("2024H2", 0.03, 0.12),
        "mlops": ("2024H1", 0.05, 0.20),
        "llmops": ("2025H1", 0.03, 0.15),
    },
    "Java Developer": {
        "spring boot": ("2023H2", 0.35, 0.50),
        "kotlin": ("2023H2", 0.12, 0.22),
        "kafka": ("2023H2", 0.18, 0.30),
        "grpc": ("2024H1", 0.06, 0.15),
        "microservice": ("2023H2", 0.30, 0.40),
        "spring ai": ("2025H1", 0.03, 0.15),
        "llm": ("2024H1", 0.03, 0.20),
    },
    "Product Manager": {
        "generative ai": ("2023H2", 0.05, 0.40),
        "ai product strategy": ("2024H1", 0.03, 0.30),
        "prompt engineering": ("2024H1", 0.03, 0.20),
        "llm": ("2024H1", 0.04, 0.30),
        "data driven decision making": ("2023H2", 0.15, 0.25),
        "a b testing": ("2023H2", 0.15, 0.22),
    },
    "UX Designer": {
        "figma": ("2023H2", 0.45, 0.60),
        "design systems": ("2023H2", 0.20, 0.35),
        "ai design tools": ("2024H1", 0.04, 0.30),
        "conversational ui": ("2024H2", 0.03, 0.18),
        "accessibility": ("2023H2", 0.12, 0.25),
        "user research": ("2023H2", 0.20, 0.28),
    },
    "C++ Developer": {
        "rust": ("2023H2", 0.05, 0.15),
        "cmake": ("2023H2", 0.15, 0.22),
        "cuda": ("2024H1", 0.04, 0.18),
        "gpu programming": ("2024H1", 0.04, 0.15),
        "embedded linux": ("2023H2", 0.10, 0.16),
        "llm inference": ("2025H1", 0.03, 0.12),
    },
    "Data Engineer": {
        "dbt": ("2023H2", 0.08, 0.30),
        "snowflake": ("2023H2", 0.10, 0.28),
        "databricks": ("2023H2", 0.08, 0.28),
        "lakehouse": ("2024H1", 0.04, 0.18),
        "vector database": ("2024H1", 0.04, 0.25),
        "real time streaming": ("2023H2", 0.10, 0.22),
        "data mesh": ("2024H1", 0.03, 0.10),
        "airflow": ("2023H2", 0.18, 0.28),
    },
    "Data Scientist": {
        "llm": ("2023H2", 0.15, 0.65),
        "generative ai": ("2023H2", 0.10, 0.50),
        "rag": ("2024H1", 0.05, 0.40),
        "prompt engineering": ("2023H2", 0.05, 0.30),
        "fine tuning": ("2024H1", 0.05, 0.28),
        "hugging face": ("2023H2", 0.08, 0.25),
        "transformers": ("2023H2", 0.10, 0.30),
        "mlops": ("2023H2", 0.10, 0.25),
        "langchain": ("2024H1", 0.04, 0.22),
        "vector database": ("2024H1", 0.04, 0.25),
        "ai agents": ("2025H1", 0.05, 0.30),
        "pytorch": ("2023H2", 0.20, 0.35),
    },
    "Cyber Security": {
        "zero trust": ("2023H2", 0.08, 0.25),
        "cloud security": ("2023H2", 0.20, 0.40),
        "ai security": ("2024H2", 0.03, 0.22),
        "devsecops": ("2023H2", 0.10, 0.25),
        "threat intelligence": ("2023H2", 0.12, 0.22),
        "identity and access management": ("2023H2", 0.12, 0.20),
    },
}

# Skills whose market presence declined 2024-2026: down-weighted (not removed)
# when sampling base skills for synthetic postings.
FADING_SKILLS: dict[str, list[str]] = {
    "Frontend Developer": ["jquery", "angular js", "backbone", "bootstrap"],
    "Backend Developer": ["perl", "soap", "wordpress"],
    "QA Automation Engineer": ["selenium"],
    "Java Developer": ["jsp", "struts", "applets"],
    "Software Engineer": ["perl", "svn"],
    "Data Scientist": ["matlab"],
    "DevOps Engineer": ["jenkins", "chef", "puppet"],
    "C++ Developer": [],
    "Data Engineer": ["hadoop", "hive"],
    "Product Manager": [],
    "UX Designer": ["invision", "sketch"],
    "Cyber Security": [],
}


def ramp_probability(skill_def: tuple[str, float, float], period: str) -> float:
    """Linear ramp of mention-probability from start_period to the last period."""
    start, p_start, p_end = skill_def
    if period not in PERIODS or PERIODS.index(period) < PERIODS.index(start):
        return 0.0
    span = len(PERIODS) - 1 - PERIODS.index(start)
    if span <= 0:
        return p_end
    step = (PERIODS.index(period) - PERIODS.index(start)) / span
    return p_start + (p_end - p_start) * step
