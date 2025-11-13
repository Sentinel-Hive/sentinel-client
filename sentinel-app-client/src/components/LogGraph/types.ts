export interface LogEntry {
  id: string;
  timestamp: string;
  event_type: string;
  src_ip?: string;
  dest_ip?: string;
  severity?: string;
  app_type?: string;
  [key: string]: any; // For other log fields
}

export interface GraphNode {
  id: string;
  type: string;
  data: LogEntry;
  group?: string;  // For visual grouping
}

export interface GraphLink {
  source: string;
  target: string;
  relationship: string;
  weight?: number;  // For link thickness
}

export interface RelationshipConfig {
  field: string;     // The log field to use for relationship
  type: string;      // The type of relationship (e.g., "ip_connection", "time_sequence")
  threshold?: number; // Optional threshold for relationship strength
}

export const RelationshipTypes = {
  IP_CONNECTION: 'ip_connection',      // Nodes connected by same IP
  TIME_SEQUENCE: 'time_sequence',      // Nodes connected by time proximity
  SHARED_APP: 'shared_app',           // Nodes from same application
  SEVERITY_CHAIN: 'severity_chain',    // Nodes connected by severity progression
  CUSTOM: 'custom'                     // Custom relationship based on selected field
} as const;