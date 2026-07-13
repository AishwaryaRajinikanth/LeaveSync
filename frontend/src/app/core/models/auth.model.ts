export interface AuthSession {
  id: string;
  name: string;
  provider: 'ups' | 'ms';
  timestamp: string;
}
