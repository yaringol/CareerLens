from typing import Dict, Any, Iterable, List
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import time

from ..driver import build_driver
from ..extractors.base import BaseExtractor
from ..config import settings


class BioCatchExtractor(BaseExtractor):
    """
    Extractor for BioCatch careers page.
    Handles dynamic job loading and extracts job details.
    """

    def __init__(self):
        self.driver = build_driver(settings.headless)
        self.wait = WebDriverWait(self.driver, 20)
        self._job_titles_map = {}  # Store job titles from cards

    def _apply_filters(self):
        """
        Apply filters for R&D department and Israel location.
        """
        try:
            # Wait for filter buttons to be available
            print("Waiting for filter buttons to load...")
            time.sleep(3)
            
            # Wait for filter sections to be visible
            try:
                self.wait.until(EC.presence_of_element_located((By.TAG_NAME, "button")))
            except TimeoutException:
                print("Warning: Filter buttons not found")
                return
            
            # Find all buttons on the page
            all_buttons = self.driver.find_elements(By.TAG_NAME, "button")
            print(f"Found {len(all_buttons)} buttons on page")
            
            # Filter by R&D department - look for exact match
            rnd_clicked = False
            for btn in all_buttons:
                btn_text = btn.text.strip()
                if btn_text == "R&D" or btn_text == "R & D":
                    try:
                        # Check if button is clickable
                        if btn.is_displayed() and btn.is_enabled():
                            # Scroll into view
                            self.driver.execute_script("arguments[0].scrollIntoView(true);", btn)
                            time.sleep(0.5)
                            # Click using JavaScript
                            self.driver.execute_script("arguments[0].click();", btn)
                            print("✓ Applied R&D filter")
                            rnd_clicked = True
                            time.sleep(3)  # Wait for filter to apply and page to update
                            break
                    except Exception as e:
                        print(f"Error clicking R&D button: {e}")
                        continue
            
            if not rnd_clicked:
                print("⚠ Warning: Could not apply R&D filter")
            
            # Refresh button list after R&D filter
            time.sleep(1)
            all_buttons = self.driver.find_elements(By.TAG_NAME, "button")
            
            # Filter by Israel location - look for exact match
            israel_clicked = False
            for btn in all_buttons:
                btn_text = btn.text.strip()
                if btn_text == "Israel - TLV" or btn_text == "Israel-TLV":
                    try:
                        if btn.is_displayed() and btn.is_enabled():
                            self.driver.execute_script("arguments[0].scrollIntoView(true);", btn)
                            time.sleep(0.5)
                            self.driver.execute_script("arguments[0].click();", btn)
                            print("✓ Applied Israel - TLV filter")
                            israel_clicked = True
                            time.sleep(3)  # Wait for filter to apply and page to update
                            break
                    except Exception as e:
                        print(f"Error clicking Israel button: {e}")
                        continue
            
            if not israel_clicked:
                print("⚠ Warning: Could not apply Israel - TLV filter")
            
            # Wait for filtered results to load
            time.sleep(2)
            print("Filters applied, waiting for results to load...")
                    
        except Exception as e:
            print(f"Error applying filters: {e}")

    def collect_job_urls(self, start_url: str, max_jobs: int) -> Iterable[str]:
        """
        Navigate to BioCatch careers page, apply filters, and collect job listing URLs.
        """
        self.driver.get(start_url)
        
        # Wait for the page to load
        try:
            self.wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            time.sleep(3)  # Wait for page to fully load
        except TimeoutException:
            print("Warning: Page did not load")
            return []

        # Apply filters for R&D and Israel
        self._apply_filters()
        
        # Wait for filtered jobs to load
        time.sleep(3)
        
        job_urls: List[str] = []
        
        # Find job cards/links - try multiple selectors
        selectors = [
            "a[href*='comeet.com']",
            "a[href*='job']",
            "[class*='job-card'] a",
            "[class*='job'] a",
            "[class*='card'] a",
        ]
        
        for selector in selectors:
            try:
                elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                for elem in elements:
                    href = elem.get_attribute("href")
                    if href and href not in job_urls:
                        # Filter for comeet.com job links
                        if 'comeet.com' in href.lower() and 'job' in href.lower():
                            job_urls.append(href)
                
                if job_urls:
                    break
            except Exception as e:
                print(f"Error with selector {selector}: {e}")
                continue

        # If no URLs found, try to find job cards and extract from them
        if not job_urls:
            try:
                # Look for job cards that might contain links
                cards = self.driver.find_elements(By.CSS_SELECTOR, "[class*='card'], [class*='job'], [class*='position']")
                for card in cards:
                    try:
                        link = card.find_element(By.TAG_NAME, "a")
                        href = link.get_attribute("href")
                        if href and 'comeet.com' in href.lower():
                            if href not in job_urls:
                                job_urls.append(href)
                    except:
                        continue
            except Exception as e:
                print(f"Error finding job cards: {e}")

        # Store job titles from cards before navigating away
        self._job_titles_map = {}
        
        # Try to extract job titles from cards on the main page
        try:
            # Look for job cards - try various selectors
            card_selectors = [
                "[class*='job-card']",
                "[class*='jobCard']",
                "[class*='card']",
                "article",
                "[class*='position']",
            ]
            
            for card_selector in card_selectors:
                try:
                    cards = self.driver.find_elements(By.CSS_SELECTOR, card_selector)
                    if cards:
                        for card in cards:
                            try:
                                # Find link in card
                                link = card.find_element(By.TAG_NAME, "a")
                                href = link.get_attribute("href")
                                
                                if href and 'comeet.com' in href.lower():
                                    # Try to find title in card
                                    title = None
                                    title_selectors_in_card = [
                                        "h1", "h2", "h3", "h4",
                                        "[class*='title']",
                                        "[class*='Title']",
                                        "[class*='job-title']",
                                    ]
                                    
                                    for title_sel in title_selectors_in_card:
                                        try:
                                            title_elem = card.find_element(By.CSS_SELECTOR, title_sel)
                                            title_text = title_elem.text.strip()
                                            if (title_text and 
                                                len(title_text) > 3 and
                                                title_text.lower() not in ['description', 'requirements', 'all jobs', 'apply']):
                                                title = title_text
                                                break
                                        except:
                                            continue
                                    
                                    # If found title, store it
                                    if title:
                                        self._job_titles_map[href] = title
                                    
                                    # Add to job_urls if not already there
                                    if href not in job_urls:
                                        job_urls.append(href)
                            except:
                                continue
                        
                        if job_urls:
                            break  # Found jobs with this selector
                except Exception as e:
                    print(f"Error with card selector {card_selector}: {e}")
                    continue
        except Exception as e:
            print(f"Error extracting job titles from cards: {e}")
        
        print(f"Found {len(job_urls)} job URLs")
        if self._job_titles_map:
            print(f"Extracted {len(self._job_titles_map)} job titles from cards")
        
        return job_urls[:max_jobs]

    def extract_job(self, job_url: str) -> Dict[str, Any]:
        """
        Extract job details from a BioCatch job listing page.
        """
        self.driver.get(job_url)
        
        # Wait for page content to load
        try:
            self.wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            time.sleep(2)  # Additional wait for dynamic content
        except TimeoutException:
            pass

        # Initialize result dictionary
        result = {
            "source": "biocatch",
            "url": job_url,
            "job_title": None,
            "company": "BioCatch",
            "location": None,  # Will be extracted from page
            "department": None,  # Will be extracted from page
            "description": None,
            "requirements": None,
            "full_text": None,
        }

        # First, check if we have the title from the job card
        if job_url in self._job_titles_map:
            result["job_title"] = self._job_titles_map[job_url]
        
        # Try to extract job title - prioritize more specific selectors
        if not result["job_title"]:
            title_selectors = [
                "h1",
                "[class*='job-title']",
                "[class*='JobTitle']",
                "[class*='position-title']",
                "h2[class*='title']",
                "h2",
                "[class*='title'] h1",
                "[class*='title'] h2",
                "[class*='Title']",
            ]
            
            for selector in title_selectors:
                try:
                    title_elems = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    for title_elem in title_elems:
                        title_text = title_elem.text.strip()
                        # Filter out generic text like "Description", "Requirements", etc.
                        if (title_text and 
                            len(title_text) > 3 and 
                            title_text.lower() not in ['description', 'requirements', 'all jobs', 'apply for this job', 'biocatch']):
                            result["job_title"] = title_text
                            break
                    if result["job_title"]:
                        break
                except NoSuchElementException:
                    continue
        
        # If still no title, try to extract from page title or URL
        if not result["job_title"]:
            try:
                # Try to get from page title
                page_title = self.driver.title
                if page_title and page_title != "BioCatch" and "BioCatch" not in page_title:
                    result["job_title"] = page_title
                else:
                    # Extract from URL as last resort
                    url_parts = job_url.split('/')
                    if len(url_parts) > 0:
                        # Get the job name from URL (usually second to last part)
                        for part in reversed(url_parts):
                            if part and part not in ['job', 'jobs', 'career', 'careers', '']:
                                last_part = part.replace('-', ' ').title()
                                if last_part and len(last_part) > 3:
                                    result["job_title"] = last_part
                                    break
            except Exception as e:
                print(f"Error extracting title from fallback: {e}")

        # Extract actual location from the job page
        location_selectors = [
            "//*[contains(text(), 'Israel')]",
            "//*[contains(text(), 'TLV')]",
            "//*[contains(text(), 'United States')]",
            "//*[contains(text(), 'USA')]",
            "[class*='location']",
            "[class*='Location']",
        ]
        
        location_found = None
        for selector in location_selectors:
            try:
                if selector.startswith("//"):
                    loc_elems = self.driver.find_elements(By.XPATH, selector)
                else:
                    loc_elems = self.driver.find_elements(By.CSS_SELECTOR, selector)
                
                for loc_elem in loc_elems:
                    location_text = loc_elem.text.strip()
                    if location_text:
                        # Check for location keywords
                        text_lower = location_text.lower()
                        if 'israel' in text_lower or 'tlv' in text_lower:
                            location_found = location_text
                            break
                        elif 'united states' in text_lower or 'usa' in text_lower or 'us' in text_lower:
                            location_found = location_text
                            break
                
                if location_found:
                    break
            except Exception:
                continue
        
        result["location"] = location_found if location_found else None
        
        # Extract actual department from the job page
        department_found = None
        dept_keywords = ['R&D', 'R & D', 'Research', 'Solutions', 'Sales', 'Marketing']
        for keyword in dept_keywords:
            try:
                dept_elems = self.driver.find_elements(By.XPATH, f"//*[contains(text(), '{keyword}')]")
                for dept_elem in dept_elems:
                    dept_text = dept_elem.text.strip()
                    if dept_text and len(dept_text) < 20:  # Department names are usually short
                        department_found = dept_text
                        break
                if department_found:
                    break
            except Exception:
                continue
        
        result["department"] = department_found if department_found else None

        # Extract job description and requirements separately
        # Get the main content area
        try:
            # Try to find main content container
            main_content = None
            content_selectors = [
                "main",
                "article",
                "[role='main']",
                "[class*='content']",
                "[class*='Content']",
                "[class*='job-content']",
            ]
            
            for selector in content_selectors:
                try:
                    elem = self.driver.find_element(By.CSS_SELECTOR, selector)
                    if elem and elem.text.strip():
                        main_content = elem
                        break
                except:
                    continue
            
            if not main_content:
                main_content = self.driver.find_element(By.TAG_NAME, "body")
            
            full_text = main_content.text.strip()
            
            # Split text into lines for parsing
            lines = full_text.split('\n')
            
            # Find section boundaries
            description_start = 0
            description_end = len(lines)
            requirements_start = len(lines)
            
            # Look for section headers
            section_markers = {
                'description': ['description', 'overview', 'summary', 'role overview', 'about', 'main responsibilities', 'key responsibilities', 'responsibilities'],
                'requirements': ['requirements', 'qualifications', 'required qualifications', 'preferred qualifications', 'must have', 'should have', 'experience', 'skills', 'education']
            }
            
            for i, line in enumerate(lines):
                line_lower = line.lower().strip()
                
                # Check for requirements section start
                if requirements_start == len(lines):
                    for marker in section_markers['requirements']:
                        if marker in line_lower and len(line_lower) < 50:  # Section header, not content
                            requirements_start = i
                            description_end = i
                            break
                
                # Check for description section start (after company intro)
                if description_start == 0 and i > 5:  # Skip initial company description
                    for marker in section_markers['description']:
                        if marker in line_lower and len(line_lower) < 50:
                            description_start = i
                            break
            
            # Extract description (skip company intro, get job-specific content)
            description_lines = []
            in_job_section = False
            company_intro_end = False
            
            for i, line in enumerate(lines[:description_end]):
                line_stripped = line.strip()
                if not line_stripped:
                    continue
                
                # Skip company introduction (usually first paragraph about BioCatch)
                if not company_intro_end:
                    if 'biocatch' in line_stripped.lower() and len(line_stripped) > 100:
                        company_intro_end = True
                        continue
                    elif i > 10:  # After first few lines, assume intro is done
                        company_intro_end = True
                
                # Start collecting when we see job-specific content
                if not in_job_section:
                    job_keywords = ['responsibilities', 'overview', 'role', 'position', 'main', 'key', 'you will']
                    if any(keyword in line_stripped.lower() for keyword in job_keywords):
                        in_job_section = True
                
                if in_job_section or company_intro_end:
                    # Skip section headers and navigation text
                    if (line_stripped.lower() not in ['description', 'requirements', 'all jobs', 'apply for this job'] and
                        len(line_stripped) > 10 and
                        not line_stripped.startswith('ALL JOBS') and
                        not line_stripped.startswith('APPLY')):
                        description_lines.append(line_stripped)
            
            # Extract requirements
            requirements_lines = []
            in_requirements = False
            
            for i, line in enumerate(lines[requirements_start:], start=requirements_start):
                line_stripped = line.strip()
                if not line_stripped:
                    continue
                
                # Check if we've entered requirements section
                if not in_requirements:
                    req_keywords = ['requirement', 'qualification', 'experience', 'skills', 'education', 'must', 'should']
                    if any(keyword in line_stripped.lower() for keyword in req_keywords) and len(line_stripped) < 100:
                        in_requirements = True
                
                if in_requirements:
                    # Skip navigation and footer text
                    if (line_stripped.lower() not in ['all jobs', 'apply for this job', 'description'] and
                        not line_stripped.startswith('ALL JOBS') and
                        not line_stripped.startswith('APPLY') and
                        len(line_stripped) > 5):
                        requirements_lines.append(line_stripped)
            
            # Clean up and join
            description_text = '\n'.join(description_lines).strip()
            requirements_text = '\n'.join(requirements_lines).strip()
            
            # Remove duplicate content if present
            if description_text and requirements_text:
                # Remove description text from requirements if it appears there
                desc_sentences = description_text.split('\n')[:3]  # First few sentences
                for desc_sent in desc_sentences:
                    if len(desc_sent) > 50 and desc_sent in requirements_text:
                        requirements_text = requirements_text.replace(desc_sent, '').strip()
            
            result["description"] = description_text if description_text else None
            result["requirements"] = requirements_text if requirements_text else None
            
            # If we couldn't separate, store full text for manual review
            if not description_text and not requirements_text:
                result["full_text"] = full_text
                
        except Exception as e:
            print(f"Error extracting description/requirements: {e}")
            result["description"] = None
            result["requirements"] = None

        # If we still don't have a title, try to get it from the page title
        if not result["job_title"]:
            result["job_title"] = self.driver.title

        # Validate that this job matches our filters (R&D and Israel - TLV)
        # Only return jobs that match both criteria
        location_match = result["location"] and ('israel' in result["location"].lower() or 'tlv' in result["location"].lower())
        dept_match = result["department"] and ('r&d' in result["department"].lower() or 'r & d' in result["department"].lower())
        
        # If location or department don't match, mark for filtering
        if not location_match or not dept_match:
            result["_filtered_out"] = True
            result["_filter_reason"] = f"Location: {result['location']}, Department: {result['department']}"
        
        return result

    def close(self):
        """Close the browser driver."""
        self.driver.quit()
