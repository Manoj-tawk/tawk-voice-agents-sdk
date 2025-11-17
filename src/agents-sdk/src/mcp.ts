/**
 * Model Context Protocol (MCP) Support
 * 
 * Allows agents to use MCP servers for additional tools and context
 */

import { z } from 'zod';
import { spawn, type ChildProcess } from 'child_process';
import type { MCPServerConfig, MCPTool, ToolDefinition } from './types';

// ============================================
// MCP SERVER MANAGER
// ============================================

export class MCPServerManager {
  private servers: Map<string, MCPServer> = new Map();

  /**
   * Register an MCP server
   */
  async registerServer(config: MCPServerConfig): Promise<void> {
    const server = new MCPServer(config);
    await server.start();
    this.servers.set(config.name, server);
  }

  /**
   * Get tools from all registered servers
   */
  async getTools(): Promise<Record<string, ToolDefinition>> {
    const tools: Record<string, ToolDefinition> = {};

    for (const [serverName, server] of this.servers) {
      const serverTools = await server.getTools();
      
      for (const mcpTool of serverTools) {
        const toolName = `${serverName}_${mcpTool.name}`;
        
        tools[toolName] = {
          description: mcpTool.description,
          parameters: this.convertInputSchemaToZod(mcpTool.inputSchema),
          execute: async (args: any) => {
            return await server.executeTool(mcpTool.name, args);
          },
          mcpServer: serverName,
        };
      }
    }

    return tools;
  }

  /**
   * Get tools from specific server
   */
  async getServerTools(serverName: string): Promise<Record<string, ToolDefinition>> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`MCP server not found: ${serverName}`);
    }

    const tools: Record<string, ToolDefinition> = {};
    const serverTools = await server.getTools();

    for (const mcpTool of serverTools) {
      const toolName = `${serverName}_${mcpTool.name}`;
      
      tools[toolName] = {
        description: mcpTool.description,
        parameters: this.convertInputSchemaToZod(mcpTool.inputSchema),
        execute: async (args: any) => {
          return await server.executeTool(mcpTool.name, args);
        },
        mcpServer: serverName,
      };
    }

    return tools;
  }

  /**
   * Shutdown all servers
   */
  async shutdown(): Promise<void> {
    for (const server of this.servers.values()) {
      await server.stop();
    }
    this.servers.clear();
  }

  /**
   * Convert JSON Schema to Zod schema (simplified)
   */
  private convertInputSchemaToZod(schema: any): z.ZodSchema {
    if (!schema || !schema.properties) {
      return z.object({});
    }

    const shape: Record<string, z.ZodTypeAny> = {};

    for (const [key, value] of Object.entries(schema.properties as any)) {
      const prop = value as any;
      if (prop.type === 'string') {
        shape[key] = z.string();
      } else if (prop.type === 'number') {
        shape[key] = z.number();
      } else if (prop.type === 'boolean') {
        shape[key] = z.boolean();
      } else if (prop.type === 'object') {
        shape[key] = z.object({});
      } else if (prop.type === 'array') {
        shape[key] = z.array(z.any());
      } else {
        shape[key] = z.any();
      }

      if (prop.description) {
        shape[key] = shape[key].describe(prop.description);
      }

      if (!schema.required?.includes(key)) {
        shape[key] = shape[key].optional();
      }
    }

    return z.object(shape);
  }
}

// ============================================
// MCP SERVER (Internal)
// ============================================

class MCPServer {
  private process?: ChildProcess;
  private tools: MCPTool[] = [];
  private messageId = 0;
  private pendingRequests = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();

  constructor(private config: MCPServerConfig) {}

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn(this.config.command, this.config.args || [], {
        env: { ...process.env, ...this.config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (!this.process.stdin || !this.process.stdout) {
        reject(new Error('Failed to create MCP server process'));
        return;
      }

      // Handle stdout (responses from MCP server)
      let buffer = '';
      this.process.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line);
              this.handleMessage(message);
            } catch (error) {
              console.error('Failed to parse MCP message:', error);
            }
          }
        }
      });

      this.process.on('error', (error) => {
        reject(error);
      });

      // Initialize - list tools
      this.sendRequest('tools/list', {}).then((response) => {
        this.tools = response.tools || [];
        resolve();
      }).catch(reject);
    });
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = undefined;
    }
  }

  async getTools(): Promise<MCPTool[]> {
    // Filter by config if specified
    if (this.config.tools && this.config.tools.length > 0) {
      return this.tools.filter(t => this.config.tools!.includes(t.name));
    }
    return this.tools;
  }

  async executeTool(toolName: string, args: any): Promise<any> {
    const response = await this.sendRequest('tools/call', {
      name: toolName,
      arguments: args,
    });

    return response.result;
  }

  private async sendRequest(method: string, params: any): Promise<any> {
    const id = ++this.messageId;
    const message = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      if (this.process && this.process.stdin) {
        this.process.stdin.write(JSON.stringify(message) + '\n');
      } else {
        reject(new Error('MCP server not running'));
      }

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`MCP request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  private handleMessage(message: any): void {
    if (message.id && this.pendingRequests.has(message.id)) {
      const pending = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);

      if (message.error) {
        pending.reject(new Error(message.error.message || 'MCP error'));
      } else {
        pending.resolve(message.result);
      }
    }
  }
}

// ============================================
// GLOBAL MCP MANAGER
// ============================================

let globalMCPManager: MCPServerManager | null = null;

export function getGlobalMCPManager(): MCPServerManager {
  if (!globalMCPManager) {
    globalMCPManager = new MCPServerManager();
  }
  return globalMCPManager;
}

export async function registerMCPServer(config: MCPServerConfig): Promise<void> {
  const manager = getGlobalMCPManager();
  await manager.registerServer(config);
}

export async function getMCPTools(): Promise<Record<string, ToolDefinition>> {
  const manager = getGlobalMCPManager();
  return await manager.getTools();
}

export async function shutdownMCPServers(): Promise<void> {
  if (globalMCPManager) {
    await globalMCPManager.shutdown();
    globalMCPManager = null;
  }
}

