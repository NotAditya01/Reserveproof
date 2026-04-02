import { EncryptedPayload } from './EncryptedPayload.js';
export declare class EncryptionService {
    encrypt(plaintext: string, secretKey: string): Promise<EncryptedPayload>;
    decrypt(payload: EncryptedPayload, secretKey: string): Promise<string>;
}
//# sourceMappingURL=EncryptionService.d.ts.map