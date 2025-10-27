import { SDK_CDN_URL } from "./constants";

type TraceType = (message?: unknown, ...optionalParams: unknown[]) => void;

type FhevmRelayerSDKType = {
  initSDK: (options?: unknown) => Promise<boolean>;
  createInstance: (config: any) => Promise<any>;
  SepoliaConfig: any;
  __initialized__?: boolean;
};

type FhevmWindowType = Window & { relayerSDK: FhevmRelayerSDKType };

export class RelayerSDKLoader {
  private _trace?: TraceType;
  constructor(options: { trace?: TraceType }) { this._trace = options.trace; }
  public isLoaded() {
    if (typeof window === "undefined") throw new Error("RelayerSDKLoader: can only be used in the browser.");
    return isFhevmWindowType(window, this._trace);
  }
  public load(): Promise<void> {
    if (typeof window === "undefined") return Promise.reject(new Error("RelayerSDKLoader: can only be used in the browser."));
    if ("relayerSDK" in window) {
      if (!isFhevmRelayerSDKType((window as unknown as FhevmWindowType).relayerSDK, this._trace)) {
        throw new Error("RelayerSDKLoader: Unable to load FHEVM Relayer SDK");
      }
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${SDK_CDN_URL}"]`);
      if (existingScript) {
        if (!isFhevmWindowType(window, this._trace)) reject(new Error("RelayerSDKLoader: window object does not contain a valid relayerSDK object."));
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = SDK_CDN_URL;
      script.type = "text/javascript";
      script.async = true;
      script.onload = () => {
        if (!isFhevmWindowType(window, this._trace)) {
          reject(new Error(`RelayerSDKLoader: Relayer SDK script has been successfully loaded from ${SDK_CDN_URL}, however, the window.relayerSDK object is invalid.`));
        }
        resolve();
      };
      script.onerror = () => reject(new Error(`RelayerSDKLoader: Failed to load Relayer SDK from ${SDK_CDN_URL}`));
      document.head.appendChild(script);
    });
  }
}

function isFhevmRelayerSDKType(o: unknown, trace?: TraceType): o is FhevmRelayerSDKType {
  if (typeof o === "undefined" || o === null || typeof o !== "object") return false;
  if (!objHasProperty(o, "initSDK", "function", trace)) return false;
  if (!objHasProperty(o, "createInstance", "function", trace)) return false;
  if (!objHasProperty(o, "SepoliaConfig", "object", trace)) return false;
  if ("__initialized__" in (o as any)) {
    if ((o as any).__initialized__ !== true && (o as any).__initialized__ !== false) return false;
  }
  return true;
}

export function isFhevmWindowType(win: unknown, trace?: TraceType): win is FhevmWindowType {
  if (typeof win === "undefined" || win === null || typeof win !== "object") return false;
  if (!("relayerSDK" in (win as any))) return false;
  return isFhevmRelayerSDKType((win as any).relayerSDK, trace);
}

function objHasProperty<T extends object, K extends PropertyKey, V extends string>(
  obj: T,
  propertyName: K,
  propertyType: V,
  trace?: TraceType
): obj is T & Record<K, V extends "string" ? string : V extends "number" ? number : V extends "object" ? object : V extends "boolean" ? boolean : V extends "function" ? (...args: any[]) => any : unknown> {
  if (!obj || typeof obj !== "object") return false;
  if (!(propertyName in obj)) return false;
  const value = (obj as Record<K, unknown>)[propertyName];
  if (value === null || value === undefined) return false;
  if (typeof value !== propertyType) return false;
  return true;
}


