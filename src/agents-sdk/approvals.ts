/**
 * Human-in-the-Loop Support
 * 
 * Allows agents to request approval before executing sensitive tools
 */

import type { ApprovalConfig, ApprovalResponse, PendingApproval, ApprovalRequiredError as ApprovalRequiredErrorType } from './types';
import { ApprovalRequiredError } from './types';
import { randomBytes } from 'crypto';

// ============================================
// APPROVAL MANAGER
// ============================================

export class ApprovalManager {
  private pendingApprovals = new Map<string, PendingApproval>();
  private approvalResponses = new Map<string, ApprovalResponse>();

  /**
   * Check if a tool requires approval
   */
  requiresApproval(toolName: string, config?: ApprovalConfig): boolean {
    if (!config) return false;
    return config.requiredForTools?.includes(toolName) || false;
  }

  /**
   * Request approval for a tool execution
   */
  async requestApproval(
    toolName: string,
    args: any,
    config: ApprovalConfig
  ): Promise<ApprovalResponse> {
    const approvalToken = this.generateToken();

    // Store pending approval
    const pending: PendingApproval = {
      toolName,
      args,
      approvalToken,
      requestedAt: Date.now(),
      status: 'pending',
    };
    this.pendingApprovals.set(approvalToken, pending);

    try {
      // Request approval from the configured handler
      const response = await Promise.race([
        config.requestApproval(toolName, args),
        this.timeout(config.timeout || 300000), // Default 5 minutes
      ]);

      // Update status
      pending.status = response.approved ? 'approved' : 'rejected';
      this.approvalResponses.set(approvalToken, response);

      return response;
    } catch (error) {
      pending.status = 'timeout';
      throw new Error(`Approval timeout for tool: ${toolName}`);
    }
  }

  /**
   * Get pending approval by token
   */
  getPendingApproval(token: string): PendingApproval | undefined {
    return this.pendingApprovals.get(token);
  }

  /**
   * Submit approval response
   */
  submitApproval(token: string, response: ApprovalResponse): void {
    const pending = this.pendingApprovals.get(token);
    if (pending) {
      pending.status = response.approved ? 'approved' : 'rejected';
      this.approvalResponses.set(token, response);
    }
  }

  /**
   * Get all pending approvals
   */
  getPendingApprovals(): PendingApproval[] {
    return Array.from(this.pendingApprovals.values()).filter(
      (p) => p.status === 'pending'
    );
  }

  /**
   * Clear old pending approvals
   */
  clearExpired(maxAge: number = 600000): void {
    const now = Date.now();
    for (const [token, pending] of this.pendingApprovals) {
      if (now - pending.requestedAt > maxAge) {
        pending.status = 'timeout';
        this.pendingApprovals.delete(token);
      }
    }
  }

  private generateToken(): string {
    return randomBytes(16).toString('hex');
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), ms);
    });
  }
}

// ============================================
// GLOBAL APPROVAL MANAGER
// ============================================

let globalApprovalManager: ApprovalManager | null = null;

export function getGlobalApprovalManager(): ApprovalManager {
  if (!globalApprovalManager) {
    globalApprovalManager = new ApprovalManager();
  }
  return globalApprovalManager;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Create a simple CLI approval handler
 */
export function createCLIApprovalHandler(): ApprovalConfig['requestApproval'] {
  return async (toolName: string, args: any): Promise<ApprovalResponse> => {
    // In a real implementation, this would prompt the user in the CLI
    // For now, return a promise that can be resolved externally
    console.log(`\n⚠️  Approval required for tool: ${toolName}`);
    console.log('Arguments:', JSON.stringify(args, null, 2));
    console.log('Approve? (y/n)');

    // This is a placeholder - in real use, implement proper CLI prompts
    return new Promise((resolve) => {
      if (process.stdin.isTTY) {
        process.stdin.once('data', (data) => {
          const input = data.toString().trim().toLowerCase();
          resolve({
            approved: input === 'y' || input === 'yes',
            reason: input === 'y' ? undefined : 'User rejected',
          });
        });
      } else {
        // Non-interactive - auto-reject
        resolve({
          approved: false,
          reason: 'Non-interactive environment',
        });
      }
    });
  };
}

/**
 * Create a webhook approval handler
 */
export function createWebhookApprovalHandler(
  webhookUrl: string,
  apiKey?: string
): ApprovalConfig['requestApproval'] {
  return async (toolName: string, args: any): Promise<ApprovalResponse> => {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'Authorization': `Bearer ${apiKey}` }),
      },
      body: JSON.stringify({
        toolName,
        args,
        timestamp: Date.now(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook approval request failed: ${response.statusText}`);
    }

    return await response.json() as ApprovalResponse;
  };
}

/**
 * Create an approval handler that always approves (for testing)
 */
export function createAutoApproveHandler(): ApprovalConfig['requestApproval'] {
  return async (toolName: string, args: any): Promise<ApprovalResponse> => {
    console.log(`✅ Auto-approved: ${toolName}`);
    return { approved: true };
  };
}

/**
 * Create an approval handler that always rejects (for testing)
 */
export function createAutoRejectHandler(): ApprovalConfig['requestApproval'] {
  return async (toolName: string, args: any): Promise<ApprovalResponse> => {
    console.log(`❌ Auto-rejected: ${toolName}`);
    return { approved: false, reason: 'Auto-rejected for testing' };
  };
}

