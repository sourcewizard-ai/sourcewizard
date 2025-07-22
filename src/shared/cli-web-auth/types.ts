import { TokenStorage } from "./token-storage";

export interface WebAuthOptions {
  loginPageUrl?: string;
}

export interface WebAuthServerOptions {
  tokenStorage: TokenStorage;
  port?: number; // 0 for random port
}
