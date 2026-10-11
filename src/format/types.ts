/** A deliberately small, serializable subset of MDAST plus LearnMD directives. */
export interface LearnNode {
  type: string;
  name?: string;
  attributes?: Record<string, string>;
  children?: LearnNode[];
  value?: string;
  depth?: number;
  url?: string;
  alt?: string;
  lang?: string;
  ordered?: boolean;
  start?: number;
  checked?: boolean | null;
  identifier?: string;
  id?: string;
  [key: string]: unknown;
}

export interface Diagnostic {
  severity: 'error' | 'warning';
  message: string;
  line?: number;
}

export interface DocumentMetadata {
  title: string;
  description?: string;
  subject?: string;
  author?: string;
  tags: string[];
  version: string;
  [key: string]: unknown;
}

export interface ParsedDocument {
  source: string;
  metadata: DocumentMetadata;
  children: LearnNode[];
  diagnostics: Diagnostic[];
  headings: { id: string; text: string; depth: number }[];
  wordCount: number;
}
