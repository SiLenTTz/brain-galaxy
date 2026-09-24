// Datenmodell — Neural Data Weave
export type Category = 'core' | 'knowledge' | 'logic' | 'data' | 'neutral';

export interface GraphNode {
  id: string;
  label: string;
  category: Category;
  /** Cluster-Name aus dem Vault (Ordner-Gruppe). */
  cluster?: string;
  /** Themen-Community (Label-Propagation über Wikilinks, Indexer v2). */
  community?: string;
  hub: boolean;
  /** Vault-Pfad (echte Daten) oder leer bei Mock. */
  path?: string;
  words?: number;
  tags?: string[];
  /** Letzte Aenderung (YYYY-MM-DD) fuer Zeit-Filter / Aktivitaet. */
  mtime?: string;
  /** Anzahl echter Wikilinks (Grad) — steuert Hub-Status & Groesse. */
  degree: number;
  position: [number, number, number];
  size: number;
  activity: number; // 0–1
  edges: string[]; // Edge-IDs
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  /** 'wikilink' = echte Notiz-Verknuepfung, 'folder' = gleiche Ordner-Gruppe. */
  kind: 'wikilink' | 'folder';
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: {
    nodeCount: number;
    edgeCount: number;
    wikilinkCount: number;
    folderEdgeCount: number;
    orphanCount: number;
    clusterNames: string[];
    /** Communities (Themen-Sicht, Indexer v2) — leer bei alten Graphen. */
    communities?: Array<{ id: string; label: string; anchor?: string; nodes: number; words: number; wikilinks?: number }>;
    largestNote?: { label: string; words: number };
    generatedAt: string;
    vault?: string;
  };
}
