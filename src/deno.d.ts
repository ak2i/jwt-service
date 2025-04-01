
declare namespace Deno {
  export interface ImportMeta {
    main: boolean;
  }
  
  export const env: {
    get(key: string): string | undefined;
  };
  
  export function serve(options: { port: number }, handler: (request: Request) => Response | Promise<Response>): void;
}
