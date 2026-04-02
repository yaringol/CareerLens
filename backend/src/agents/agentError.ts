export class AgentError extends Error {
  constructor(public agentName: string, message: string) {
    super(`[${agentName}] ${message}`);
    this.name = 'AgentError';
  }
}
