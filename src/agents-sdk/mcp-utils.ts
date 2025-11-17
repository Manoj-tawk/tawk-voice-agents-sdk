/**
 * MCP Utility Functions
 * 
 * Helper functions for MCP server integration.
 * 
 * @module mcp-utils
 */

import type { MCPTool } from './types';
import type { ToolDefinition } from './types';
import { z } from 'zod';

/**
 * Filter for MCP tools
 */
export type MCPToolFilter = {
  /**
   * List of tool names to include
   */
  includeTools?: string[];
  
  /**
   * List of tool names to exclude
   */
  excludeTools?: string[];
  
  /**
   * Pattern to match tool names
   */
  pattern?: RegExp;
};

/**
 * Apply filter to MCP tools
 */
export function filterMCPTools(tools: MCPTool[], filter: MCPToolFilter): MCPTool[] {
  let filtered = [...tools];

  // Include filter
  if (filter.includeTools && filter.includeTools.length > 0) {
    filtered = filtered.filter(t => filter.includeTools!.includes(t.name));
  }

  // Exclude filter
  if (filter.excludeTools && filter.excludeTools.length > 0) {
    filtered = filtered.filter(t => !filter.excludeTools!.includes(t.name));
  }

  // Pattern filter
  if (filter.pattern) {
    filtered = filtered.filter(t => filter.pattern!.test(t.name));
  }

  return filtered;
}

/**
 * Create static filter for MCP tools
 */
export function createMCPToolStaticFilter(config: {
  allowedTools?: string[];
  blockedTools?: string[];
}): MCPToolFilter {
  return {
    includeTools: config.allowedTools,
    excludeTools: config.blockedTools,
  };
}

/**
 * Convert MCP tool to function tool definition
 */
export function mcpToFunctionTool(mcpTool: MCPTool): ToolDefinition {
  return {
    description: mcpTool.description,
    parameters: convertMCPSchemaToZod(mcpTool.inputSchema),
    execute: async (args: any) => {
      // This would call the MCP server
      // Implementation depends on MCP server integration
      throw new Error('MCP tool execution not implemented');
    },
    mcpServer: mcpTool.serverName,
  };
}

/**
 * Convert JSON schema to Zod schema (simplified)
 */
function convertMCPSchemaToZod(schema: any): z.ZodSchema {
  if (!schema || !schema.properties) {
    return z.object({});
  }

  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, value] of Object.entries(schema.properties || {})) {
    const prop = value as any;
    
    if (prop.type === 'string') {
      shape[key] = z.string();
    } else if (prop.type === 'number') {
      shape[key] = z.number();
    } else if (prop.type === 'boolean') {
      shape[key] = z.boolean();
    } else if (prop.type === 'array') {
      shape[key] = z.array(z.any());
    } else if (prop.type === 'object') {
      shape[key] = z.object({});
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

/**
 * Normalize MCP tool name
 */
export function normalizeMCPToolName(toolName: string, serverName: string): string {
  return `${serverName}_${toolName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()}`;
}

/**
 * Get MCP tools by server
 */
export function groupMCPToolsByServer(tools: MCPTool[]): Map<string, MCPTool[]> {
  const grouped = new Map<string, MCPTool[]>();

  for (const tool of tools) {
    const existing = grouped.get(tool.serverName) || [];
    existing.push(tool);
    grouped.set(tool.serverName, existing);
  }

  return grouped;
}

