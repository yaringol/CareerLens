/**
 * CV content for all 15 test cases: 5 job roles × 3 levels (weak / mid / strong)
 *
 * Scoring expectations (matchScore = avg of 10 skill scores):
 *   weak   → 1.0 – 4.0   (completely unrelated background)
 *   mid    → 4.0 – 6.5   (relevant but entry-level, limited depth)
 *   strong → 6.5 – 10.0  (senior, metrics-rich, expert-level evidence)
 */

const CV_DATA = {

  // ══════════════════════════════════════════════════════════════════
  //  SOFTWARE ENGINEER
  // ══════════════════════════════════════════════════════════════════

  'Software Engineer': {

    weak: {
      name: 'Emily Davis',
      contact: 'emily.davis@email.com | (555) 123-4567',
      summary:
        'Experienced retail store manager with 4 years in team leadership and customer service. ' +
        'Known for driving sales performance, resolving escalations, and scheduling staff efficiently. ' +
        'Looking to transition into a more challenging role.',
      experience: [
        {
          company: 'Fashion Outlet',
          role: 'Store Manager',
          dates: '2020 – Present',
          bullets: [
            'Managed daily operations of a retail store generating $2M annual revenue',
            'Supervised and trained a team of 15 sales associates',
            'Achieved 15% increase in monthly sales through promotional campaigns',
            'Handled inventory tracking using Excel spreadsheets and manual counts',
            'Resolved customer complaints maintaining a 95% satisfaction score',
          ],
        },
        {
          company: 'Grocery Express',
          role: 'Sales Associate',
          dates: '2018 – 2020',
          bullets: [
            'Assisted customers with product selection and checkout',
            'Processed cash and card transactions on POS systems',
            'Maintained store displays and shelving organisation',
          ],
        },
      ],
      education: [
        { degree: 'High School Diploma', institution: 'Lincoln High School', year: '2018' },
      ],
      skills:
        'Customer service, Microsoft Word, Excel spreadsheets, inventory management, ' +
        'cash handling, team leadership, staff scheduling, POS systems, complaint resolution',
      projects:
        'Created a basic Excel spreadsheet to track daily sales figures for the team. ' +
        'Helped set up a Facebook page for the store to post promotions. ' +
        'Assisted manager in organising an annual stock-take event.',
      certifications: '',
    },

    mid: {
      name: 'Jason Lee',
      contact: 'jason.lee@email.com | (555) 234-5678 | github.com/jasonlee-dev',
      summary:
        'Junior software developer with 2 years of experience building web applications using Python and Java. ' +
        'Comfortable with REST API development, relational databases, and Git-based workflows. ' +
        'Currently expanding knowledge in cloud deployment and automated testing.',
      experience: [
        {
          company: 'StartupTech Inc',
          role: 'Junior Software Developer',
          dates: '2022 – Present',
          bullets: [
            'Built backend REST APIs using Python Flask for an inventory management system',
            'Wrote SQL queries and maintained MySQL database schemas with 50 K+ records',
            'Used Git for version control and participated in weekly peer code reviews',
            'Wrote unit tests improving code coverage from 40% to 70%',
            'Joined Agile sprint planning, daily stand-ups, and retrospectives',
            'Debugged and resolved 30+ production bugs within agreed SLA windows',
          ],
        },
        {
          company: 'WebSolutions Ltd',
          role: 'Software Development Intern',
          dates: '2021 – 2022',
          bullets: [
            'Built CRUD web applications using Java Spring Boot',
            'Created HTML/CSS frontend templates aligned with designer mockups',
            'Contributed to shared Git repositories following branching workflow',
          ],
        },
      ],
      education: [
        {
          degree: 'Bachelor of Science in Computer Science',
          institution: 'State University',
          year: '2021',
        },
      ],
      skills:
        'Python, Java, Flask, Spring Boot, MySQL, PostgreSQL, Git, HTML, CSS, ' +
        'JavaScript (ES6), REST APIs, Agile/Scrum, Jira, unit testing (pytest, JUnit)',
      projects:
        'Inventory Management API: REST API with Python Flask and MySQL for product tracking, deployed on a VPS.\n' +
        'Personal Portfolio Site: Simple responsive website built with HTML, CSS, and vanilla JavaScript.\n' +
        'Bug Tracker CLI: Command-line tool in Python that logs and queries bugs stored in SQLite.',
      certifications: '',
    },

    strong: {
      name: 'Marcus Chen',
      contact:
        'marcus.chen@email.com | (555) 345-6789 | github.com/mchen-oss | linkedin.com/in/marcus-chen',
      summary:
        'Senior Software Engineer with 7+ years of experience designing and operating large-scale distributed systems. ' +
        'Expert in Python, Go, and Java with deep knowledge in cloud-native architecture, microservices, system design, ' +
        'and technical leadership. AWS Certified Solutions Architect – Professional. ' +
        'Active open-source contributor with 3,000+ GitHub stars across maintained projects.',
      experience: [
        {
          company: 'TechGiant Corp',
          role: 'Senior Software Engineer',
          dates: '2021 – Present',
          bullets: [
            'Architected event-driven microservices system handling 5 M+ daily requests in Python and Go, achieving 99.99% uptime',
            'Led technical design and code-review process for an 8-engineer team; reduced production defect rate by 45%',
            'Cut system p99 latency by 60% via PostgreSQL query optimisation and Redis caching layer',
            'Built end-to-end CI/CD pipelines with Jenkins, Docker, and Kubernetes on AWS EKS',
            'Mentored 3 junior engineers, all promoted within 18 months',
            'Designed RESTful APIs and GraphQL services following API-first best practices for 2 M+ daily users',
          ],
        },
        {
          company: 'CloudScale Systems',
          role: 'Software Engineer',
          dates: '2019 – 2021',
          bullets: [
            'Built high-performance Python FastAPI services handling 2 M+ daily users with 99.9% SLA',
            'Designed PostgreSQL database schemas with advanced indexing, reducing query time by 80%',
            'Led monolith-to-microservices migration that quadrupled deployment frequency',
            'Achieved 95% automated test coverage (pytest, integration, contract tests) across all services',
            'Merged 12 PRs into FastAPI open-source project (200 K+ monthly downloads)',
          ],
        },
        {
          company: 'Innovate Labs',
          role: 'Software Developer',
          dates: '2017 – 2019',
          bullets: [
            'Developed Java Spring Boot microservices for financial data processing pipelines',
            'Built real-time Kafka pipelines processing 100 K+ events per minute',
            'Implemented RESTful APIs integrated with Stripe, PayPal, and OAuth 2.0',
          ],
        },
      ],
      education: [
        {
          degree: 'Master of Science in Computer Science',
          institution: 'Stanford University',
          year: '2017',
        },
        {
          degree: 'Bachelor of Science in Computer Science',
          institution: 'UC Berkeley',
          year: '2015',
        },
      ],
      skills:
        'Python (expert), Go, Java, C++, Distributed Systems, Microservices Architecture, REST APIs, GraphQL, ' +
        'Docker, Kubernetes, AWS (EC2, Lambda, RDS, ECS, EKS), GCP, Terraform, PostgreSQL, Redis, MongoDB, ' +
        'Kafka, Apache Spark, Git, CI/CD (Jenkins, GitHub Actions), System Design, Algorithms & Data Structures, ' +
        'TDD, BDD, Agile/Scrum, Technical Leadership, Code Review, Performance Engineering',
      projects:
        'PyCache: Distributed caching library for Python microservices — 3,200+ GitHub stars, used in production by 50+ companies.\n' +
        'DistributedTaskQueue: High-performance Go task queue processing 1 M+ jobs/day with at-least-once delivery.\n' +
        'Open-source: 30+ merged PRs across 10+ Python/Go projects including FastAPI and Pydantic.\n' +
        'PyCon 2022 Speaker: "Scaling Python Microservices to 5 M Requests/Day".',
      certifications:
        'AWS Certified Solutions Architect – Professional (2022), ' +
        'Google Cloud Professional Developer (2021), ' +
        'Certified Kubernetes Administrator (CKA) (2023)',
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  DATA SCIENTIST
  // ══════════════════════════════════════════════════════════════════

  'Data Scientist': {

    weak: {
      name: 'Rachel Thompson',
      contact: 'rachel.thompson@email.com | (555) 456-7890',
      summary:
        'Creative marketing coordinator with 3 years of experience managing promotional campaigns and social media channels. ' +
        'Strong written communicator skilled in content creation, event coordination, and brand storytelling.',
      experience: [
        {
          company: 'BrandBoost Agency',
          role: 'Marketing Coordinator',
          dates: '2021 – Present',
          bullets: [
            'Managed social media accounts for 5 clients with 50 K+ total followers',
            'Created monthly engagement reports using Excel charts and pivot tables',
            'Coordinated multi-channel campaigns across email, social media, and print',
            'Tracked engagement rate and click-through metrics in spreadsheets',
            'Collaborated with the design team to produce promotional materials in Canva',
          ],
        },
        {
          company: 'Retail Chain',
          role: 'Sales Associate',
          dates: '2019 – 2021',
          bullets: [
            'Assisted customers with purchasing decisions',
            'Summarised weekly sales figures in Excel for the store manager',
            'Participated in inventory counting and stock ordering',
          ],
        },
      ],
      education: [
        {
          degree: 'Bachelor of Arts in Communications',
          institution: 'State College',
          year: '2019',
        },
      ],
      skills:
        'Microsoft Excel, PowerPoint, Word, Canva, social media management, content writing, ' +
        'email marketing, basic Google Analytics, customer service, event coordination',
      projects:
        'Built an Excel dashboard to track social media KPIs for five client campaigns. ' +
        'Designed and distributed a Google Forms survey to gather customer feedback. ' +
        'Created a monthly newsletter template in Mailchimp for a B2C retail client.',
      certifications: '',
    },

    mid: {
      name: 'Priya Sharma',
      contact: 'priya.sharma@email.com | (555) 567-8901',
      summary:
        'Entry-level data analyst with 1.5 years of experience performing basic data analysis and reporting. ' +
        'Familiar with Python for data manipulation and some exposure to machine learning through coursework. ' +
        'Learning SQL and data visualisation on the job.',
      experience: [
        {
          company: 'DataInsights Co',
          role: 'Junior Data Analyst',
          dates: '2023 – Present',
          bullets: [
            'Cleaned and formatted customer datasets using Python pandas and Excel',
            'Wrote basic SQL queries to pull data from internal databases for reports',
            'Created charts and summary tables in matplotlib and Excel for team presentations',
            'Helped a senior analyst run a logistic regression model in scikit-learn (followed existing code)',
            'Prepared weekly data summaries for the business stakeholder review meetings',
          ],
        },
        {
          company: 'University Research Assistant',
          role: 'Data Collection Assistant',
          dates: '2022 – 2023',
          bullets: [
            'Collected and manually cleaned survey data for a psychology research project',
            'Entered data into SPSS and ran basic descriptive statistics',
            'Assisted in preparing charts for research paper submissions',
          ],
        },
      ],
      education: [
        {
          degree: 'Bachelor of Science in Statistics',
          institution: 'State University',
          year: '2022',
        },
      ],
      skills:
        'Python (pandas, numpy basics), SQL (basic SELECT queries), Excel, matplotlib, ' +
        'descriptive statistics, SPSS, data cleaning, report writing, Jupyter notebooks',
      projects:
        'Sales Summary Dashboard: Excel pivot-table dashboard for weekly sales reporting.\n' +
        'University Capstone: Basic linear regression in Python to predict student grades from study hours.\n' +
        'Personal: Completed Andrew Ng\'s Machine Learning course on Coursera (in progress).',
      certifications: '',
    },

    strong: {
      name: 'Dr. Aisha Williams',
      contact:
        'aisha.williams@email.com | (555) 678-9012 | github.com/aisha-ml | linkedin.com/in/aisha-williams-ds',
      summary:
        'Senior Data Scientist with PhD in Machine Learning and 6+ years of industry experience. ' +
        'Expert in deep learning, NLP, large-scale ML engineering, and production model deployment. ' +
        'Published 5 peer-reviewed papers at NeurIPS and ICML. Kaggle Master with 3 competition medals. ' +
        'Led data-science initiatives delivering $15 M+ in measurable business impact.',
      experience: [
        {
          company: 'AI Labs Corp',
          role: 'Senior Data Scientist',
          dates: '2021 – Present',
          bullets: [
            'Led NLP recommendation engine using fine-tuned BERT — improved click-through rate by 35% (15 M users)',
            'Architected production ML pipeline processing 10 M+ predictions/day (MLflow + Kubernetes + Seldon)',
            'Trained CNN/ResNet computer-vision models for manufacturing defect detection — 97.3% precision, 96.8% recall',
            'Built LSTM and Transformer time-series forecasting models reducing inventory waste by 22%',
            'Reduced model training time 70% via distributed PyTorch DDP on 8-GPU cluster (AWS p3.16xlarge)',
            'Mentored 4 junior data scientists; grew team ML maturity from ad-hoc scripts to reproducible ML pipelines',
          ],
        },
        {
          company: 'DataScale Systems',
          role: 'Data Scientist',
          dates: '2019 – 2021',
          bullets: [
            'Trained ensemble models (XGBoost, LightGBM, Random Forest) for real-time fraud detection — 99.2% AUC-ROC',
            'Engineered features from 1 TB+ daily Kafka streams using PySpark on AWS EMR',
            'Built A/B testing framework supporting 50+ concurrent experiments with correct CUPED variance reduction',
            'Applied causal inference (DiD, propensity-score matching) to measure true lift from product interventions',
            'NeurIPS 2020 publication: "Scalable Fraud Detection with Streaming Feature Engineering"',
          ],
        },
        {
          company: 'Carnegie Mellon Research Lab',
          role: 'ML Research Scientist',
          dates: '2017 – 2019',
          bullets: [
            'Researched multi-modal deep learning architectures; 4 publications at ICML (×2) and NeurIPS (×2)',
            'Developed open-source PyTorch extension library (600+ GitHub stars)',
            'Supervised 3 MSc students on applied ML research projects',
          ],
        },
      ],
      education: [
        {
          degree: 'PhD in Machine Learning (Computer Science)',
          institution: 'Carnegie Mellon University',
          year: '2019',
        },
        {
          degree: 'Master of Science in Statistics',
          institution: 'University of Chicago',
          year: '2015',
        },
        {
          degree: 'Bachelor of Science in Mathematics',
          institution: 'MIT',
          year: '2013',
        },
      ],
      skills:
        'Python (expert), PyTorch, TensorFlow/Keras, scikit-learn, XGBoost, LightGBM, CatBoost, ' +
        'PySpark, SQL, R, Deep Learning (CNN, RNN, LSTM, Transformer, BERT, GPT fine-tuning), ' +
        'NLP, Computer Vision, Reinforcement Learning, Bayesian Methods, Statistical Modelling, ' +
        'Causal Inference, A/B Testing & Experimentation, Feature Engineering, MLflow, Kubeflow, ' +
        'Docker, Kubernetes, AWS SageMaker, GCP Vertex AI, Hadoop, Kafka, Git, Jupyter',
      projects:
        'Kaggle: Gold medal in Tabular Playground Series (top 0.3%); Kaggle Master rank.\n' +
        'Research: 5 papers at NeurIPS / ICML with 300+ combined citations.\n' +
        'Open source: PyTorchExtensions — modular training utilities (600+ GitHub stars).\n' +
        'Production: Recommendation engine serving 50 M daily users with <50 ms p99 latency.',
      certifications:
        'AWS Certified Machine Learning – Specialty (2022), ' +
        'Google Professional Machine Learning Engineer (2023), ' +
        'Deep Learning Specialization – Coursera / Andrew Ng (2018)',
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  PRODUCT MANAGER
  // ══════════════════════════════════════════════════════════════════

  'Product Manager': {

    weak: {
      name: 'Tyler Brown',
      contact: 'tyler.brown@email.com | (555) 789-0123',
      summary:
        'Friendly and reliable customer service representative with 3 years of experience handling inquiries, resolving complaints, ' +
        'and building rapport with customers. Strong interpersonal skills with a consistent track record of positive service interactions.',
      experience: [
        {
          company: 'Telecom Provider',
          role: 'Customer Service Representative',
          dates: '2021 – Present',
          bullets: [
            'Handled 80+ inbound customer calls daily regarding billing and service issues',
            'Collected and relayed customer feedback to the supervisor via written reports',
            'Maintained customer records in CRM software with high accuracy',
            'Participated in team meetings discussing recurring customer pain points',
            'Achieved 92% satisfaction score in quarterly quality reviews',
          ],
        },
        {
          company: 'Downtown Restaurant',
          role: 'Server',
          dates: '2019 – 2021',
          bullets: [
            'Provided attentive table service in a high-volume restaurant environment',
            'Managed a section of 8 tables, coordinating with kitchen and support staff',
            'Upsold menu items, contributing to 10% increase in table average spend',
          ],
        },
      ],
      education: [
        {
          degree: 'Bachelor of Arts in Liberal Arts',
          institution: 'Community College',
          year: '2019',
        },
      ],
      skills:
        'Customer service, verbal and written communication, CRM software, data entry, ' +
        'Microsoft Office Suite, active listening, complaint resolution, time management',
      projects:
        'Suggested a new filing system for customer complaints that the team adopted. ' +
        'Helped onboard 2 new customer service representatives by creating a simple FAQ document. ' +
        'Organised a customer appreciation event for 50 attendees.',
      certifications: '',
    },

    mid: {
      name: 'Maya Rodriguez',
      contact: 'maya.rodriguez@email.com | (555) 890-1234',
      summary:
        'Business analyst with 2 years of experience supporting product and engineering teams. ' +
        'Familiar with Agile processes and user-story writing. ' +
        'Recently transitioned into a junior product role and learning product management practices on the job.',
      experience: [
        {
          company: 'MobileApp Co',
          role: 'Junior Product Analyst',
          dates: '2023 – Present',
          bullets: [
            'Supported the senior PM by documenting user stories and acceptance criteria in Jira tickets',
            'Attended Agile sprint ceremonies (planning, stand-ups, retrospectives) as an observer and note-taker',
            'Pulled basic usage reports from the analytics dashboard to summarise for the team',
            'Helped the PM write one section of a product requirements document for a minor feature',
            'Assisted with setting up a survey to gather user feedback for a planned onboarding change',
          ],
        },
        {
          company: 'SaaS Startup',
          role: 'Business Analyst',
          dates: '2021 – 2023',
          bullets: [
            'Gathered and documented business requirements from stakeholders',
            'Created process-flow diagrams and maintained the team wiki',
            'Worked in Jira to track project tasks; participated in weekly status meetings',
          ],
        },
      ],
      education: [
        {
          degree: 'Bachelor of Science in Business Administration',
          institution: 'State University',
          year: '2021',
        },
      ],
      skills:
        'Jira, Confluence, requirements gathering, process documentation, ' +
        'basic Agile / Scrum familiarity, Excel, Slack, stakeholder communication, ' +
        'survey tools (Typeform, Google Forms), basics of SQL',
      projects:
        'Requirements Document: Co-authored a PRD section for a minor UI change alongside the senior PM.\n' +
        'User Survey: Helped design and distribute a feedback survey for 200 users.\n' +
        'Wiki Clean-up: Reorganised and updated the team Confluence space.',
      certifications: '',
    },

    strong: {
      name: 'Sophia Kim',
      contact: 'sophia.kim@email.com | (555) 901-2345 | linkedin.com/in/sophia-kim-pm',
      summary:
        'Senior Product Manager with 7+ years driving growth for B2B and B2C products at scale. ' +
        'Proven record of launching products generating $50 M+ in new revenue and managing platforms with 10 M+ users. ' +
        'Expert in data-driven product strategy, user research, OKR frameworks, and cross-functional leadership.',
      experience: [
        {
          company: 'TechUnicorn Inc',
          role: 'Senior Product Manager',
          dates: '2021 – Present',
          bullets: [
            'Owned product strategy and roadmap for core platform: 5 M DAU, $30 M ARR',
            'Launched 4 major features delivering $15 M incremental revenue within 12 months',
            'Set and tracked OKRs across 3 cross-functional teams (engineering, design, data science)',
            'Ran 100+ A/B experiments per year using a rigorous hypothesis-driven framework',
            'Quarterly user research programme (500+ quantitative + 40 qualitative respondents) surfacing strategic insights',
            'Improved 90-day user retention by 28% via personalised content recommendations',
            'Mentored 3 junior PMs; authored the company PM career framework adopted org-wide',
          ],
        },
        {
          company: 'GrowthCo',
          role: 'Product Manager',
          dates: '2019 – 2021',
          bullets: [
            'Owned growth roadmap driving 40% user-acquisition increase in 18 months',
            'Designed pricing and packaging strategy that raised self-serve conversion rate 35%',
            'Launched enterprise tier generating $8 M ARR in year one',
            'Led competitive analysis and market-sizing for 3 adjacent market opportunities',
            'Managed relationships with 10 strategic enterprise customers ($1 M+ ARR each)',
          ],
        },
        {
          company: 'ProductFirst',
          role: 'Associate Product Manager',
          dates: '2017 – 2019',
          bullets: [
            'Managed onboarding product for a 500 K-user SaaS platform',
            'Redesigned onboarding flow cutting time-to-value from 14 days to 3 days',
            'Built self-serve analytics dashboard enabling users to monitor their own KPIs',
          ],
        },
      ],
      education: [
        {
          degree: 'Master of Business Administration (MBA)',
          institution: 'Wharton School, University of Pennsylvania',
          year: '2017',
        },
        {
          degree: 'Bachelor of Science in Computer Science',
          institution: 'UC San Diego',
          year: '2013',
        },
      ],
      skills:
        'Product strategy, product roadmap, OKRs & goal-setting, A/B testing & experimentation, ' +
        'qualitative and quantitative user research, data analysis (SQL, Python basics), ' +
        'Figma, Mixpanel, Amplitude, Looker, market research, competitive analysis, ' +
        'PRD writing, feature prioritisation (RICE, ICE, Kano), stakeholder management, ' +
        'cross-functional leadership, go-to-market strategy, pricing strategy, ' +
        'Agile/Scrum, Jira, enterprise sales partnership',
      projects:
        'Platform Growth Initiative: 4 features → $15 M revenue in 12 months.\n' +
        'Research Programme: Quarterly programme that directly shaped 3 consecutive annual strategies.\n' +
        'PM Mentorship: Authored career framework; mentored 3 PMs promoted to senior roles.\n' +
        'ProductCon 2023 Speaker: "Building Data-Driven Product Cultures at Scale".',
      certifications:
        'Product Management Certificate – Stanford Continuing Education (2020), ' +
        'Pragmatic Marketing Certified PMC-VI (2021)',
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  DEVOPS ENGINEER
  // ══════════════════════════════════════════════════════════════════

  'DevOps Engineer': {

    weak: {
      name: 'Kevin Martinez',
      contact: 'kevin.martinez@email.com | (555) 012-3456',
      summary:
        'IT support technician with 3 years of experience providing desktop and help-desk services in corporate environments. ' +
        'Skilled in resolving hardware and software issues for Windows and basic Linux workstations.',
      experience: [
        {
          company: 'Corporate Office HQ',
          role: 'IT Help-Desk Technician',
          dates: '2021 – Present',
          bullets: [
            'Resolved 30+ support tickets daily covering Windows workstations and basic networking',
            'Installed and configured software on employee laptops and desktops',
            'Performed basic Linux troubleshooting: restarting services, checking system logs',
            'Maintained IT-equipment inventory and processed hardware replacements',
            'Managed user accounts and password resets in Active Directory',
          ],
        },
        {
          company: 'School District',
          role: 'Technology Support Assistant',
          dates: '2019 – 2021',
          bullets: [
            'Helped teachers set up technology for classroom instruction',
            'Installed and updated educational software on 100+ school computers',
            'Configured projectors and AV equipment for school events',
          ],
        },
      ],
      education: [
        {
          degree: 'Associate Degree in Information Technology',
          institution: 'Community College',
          year: '2019',
        },
      ],
      skills:
        'Windows administration, basic Linux command line, Active Directory, Microsoft Office, ' +
        'hardware troubleshooting, basic networking (ping, traceroute), ticketing systems, ' +
        'password management, software installation',
      projects:
        'Configured a home Linux server (Ubuntu) to learn basic system administration. ' +
        'Set up a home network with a router and two switches. ' +
        'Helped department migrate shared files to a new Windows file server.',
      certifications: 'CompTIA A+ (2019)',
    },

    mid: {
      name: 'Carlos Gonzalez',
      contact: 'carlos.gonzalez@email.com | (555) 123-4568 | github.com/carlos-devops',
      summary:
        'DevOps engineer with 2.5 years of experience building CI/CD pipelines and managing cloud infrastructure. ' +
        'Hands-on with Docker containerisation, basic Kubernetes deployments, and AWS core services. ' +
        'Comfortable automating operational tasks with Bash and Python scripts.',
      experience: [
        {
          company: 'Tech Startup',
          role: 'DevOps Engineer',
          dates: '2022 – Present',
          bullets: [
            'Built and maintained Jenkins CI/CD pipelines for automated testing and deployment of 4 services',
            'Containerised applications with Docker; deployed to a single-node Kubernetes cluster',
            'Managed AWS infrastructure (EC2, S3, RDS) for development and staging environments',
            'Wrote Bash scripts automating routine maintenance tasks and reducing manual effort by 30%',
            'Configured CloudWatch monitoring with basic alerts for production services',
            'Participated in on-call rotation and resolved infrastructure incidents within SLA',
          ],
        },
        {
          company: 'Web Agency',
          role: 'Junior Systems Administrator / DevOps',
          dates: '2020 – 2022',
          bullets: [
            'Managed Linux web servers for hosting and basic deployment workflows',
            'Set up Docker development environments for the engineering team',
            'Configured Nginx reverse proxies and TLS certificates with Certbot',
          ],
        },
      ],
      education: [
        {
          degree: 'Bachelor of Science in Computer Science',
          institution: 'State University',
          year: '2020',
        },
      ],
      skills:
        'Docker, Kubernetes (basic), Jenkins, CI/CD, AWS (EC2, S3, RDS, CloudWatch), ' +
        'Linux, Bash scripting, Python scripting, Git, Nginx, basic monitoring, Agile',
      projects:
        'CI/CD Pipeline: Automated multi-stage pipeline for 4 microservices — deployment time cut from 2 hours to 15 min.\n' +
        'Docker Migration: Containerised legacy monolith into Docker images with docker-compose.\n' +
        'AWS Infrastructure: Configured VPC, security groups, and auto-scaling group for startup staging environment.',
      certifications: 'AWS Certified Cloud Practitioner (2022)',
    },

    strong: {
      name: 'Ravi Patel',
      contact:
        'ravi.patel@email.com | (555) 234-5679 | github.com/ravip-sre | linkedin.com/in/ravi-patel-sre',
      summary:
        'Senior DevOps / SRE engineer with 6+ years building and operating large-scale cloud infrastructure. ' +
        'Expert in Kubernetes, Terraform, and multi-cloud architectures (AWS, GCP, Azure). ' +
        'Reduced infrastructure costs by $2 M annually while maintaining 99.99% uptime SLAs. ' +
        'Led teams of 5+ engineers; regular conference speaker on cloud-native operations.',
      experience: [
        {
          company: 'CloudFirst Corp',
          role: 'Senior Site Reliability Engineer',
          dates: '2021 – Present',
          bullets: [
            'Architected and managed multi-tenant Kubernetes clusters serving 200+ microservices across AWS, GCP, and Azure',
            'Implemented full Infrastructure-as-Code with Terraform managing 500+ cloud resources; zero manual config drift',
            'Built GitOps platform (ArgoCD + GitHub Actions) enabling multiple deployments daily with zero-downtime rollouts',
            'Designed observability stack: Prometheus, Grafana, Jaeger distributed tracing, ELK — 500+ actionable alerts',
            'Reduced MTTR from 4 hours to 22 minutes for P0/P1 incidents through runbook automation and on-call tooling',
            'Optimised cloud spend by $2 M/year via right-sizing, Spot instances, and Reserved Instance purchasing',
            'Implemented zero-trust security with Istio service mesh and OPA policy engine',
          ],
        },
        {
          company: 'ScaleOps',
          role: 'DevOps Engineer',
          dates: '2019 – 2021',
          bullets: [
            'Migrated 50+ services from bare metal to AWS EKS — reduced operational overhead 60%',
            'Automated configuration management for 200+ servers with Ansible playbooks',
            'Deployed HashiCorp Vault for secrets management and automated TLS certificate rotation',
            'Integrated Snyk and SAST/DAST tooling into CI/CD pipelines for continuous security scanning',
            'Designed multi-region disaster recovery achieving RPO < 15 min and RTO < 30 min',
          ],
        },
        {
          company: 'StartupOps',
          role: 'Systems Engineer',
          dates: '2018 – 2019',
          bullets: [
            'Built initial AWS infrastructure and Terraform modules from scratch',
            'Implemented logging and monitoring using ELK stack and Prometheus/Grafana',
            'Set up first Jenkins CI/CD pipeline with Docker containerised builds',
          ],
        },
      ],
      education: [
        {
          degree: 'Master of Science in Computer Engineering',
          institution: 'Georgia Institute of Technology',
          year: '2018',
        },
        {
          degree: 'Bachelor of Engineering in Electronics',
          institution: 'IIT Bombay',
          year: '2016',
        },
      ],
      skills:
        'Kubernetes (expert), Docker, Terraform, Ansible, Helm, ArgoCD, Flux, ' +
        'AWS (Expert: EC2, EKS, ECS, Lambda, RDS, S3, CloudFront, Route53, IAM, Cost Explorer), ' +
        'GCP (GKE, Cloud Run, BigQuery), Azure (AKS, Azure DevOps), ' +
        'CI/CD (GitHub Actions, Jenkins, GitLab CI), Prometheus, Grafana, Jaeger, ELK Stack, ' +
        'Istio, Linkerd, HashiCorp Vault, Consul, Python, Go, Bash, Linux, ' +
        'Networking (TCP/IP, DNS, BGP basics, load balancing), ' +
        'Security (zero-trust, OWASP, supply-chain hardening), SLO/SLA management, ' +
        'Incident management, chaos engineering (LitmusChaos)',
      projects:
        'Multi-Cloud K8s Platform: Serves 200+ microservices with 99.99% SLA.\n' +
        'Cloud Cost Initiative: $2 M/year savings through automated right-sizing.\n' +
        'GitOps Platform: Deployment lead time cut from 3 days to 45 minutes.\n' +
        'KubeCon NA 2022 Speaker: "Zero-Trust Kubernetes at Scale in Multi-Cloud Environments".',
      certifications:
        'Certified Kubernetes Administrator (CKA) (2022), ' +
        'Certified Kubernetes Security Specialist (CKS) (2023), ' +
        'AWS Certified DevOps Engineer – Professional (2021), ' +
        'HashiCorp Certified Terraform Associate (2022), ' +
        'Google Cloud Professional Cloud Architect (2023)',
    },
  },

  // ══════════════════════════════════════════════════════════════════
  //  FRONTEND DEVELOPER
  // ══════════════════════════════════════════════════════════════════

  'Frontend Developer': {

    weak: {
      name: 'Lisa Chang',
      contact: 'lisa.chang@email.com | (555) 345-6780',
      summary:
        'Creative graphic designer with 4 years of experience producing visual content for print and digital media. ' +
        'Expert in Adobe Creative Suite, with a strong eye for typography, colour theory, and brand identity.',
      experience: [
        {
          company: 'PixelCraft Design Studio',
          role: 'Graphic Designer',
          dates: '2020 – Present',
          bullets: [
            'Designed brand identities, logos, and marketing materials for 20+ clients across retail and hospitality',
            'Created HTML email templates and simple landing-page layouts for marketing campaigns',
            'Applied basic CSS tweaks to client WordPress sites to match brand guidelines',
            'Produced digital assets: social media graphics, banner ads, and presentation decks',
            'Collaborated with web developers, providing design specifications and asset hand-offs in Figma',
          ],
        },
        {
          company: 'Marketing Agency',
          role: 'Junior Designer',
          dates: '2018 – 2020',
          bullets: [
            'Produced print materials: brochures, flyers, and business cards',
            'Updated website content through the WordPress admin panel',
            'Designed social media creatives and paid-ad banners',
          ],
        },
      ],
      education: [
        {
          degree: 'Bachelor of Fine Arts in Graphic Design',
          institution: 'Art Institute',
          year: '2018',
        },
      ],
      skills:
        'Adobe Photoshop, Illustrator, InDesign, Figma, basic HTML, basic CSS, ' +
        'WordPress, Canva, typography, colour theory, brand identity, print production',
      projects:
        'Brand Identity Systems: Designed complete brand identities for 5 small businesses.\n' +
        'HTML Email Templates: Created responsive email templates for 3 marketing campaigns.\n' +
        'WordPress Portfolio: Built personal portfolio site using a WordPress theme with custom CSS colour overrides.',
      certifications: '',
    },

    mid: {
      name: 'David Park',
      contact: 'david.park@email.com | (555) 456-7891 | github.com/davidpark-frontend',
      summary:
        'Frontend developer with 2.5 years of experience building React single-page applications. ' +
        'Proficient in JavaScript ES6+, TypeScript basics, and modern CSS. ' +
        'Delivered production-ready UIs for 3 client applications, integrating REST APIs and collaborating closely with designers.',
      experience: [
        {
          company: 'WebApp Agency',
          role: 'Frontend Developer',
          dates: '2022 – Present',
          bullets: [
            'Built and maintained React SPAs for 3 client projects using functional components and hooks',
            'Implemented responsive layouts with CSS Grid, Flexbox, Bootstrap, and Tailwind CSS',
            'Integrated REST APIs using Axios, managed local state with useState/useReducer',
            'Added TypeScript type definitions to key components to improve maintainability',
            'Participated in code reviews and addressed UI bugs reported by QA',
            'Worked directly with designers to implement Figma mockups as React components',
          ],
        },
        {
          company: 'Freelance',
          role: 'Junior Frontend Developer',
          dates: '2020 – 2022',
          bullets: [
            'Created HTML/CSS/JavaScript websites for small-business clients',
            'Built basic React applications for internal admin tools',
            'Leveraged Bootstrap for rapid responsive prototypes',
          ],
        },
      ],
      education: [
        {
          degree: 'Bachelor of Science in Computer Science',
          institution: 'State University',
          year: '2020',
        },
      ],
      skills:
        'React, JavaScript (ES6+), TypeScript (basic), HTML5, CSS3, Bootstrap, Tailwind CSS, ' +
        'REST API integration, Axios, React hooks, Git, Figma, Agile/Scrum, basic debugging in Chrome DevTools',
      projects:
        'E-commerce Frontend: React SPA with product catalog, cart, and checkout integrating a REST backend.\n' +
        'Analytics Dashboard: React application with chart.js data visualisations for an internal reporting tool.\n' +
        'Portfolio Site: Personal portfolio with React, custom CSS animations, and responsive design.',
      certifications: '',
    },

    strong: {
      name: 'Natalie Foster',
      contact:
        'natalie.foster@email.com | (555) 567-8902 | github.com/natalie-frontend | linkedin.com/in/natalie-foster-fe',
      summary:
        'Senior Frontend Engineer with 6+ years building high-performance, accessible web applications at scale. ' +
        'Expert in React, TypeScript, and web performance optimisation. Led frontend architecture for platforms with 10 M+ users. ' +
        'Open-source maintainer with 5,000+ GitHub stars. Passionate about WCAG accessibility and Core Web Vitals excellence.',
      experience: [
        {
          company: 'BigTech Platform',
          role: 'Senior Frontend Engineer',
          dates: '2021 – Present',
          bullets: [
            'Led frontend architecture for core platform (8 M MAU), achieving Lighthouse performance score 98/100',
            'Built a component library of 60+ accessible React/TypeScript components used across 5 product teams',
            'Improved LCP by 65% and reduced JavaScript bundle size by 50% via code-splitting, lazy loading, and CDN optimisation',
            'Established testing strategy: 95% Jest/React Testing Library unit coverage + 150+ Cypress e2e tests + visual regression',
            'Audited and enforced WCAG 2.1 AA accessibility across all product surfaces (automated + manual screen-reader testing)',
            'Mentored 4 junior engineers and conducted 15+ technical interviews for frontend roles',
            'Introduced micro-frontend architecture (Module Federation) enabling independent team deployments',
          ],
        },
        {
          company: 'GrowthApp',
          role: 'Frontend Engineer',
          dates: '2019 – 2021',
          bullets: [
            'Built React applications with Redux Toolkit and Zustand for complex client-side state management',
            'Implemented Next.js server-side rendering, improving SEO and time-to-first-byte by 80%',
            'Reduced initial bundle by 45% through tree-shaking, dynamic imports, and Webpack bundle analysis',
            'Delivered real-time collaboration features using WebSockets and React Query for live data',
            'Owned frontend build tooling: Webpack configuration, ESLint rule-set, Husky pre-commit hooks',
          ],
        },
        {
          company: 'StartupFE',
          role: 'Junior Frontend Developer',
          dates: '2018 – 2019',
          bullets: [
            'Built React components and pages for a B2C web application serving 200 K users',
            'Implemented responsive, pixel-perfect UIs using styled-components (CSS-in-JS)',
            'Integrated Stripe, Google Maps, and Auth0 third-party APIs',
          ],
        },
      ],
      education: [
        {
          degree: 'Bachelor of Science in Computer Science',
          institution: 'University of Washington',
          year: '2018',
        },
      ],
      skills:
        'React (expert), TypeScript (expert), JavaScript (ES2024), Next.js, Vue 3, ' +
        'HTML5 (semantic), CSS3, CSS-in-JS (styled-components, Emotion), Tailwind CSS, ' +
        'Redux Toolkit, Zustand, React Query / TanStack Query, ' +
        'Jest, React Testing Library, Cypress, Playwright, ' +
        'Web Performance (Core Web Vitals, Lighthouse, WebPageTest), ' +
        'Web Accessibility (WCAG 2.1, ARIA, axe-core), ' +
        'Webpack, Vite, Module Federation, REST APIs, GraphQL, WebSockets, ' +
        'Node.js, Git, CI/CD (GitHub Actions), Agile, Figma, Chrome DevTools profiler',
      projects:
        'ReactUIKit: Open-source React + TypeScript component library with WCAG 2.1 AA compliance and full a11y docs (5,000+ GitHub stars).\n' +
        'Performance Initiative: Led Core Web Vitals optimisation — LCP −65%, CLS 0, FID <50 ms.\n' +
        'Accessibility Rollout: Achieved WCAG 2.1 AA across 8 M-user platform.\n' +
        'JSConf EU 2022 Speaker: "Accessible React at Scale — Lessons from 8 M Users".',
      certifications:
        'Google Professional Web Developer Certification (2022), ' +
        'Certified Web Accessibility Specialist (CWAS) (2023)',
    },
  },
};

module.exports = { CV_DATA };
