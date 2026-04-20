import { jwtDecode } from "jwt-decode";
import StorageManager from "./StorageManager";

interface ITokenData {
    exp?: number;
    sub?: string;
    username?: string;
}

class TokenManager {
    private readonly accessTokenKey = "accessToken";
    private readonly refreshTokenKey = "refreshToken";

    public setAccessToken(accessToken: string, refreshToken?: string) {
        StorageManager.setItem(this.accessTokenKey, accessToken);

        if (refreshToken) {
            StorageManager.setItem(this.refreshTokenKey, refreshToken);
        }
    }

    public getAccessToken() {
        return StorageManager.getItem(this.accessTokenKey);
    }

    public getRefreshToken() {
        return StorageManager.getItem(this.refreshTokenKey);
    }

    public clearTokens() {
        StorageManager.removeItem(this.accessTokenKey);
        StorageManager.removeItem(this.refreshTokenKey);
    }

    public getTokenData() {
        const accessToken = this.getAccessToken();

        if (!accessToken) {
            return undefined;
        }

        try {
            return jwtDecode<ITokenData>(accessToken);
        } catch {
            return undefined;
        }
    }
}

export default new TokenManager();
