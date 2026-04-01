declare module 'kiteconnect' {
  export class KiteConnect {
    constructor(options: any);
    setAccessToken(token: string): void;
    getHoldings(): Promise<any>;
    getPositions(): Promise<any>;
    [key: string]: any;
  }
  
  export class KiteTicker {
    constructor(options: any);
    connect(): void;
    subscribe(tokens: number[]): void;
    unsubscribe(tokens: number[]): void;
    on(event: string, callback: Function): void;
    [key: string]: any;
  }
}
