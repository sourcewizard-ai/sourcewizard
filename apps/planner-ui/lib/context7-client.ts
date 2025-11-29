import { JSONSafe } from 'sourcewizard/lib';

export interface Context7SearchResult {
  id: string;
  title: string;
  description: string;
  branch: string;
  lastUpdateDate: string;
  state: string;
  totalTokens: number;
  totalSnippets: number;
  stars: number;
  trustScore: number;
  benchmarkScore: number;
  versions: string[];
}

export interface Context7SearchResponse {
  results: Context7SearchResult[];
}

export interface Context7ClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export class Context7Client {
  private apiKey: string;
  private baseUrl: string;

  constructor(options: Context7ClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || 'https://context7.com';
  }

  async search(query: string): Promise<Context7SearchResponse | Error> {
    try {
      const url = `${this.baseUrl}/api/v2/search?query=${encodeURIComponent(query)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return new Error(`Context7 API error: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      const data = JSONSafe.parse(text);

      if (data instanceof Error) {
        return new Error(`Failed to parse Context7 response: ${data.message}`);
      }

      return data as Context7SearchResponse;
    } catch (error) {
      return error instanceof Error ? error : new Error(String(error));
    }
  }
}
