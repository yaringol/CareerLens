import requests
from bs4 import BeautifulSoup
import json
import time
import urllib.parse
import re

# Your enriched list of R&D keywords
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

BASE_URL = "https://www.alljobs.co.il"
SEARCH_URL_TEMPLATE = "https://www.alljobs.co.il/SearchResultsGuest.aspx?page={page}&position=&type=&freetxt={query}&region="

def clean_text(text, prefix_to_remove=None):
    """Helper function to clean extracted text and remove standard prefixes."""
    if not text:
        return ""
    text = " ".join(text.split())  # Clean up whitespace and newlines
    if prefix_to_remove:
        for prefix in prefix_to_remove:
            if text.startswith(prefix):
                text = text[len(prefix):].strip()
                break
    return text

def save_job_to_disk(job_data, filename="alljobs_scraped_data.jsonl"):
    """Appends a single job record to a JSON Lines file immediately."""
    with open(filename, 'a', encoding='utf-8') as f:
        # ensure_ascii=False keeps the Hebrew characters intact
        json_record = json.dumps(job_data, ensure_ascii=False)
        f.write(json_record + '\n')

def scrape_alljobs(keywords):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9,he;q=0.8"
    }

    for keyword in keywords:
        print(f"\n--- Starting search for: {keyword} ---")
        encoded_keyword = urllib.parse.quote_plus(keyword)
        page = 1
        
        while True:
            print(f"Scraping page {page} for '{keyword}'...")
            url = SEARCH_URL_TEMPLATE.format(page=page, query=encoded_keyword)
            
            try:
                response = requests.get(url, headers=headers, timeout=10)
                response.raise_for_status()
            except requests.exceptions.RequestException as e:
                print(f"Error fetching page {page}: {e}")
                break

            soup = BeautifulSoup(response.text, 'html.parser')
            job_boxes = soup.find_all('div', class_='job-box')
            
            if not job_boxes:
                print("No more jobs found on this page. Moving to next keyword.")
                break
                
            for box in job_boxes:
                try:
                    # 1. Job Title & URL
                    title_elem = box.find('h2')
                    if not title_elem: continue 
                    job_title = clean_text(title_elem.get_text())
                    a_tag = title_elem.find_parent('a')
                    job_url = BASE_URL + a_tag['href'] if a_tag and 'href' in a_tag.attrs else ""

                    # 2. Company (FIXED)
                    # Look for the category div which holds the company name link
                    company_container = box.find('div', class_='job-content-top-category')
                    if company_container:
                        company = clean_text(company_container.get_text())
                    else:
                        # Fallback for certain "Highlighted" or "VIP" job boxes
                        company = clean_text(box.find('div', class_='T14').get_text()) if box.find('div', class_='T14') else ""

                    # 3. Job Location
                    location_elem = box.find('div', class_=re.compile(r'job-content-top-location'))
                    location = ""
                    if location_elem:
                        location = clean_text(
                            location_elem.get_text(separator=" "), 
                            prefix_to_remove=["מיקום המשרה:", "Location:"]
                        )

                    # 4. Employment Type
                    type_elem = box.find('div', class_=re.compile(r'job-content-top-type'))
                    emp_type = ""
                    if type_elem:
                        emp_type = clean_text(
                            type_elem.get_text(separator=" "), 
                            prefix_to_remove=["סוג משרה:", "Job Type:"]
                        )

                    # 5. Job Description
                    desc_elem = box.find('div', class_=re.compile(r'job-content-top-desc'))
                    description = clean_text(desc_elem.get_text(separator=" ")) if desc_elem else ""

                    # Compile Job Object
                    job_data = {
                        "og_tite": keyword,
                        "title": job_title,
                        "company": company,
                        "location": location,
                        "employment_type": emp_type,
                        "description": description,
                        "url": job_url
                    }
                    
                    # --- THE CHANGE: Save immediately ---
                    save_job_to_disk(job_data)
                    print(f"{job_data}\n")
                    print(f"  -> Saved: {job_title} at {company}")

                except Exception as e:
                    print(f"Error parsing a job box: {e}")
                    continue

            # Pagination Check
            next_page_btn = soup.find('div', class_='jobs-paging-next')
            if not next_page_btn or not next_page_btn.find('a'):
                print(f"Reached the last page for '{keyword}'.")
                break
                
            page += 1
            # Polite scraping sleep
            time.sleep(2)

# Run the script
if __name__ == "__main__":
    # Optional: Clear out the old file before starting a fresh scrape
    # open("alljobs_scraped_data.jsonl", 'w').close()
    
    scrape_alljobs(top_keywords)