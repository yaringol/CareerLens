/**
 * Mock DS Model — returns 5 canonical core skills for a given job title.
 *
 * In production this will be replaced by a vector DB lookup:
 * the normalized job title will be used to query the canonical job profile
 * and retrieve model-derived core skills via semantic similarity search.
 */

const CORE_SKILLS_BY_TITLE: Record<string, string[]> = {
  'Software Engineer': [
    'software design and architecture',
    'code review and quality assurance',
    'debugging and troubleshooting',
    'testing and CI/CD',
    'system scalability and performance',
  ],
  'Data Scientist': [
    'machine learning model development',
    'statistical analysis and experimentation',
    'Python for data science',
    'data visualization and storytelling',
    'SQL and data querying',
  ],
  'Product Manager': [
    'product strategy and roadmap planning',
    'stakeholder management',
    'user research and discovery',
    'agile and scrum methodologies',
    'data-driven decision making',
  ],
  'DevOps Engineer': [
    'CI/CD pipeline design and automation',
    'cloud infrastructure management (AWS/GCP/Azure)',
    'Docker and containerization',
    'Kubernetes orchestration',
    'infrastructure as code (Terraform/Ansible)',
  ],
  'Frontend Developer': [
    'React or modern frontend framework development',
    'responsive and accessible UI design',
    'JavaScript and TypeScript',
    'cross-browser compatibility and performance',
    'collaboration with UX and backend teams',
  ],
};

export function getCoreSkills(jobTitle: string): string[] | null {
  return CORE_SKILLS_BY_TITLE[jobTitle] ?? null;
}
