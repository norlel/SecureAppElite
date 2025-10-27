import { ethers } from "ethers";

export type EIP712Type = {
  domain: any;
  types: any;
  message: any;
};

export class FhevmDecryptionSignature {
  public publicKey: string;
  public privateKey: string;
  public signature: string;
  public startTimestamp: number;
  public durationDays: number;
  public userAddress: `0x${string}`;
  public contractAddresses: `0x${string}`[];
  public eip712: EIP712Type;

  constructor(parameters: {
    publicKey: string;
    privateKey: string;
    signature: string;
    startTimestamp: number;
    durationDays: number;
    userAddress: `0x${string}`;
    contractAddresses: `0x${string}`[];
    eip712: EIP712Type;
  }) {
    this.publicKey = parameters.publicKey;
    this.privateKey = parameters.privateKey;
    this.signature = parameters.signature;
    this.startTimestamp = parameters.startTimestamp;
    this.durationDays = parameters.durationDays;
    this.userAddress = parameters.userAddress;
    this.contractAddresses = parameters.contractAddresses;
    this.eip712 = parameters.eip712;
  }

  static async new(
    instance: any,
    contractAddresses: string[],
    publicKey: string,
    privateKey: string,
    signer: ethers.Signer
  ): Promise<FhevmDecryptionSignature | null> {
    try {
      const userAddress = (await signer.getAddress()) as `0x${string}`;
      const startTimestamp = Math.floor(Date.now() / 1000);
      const durationDays = 365;

      const eip712 = instance.createEIP712(
        publicKey,
        contractAddresses,
        startTimestamp,
        durationDays
      );

      const signature = await (signer as any).signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );

      return new FhevmDecryptionSignature({
        publicKey,
        privateKey,
        signature,
        startTimestamp,
        durationDays,
        userAddress,
        contractAddresses: contractAddresses as `0x${string}`[],
        eip712,
      });
    } catch {
      return null;
    }
  }
}


