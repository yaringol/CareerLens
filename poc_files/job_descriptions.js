/**
 * Standard job descriptions for the 5 POC roles, passed to POST /api/analyze
 * for dynamic skill extraction. Each value is a single JD string (the test
 * harness also supports a { weak, mid, strong } per-level object).
 *
 * NOTE: This file is part of the (untracked) local POC test suite. It was
 * reconstructed to match what test_poc.js expects: a JOB_DESCRIPTIONS map
 * keyed by the exact job titles in JOB_TITLES.
 */

const JOB_DESCRIPTIONS = {
  'Software Engineer': `
We are hiring a Software Engineer to design, build, and maintain backend services
and APIs. You will write clean, well-tested code, collaborate on system design, and
ship features end to end.

Responsibilities:
- Build and maintain RESTful APIs and microservices
- Write unit and integration tests; participate in code reviews
- Work with relational and NoSQL databases (PostgreSQL, MongoDB)
- Deploy and monitor services in cloud environments

Requirements:
- Strong programming skills in Java, Python, or Node.js
- Experience with data structures, algorithms, and OOP design
- Familiarity with Git, CI/CD, Docker, and SQL
- Understanding of HTTP, REST, and distributed systems
`.trim(),

  'Data Scientist': `
We are looking for a Data Scientist to turn data into actionable insights and
production models. You will explore datasets, build and evaluate machine learning
models, and communicate findings to stakeholders.

Responsibilities:
- Perform exploratory data analysis and statistical modeling
- Build, train, and evaluate machine learning models
- Engineer features and deploy models to production
- Present results with clear visualizations

Requirements:
- Strong Python skills (pandas, NumPy, scikit-learn)
- Solid foundation in statistics, probability, and ML algorithms
- Experience with SQL and data wrangling
- Familiarity with deep learning (TensorFlow or PyTorch) is a plus
`.trim(),

  'Product Manager': `
We are seeking a Product Manager to own the product roadmap and drive features from
discovery to launch. You will work cross-functionally with engineering, design, and
business stakeholders.

Responsibilities:
- Define product strategy, roadmap, and prioritization
- Gather and translate customer requirements into specs
- Run discovery, A/B tests, and analyze product metrics
- Coordinate launches across engineering and marketing

Requirements:
- Experience owning a product roadmap and backlog
- Strong stakeholder management and communication skills
- Data-driven decision making with analytics tools
- Understanding of agile development and user research
`.trim(),

  'DevOps Engineer': `
We are hiring a DevOps Engineer to build and operate our cloud infrastructure and
CI/CD pipelines. You will automate deployments, improve reliability, and manage
observability.

Responsibilities:
- Design and maintain CI/CD pipelines
- Manage infrastructure as code with Terraform
- Operate Kubernetes clusters and containerized workloads
- Set up monitoring, logging, and alerting

Requirements:
- Strong Linux and shell scripting (Bash)
- Hands-on experience with AWS or GCP
- Proficiency with Docker, Kubernetes, and Terraform
- Familiarity with CI/CD tools (Jenkins, GitHub Actions) and monitoring
`.trim(),

  'Frontend Developer': `
We are looking for a Frontend Developer to build responsive, accessible, and
performant web interfaces. You will work closely with designers and backend
engineers to deliver great user experiences.

Responsibilities:
- Build UI components with React and modern JavaScript/TypeScript
- Implement responsive layouts with HTML and CSS
- Integrate REST APIs and manage application state
- Optimize performance and ensure cross-browser compatibility

Requirements:
- Strong JavaScript/TypeScript and React skills
- Solid HTML5, CSS3, and responsive design experience
- Familiarity with state management (Redux) and testing
- Understanding of web performance and accessibility
`.trim(),
};

module.exports = { JOB_DESCRIPTIONS };
