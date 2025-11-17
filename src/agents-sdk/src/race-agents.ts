/**
 * Race Agents - Parallel execution pattern
 * 
 * Execute multiple agents in parallel and return the first successful result.
 * Useful for fallback patterns and parallel processing.
 * 
 * @module race-agents
 */

import { Agent, type RunOptions, type RunResult } from './agent';
import { run } from './agent';

/**
 * Race multiple agents - execute in parallel, return first successful result
 * 
 * @param agents - Array of agents to race
 * @param input - Input message or messages
 * @param options - Run options
 * @returns First successful result with winningAgent
 * 
 * @example
 * ```typescript
 * const result = await raceAgents([agent1, agent2, agent3], 'Query');
 * console.log(result.winningAgent.name);
 * console.log(result.metadata.raceParticipants);
 * ```
 */
export async function raceAgents<TContext = any, TOutput = string>(
  agents: Agent<TContext, TOutput>[],
  input: string | any[],
  options: RunOptions<TContext> = {}
): Promise<RunResult<TOutput> & { winningAgent: Agent<TContext, TOutput> }> {
  if (agents.length === 0) {
    throw new Error('No agents provided for race');
  }

  if (agents.length === 1) {
    const result = await run(agents[0], input, options);
    return { 
      ...result, 
      winningAgent: agents[0],
      metadata: {
        ...result.metadata,
        raceWinners: [agents[0].name],
        raceParticipants: [agents[0].name],
      }
    };
  }

  // Execute all agents in parallel
  const promises = agents.map(async (agent, index) => {
    try {
      const result = await run(agent, input, options);
      return { 
        result, 
        agent, 
        index,
        success: true 
      };
    } catch (error) {
      return { 
        result: null, 
        agent, 
        index,
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  });

  // Race: wait for first successful result
  const results = await Promise.allSettled(promises);
  
  // Find first successful result
  for (const settled of results) {
    if (settled.status === 'fulfilled' && settled.value.success) {
      const { result, agent } = settled.value;
      return { 
        ...result!, 
        winningAgent: agent,
        metadata: {
          ...result!.metadata,
          raceWinners: [agent.name],
          raceParticipants: agents.map(a => a.name),
        }
      };
    }
  }

  // If all failed, throw error with details
  const errors = results
    .map((r, i) => r.status === 'fulfilled' && !r.value.success ? r.value.error : null)
    .filter(Boolean);
  
  throw new Error(
    `All agents failed in race:\n${errors.map((e, i) => `  ${agents[i].name}: ${e?.message}`).join('\n')}`
  );
}

