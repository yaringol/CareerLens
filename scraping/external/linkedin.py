import requests
from bs4 import BeautifulSoup
import re
import json
import time
import hashlib
import html
import random
from urllib.parse import quote_plus, urljoin
from datetime import datetime
from typing import List, Dict, Set, Optional


HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
}


LOCATION_KEYWORDS = ["תל אביב", "מרכז", "Tel Aviv", "Central Israel", "Ramat Gan", "Herzliya", "Petah Tikva"]


def generate_job_id(title: str, company: str, url: str) -> str:
    """Generate a unique ID for a job to track duplicates."""
    raw = f"{title}_{company}_{url}".lower().strip()
    return hashlib.md5(raw.encode()).hexdigest()[:12]


def get_linked_job_details(job_url: str, og_title):
    
    while True:
        resp = requests.get(job_url, headers=HEADERS)
        if resp.ok:
            break
        else:
            time.sleep(random.randint(2, 7))
    
    soup = BeautifulSoup(resp.text, 'html.parser')
    script_tag = soup.find('script', type='application/ld+json')

    result = {}
    if script_tag:
        data = json.loads(script_tag.string)
        unacaped_desc = html.unescape(data.get('description', ''))
        clean = re.sub(r'<[^>]+>', ' ', unacaped_desc)
        result["description"] = " ".join(clean.split())
        result["title"] = data.get('title', '')
        result["og_title"] = og_title
        result["employment_type"] = data.get('employmentType', '')
        result["company"] = data.get('hiringOrganization', {}).get('name', '')
        result["industry"] = data.get('industry', '')
        result["skills"] = data.get('skills', '')
        addres_obj = data.get('jobLocation', {}).get('address', {})
        result["location"] = addres_obj.get('addressLocality', '')
        result["country"] = addres_obj.get('addressCountry')
        result["source"] = "Linkedin"
        result["url"] = job_url

    return result


def search_linkedin_jobs(keyword: str):
    """Search LinkedIn for job listings."""
    query = quote_plus(f"{keyword}")
    url = f"https://www.linkedin.com/jobs/search/?keywords={query}&location=Israel&f_TPR=r7776000"
    print(url)

    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(resp.text, "html.parser")

        for card in soup.find_all("div", class_=re.compile("base-card|job-search-card")):
            link_el = card.find("a", href=True)
            link = link_el["href"] if link_el else ""

            if link:
                job_details = get_linked_job_details(job_url=link, og_title=keyword)
                print(job_details)
                if job_details:
                    yield job_details

    except Exception as e:
        print(f"LinkedIn error for '{keyword}': {e}")


def search_all_jobs():
    """Search all job sites and return new listings."""

    # Limit to top keywords to avoid too many requests
    top_keywords = [
        # --- Original Security Ops & Defense ---
        "SOC Analyst", "Security Analyst", "Cyber Security", "Threat Analyst", 
        "Incident Response", "Security Operations", "SIEM", "Cloud Security",
        "Digital Forensics", "DFIR", "Threat Intelligence", "Detection Engineer",

        # --- Software Engineering (Expanded R&D) ---
        "Software Engineer", "Backend Developer", "Frontend Developer", 
        "Fullstack Engineer", "Embedded Engineer", "C++ Developer", 
        "Python Developer", "Go Developer", "Java Developer",
        "Rust Developer", "Kernel Developer", "Driver Developer", 
        "Distributed Systems Engineer", "Firmware Engineer",

        # --- Security Research & Offense (The "Deep" R&D) ---
        "Security Researcher", "Malware Researcher", "Vulnerability Researcher", 
        "Reverse Engineer", "Exploit Developer", "Security Architect", 
        "Product Security Engineer", "AppSec Engineer", "Cryptographer",
        "Red Teamer", "Penetration Tester", "Security Consultant", 
        "Security Researcher (IoT/Automotive)", "CISO Office Engineer",

        # --- Data Science, AI & Algorithms ---
        "Data Scientist", "Machine Learning Engineer", "AI Researcher", 
        "Deep Learning Engineer", "Big Data Engineer", "Data Engineer",
        "NLP Engineer", "Computer Vision Engineer", "MLOps Engineer", 
        "Algorithm Engineer", "Reinforcement Learning Researcher",

        # --- Infrastructure, Cloud & Scale ---
        "DevOps Engineer", "Site Reliability Engineer (SRE)", "Platform Engineer", 
        "Infrastructure Engineer", "Cloud Architect",
        "Cloud Native Engineer", "Kubernetes Engineer", "DevSecOps Engineer",

        # --- Product, UX & Strategy ---
        "Product Manager", "UX Designer", "UI Designer", "UX Researcher", 
        "QA Automation Engineer", "SDET", "Product Owner",
        "Technical Product Manager (TPM)", "Product Strategy", "Design Systems Lead",

        # --- Niche & Emerging Tech (Israel Specific) ---
        "Fintech Engineer", "Chip Design Engineer", "VLSI Engineer", 
        "Hardware Engineer", "FPGA Engineer", "Verification Engineer",
        "Solutions Architect", "Customer Success Engineer (Technical)",
        "Presales Engineer", "Security Researcher (Mobile/Android/iOS)"
    ]

    with open("externl_jobs_month.jsonl", "w", encoding="utf-8") as f:
        for keyword in top_keywords:
            print(f"🔍 Searching: {keyword}...")

            for job_details in search_linkedin_jobs(keyword):
                json_record = json.dumps(job_details, ensure_ascii=False)
                f.write(f"{json_record}\n")


if __name__ == "__main__":
    search_all_jobs()