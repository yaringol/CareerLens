import os
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

from pymongo import MongoClient

import spacy
from spacy.matcher import PhraseMatcher
from skillNer.general_params import SKILL_DB
from skillNer.skill_extractor_class import SkillExtractor

import numpy as np

PRE_PROCESSED_FILENAME = "linkedin_24_hour_preprocessed.jsonl"
PROCESSED_FILE_NAME = "linkedin_24_hour_processed_skils.jsonl"

MONGO_URI = os.getenv(
    "MONGO_URI", 
    "mongodb://root:secretpassword@localhost:27017/mydatabase?authSource=admin"
)

print(f"Connecting to MongoDB using URI: {MONGO_URI.split('@')[-1]}") # Safely logs host without credentials
client = MongoClient(MONGO_URI)
db = client.get_default_database() # Dynamically infers the database name from the connection string URL
jobs_collection = db["jobs"]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
}

LOCATION_KEYWORDS = ["תל אביב", "מרכז", "Tel Aviv", "Central Israel", "Ramat Gan", "Herzliya", "Petah Tikva"]

class NpEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super(NpEncoder, self).default(obj)

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
        result["datePosted"] = data.get("datePosted")
        result["source"] = "Linkedin"
        result["url"] = job_url

    return result

def search_linkedin_jobs(keyword: str):
    """Search LinkedIn for job listings."""
    query = quote_plus(f"{keyword}")
    url = f"https://www.linkedin.com/jobs/search/?keywords={query}&location=Israel&f_TPR=r86400"
    print(url)

    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(resp.text, "html.parser")

        for card in soup.find_all("div", class_=re.compile("base-card|job-search-card")):
            link_el = card.find("a", href=True)
            link = link_el["href"] if link_el else ""

            if link:
                job_details = get_linked_job_details(job_url=link, og_title=keyword)
                if job_details and job_details.get("title"):
                    yield job_details

    except Exception as e:
        print(f"LinkedIn error for '{keyword}': {e}")

def search_all_jobs():
    """Search all job sites and return new listings."""
    top_keywords = [
        "SOC Analyst", "Security Analyst", "Cyber Security", "Threat Analyst", 
        "Incident Response", "Security Operations", "SIEM", "Cloud Security",
        "Digital Forensics", "DFIR", "Threat Intelligence", "Detection Engineer",
        "Software Engineer", "Backend Developer", "Frontend Developer", 
        "Fullstack Engineer", "Embedded Engineer", "C++ Developer", 
        "Python Developer", "Go Developer", "Java Developer",
        "Rust Developer", "Kernel Developer", "Driver Developer", 
        "Distributed Systems Engineer", "Firmware Engineer",
        "Security Researcher", "Malware Researcher", "Vulnerability Researcher", 
        "Reverse Engineer", "Exploit Developer", "Security Architect", 
        "Product Security Engineer", "AppSec Engineer", "Cryptographer",
        "Red Teamer", "Penetration Tester", "Security Consultant", 
        "Security Researcher (IoT/Automotive)", "CISO Office Engineer",
        "Data Scientist", "Machine Learning Engineer", "AI Researcher", 
        "Deep Learning Engineer", "Big Data Engineer", "Data Engineer",
        "NLP Engineer", "Computer Vision Engineer", "MLOps Engineer", 
        "Algorithm Engineer", "Reinforcement Learning Researcher",
        "DevOps Engineer", "Site Reliability Engineer (SRE)", "Platform Engineer", 
        "Infrastructure Engineer", "Cloud Architect",
        "Cloud Native Engineer", "Kubernetes Engineer", "DevSecOps Engineer",
        "Product Manager", "UX Designer", "UI Designer", "UX Researcher", 
        "QA Automation Engineer", "SDET", "Product Owner",
        "Technical Product Manager (TPM)", "Product Strategy", "Design Systems Lead",
        "Fintech Engineer", "Chip Design Engineer", "VLSI Engineer", 
        "Hardware Engineer", "FPGA Engineer", "Verification Engineer",
        "Solutions Architect", "Customer Success Engineer (Technical)",
        "Presales Engineer", "Security Researcher (Mobile/Android/iOS)"
    ]

    with open(PRE_PROCESSED_FILENAME, "w", encoding="utf-8") as f:
        for keyword in top_keywords:
            print(f"🔍 Searching: {keyword}...")

            for job_details in search_linkedin_jobs(keyword):
                json_record = json.dumps(job_details, ensure_ascii=False)
                f.write(f"{json_record}\n")

def process_raw_jobs(raw_file=PRE_PROCESSED_FILENAME, output_processed=PROCESSED_FILE_NAME):
    nlp = spacy.load("en_core_web_lg")
    skill_extractor = SkillExtractor(nlp, SKILL_DB, PhraseMatcher)

    def get_skills(text):
        if not text or len(text.strip()) < 5:
            return {}
        try:
            annotations = skill_extractor.annotate(text)
            full_matches = annotations['results']['full_matches']
            ngram_matches = annotations['results']['ngram_scored']
            return { "full_matches": full_matches, "ngram_matches": ngram_matches }
        except:
            return {}

    with open(raw_file, "r") as source_f, open(output_processed, "w") as dest_f:
        for count, line in enumerate(source_f):
            try:
                job = json.loads(line)
                description = job.get("description", "")
                
                # Extract Skills
                job["skills"] = get_skills(description)
                
                # Add Scraping Metadata Fields
                job["scraped_at"] = datetime.utcnow()
                
                # Track original identifiers
                job_id = generate_job_id(job.get("title", ""), job.get("company", ""), job.get("url", ""))
                job["_id"] = job_id
                
                dest_f.write(json.dumps(job, ensure_ascii=False, cls=NpEncoder) + "\n")
                
                # Upsert directly into MongoDB
                mongo_ready_job = json.loads(json.dumps(job, cls=NpEncoder))
                mongo_ready_job["scraped_at"] = job["scraped_at"]

                jobs_collection.replace_one(
                    {"_id": job_id},
                    mongo_ready_job,
                    upsert=True
                )

                if count % 5 == 0:
                    print(f"Processed and Saved {count} lines to MongoDB...")
            except Exception as e:
                print(f"Error on line {count}: {e}")

    print(f"Done! Results written to local disk ({output_processed}) and synced to MongoDB.")
        

if __name__ == "__main__":
    search_all_jobs()
    process_raw_jobs()