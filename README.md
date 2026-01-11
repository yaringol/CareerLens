# CareerLens

CareerLens is a Data Science project designed to help job seekers improve their resumes by analyzing their CV against a specific job description.

The system evaluates how well a candidate’s resume matches a job’s required skills and provides actionable feedback, including a match score and suggestions for improvement.

---

## Project Goals

- Analyze CVs and job descriptions using NLP techniques
- Identify missing or under-emphasized skills
- Generate a skill-based match score
- Provide CV optimization suggestions to improve ATS and recruiter screening results

---

## High-Level Architecture

CareerLens is built using a client–server architecture:

- **Frontend**: React + TypeScript  
- **Backend**: Node.js + TypeScript (API Gateway)  
- **Data Science / NLP**: Python-based pipeline with LLM integration  
- **Database**: MongoDB (prototype stage)

---

## Core Features

- PDF resume parsing (English only)
- Job description input (text or scraped from job boards)
- Automatic extraction of core and dynamic skills
- Skill-level scoring (1–10)
- Global match score calculation
- Gap analysis and CV optimization suggestions

---

## Data Collection

Job descriptions are collected from public job boards using web scraping (Selenium).  
The dataset is used for skill extraction, model calibration, and evaluation.

---

## Project Status

🚧 **Work in Progress**  
This repository is under active development as part of an academic Data Science capstone project.

---

## Team

- Amit Alon  
- May Eliyahu  
- Yarin Golzar  
- Reut Maduel  

Supervisor: Dr. Galit Haim

---

## License

This project is for academic and educational purposes only.