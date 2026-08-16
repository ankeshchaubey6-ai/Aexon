export interface PropDef {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example?: string;
  defaultValue?: string | number | boolean;
  enumValues?: string[];
}

export interface ComponentMeta {
  name: string;
  category: string;
  semanticCategory: string;
  importPath: string;
  description: string;
  tags: string[];
  props: PropDef[];
  slots: Array<{
    name: string;
    description: string;
    required: boolean;
    acceptsType?: string;
  }>;
  variants: Array<{
    name: string;
    description: string;
    propOverrides?: Record<string, unknown>;
  }>;
  examples: string[];
  designTokens: string[];
  version: string;
}

export interface ComponentRegistry {
  version: string;
  generatedAt: string;
  components: ComponentMeta[];
}

export interface ResolverScore {
  component: ComponentMeta;
  score: number;
  categoryMatch: number;
  tagOverlap: number;
  descriptionSimilarity: number;
}
