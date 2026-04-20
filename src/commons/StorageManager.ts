class StorageManager {
    private stayConnected = true;

    public setStayConnect(value: boolean) {
        this.stayConnected = value;
    }

    public setItem(key: string, value: string) {
        const encodedKey = this.encodeValues(key);
        const encodedValue = this.encodeValues(value);

        if (this.stayConnected) {
            localStorage.setItem(encodedKey, encodedValue);
            return;
        }

        sessionStorage.setItem(encodedKey, encodedValue);
    }

    public getItem(key: string) {
        const encodedKey = this.encodeValues(key);
        const source = this.stayConnected ? localStorage : sessionStorage;
        const encodedValue = source.getItem(encodedKey);
        const decodedValue = encodedValue ? this.decodeValues(encodedValue) : "";
        return decodedValue || "";
    }

    public removeItem(key: string) {
        const encodedKey = this.encodeValues(key);
        localStorage.removeItem(encodedKey);
        sessionStorage.removeItem(encodedKey);
    }

    public clear() {
        localStorage.clear();
        sessionStorage.clear();
    }

    private encodeValues(value: string) {
        let encodedValue = value;

        for (let index = 0; index < 3; index += 1) {
            encodedValue = btoa(encodedValue);
        }

        return encodedValue;
    }

    private decodeValues(value: string) {
        let decodedValue = value;

        for (let index = 0; index < 3; index += 1) {
            decodedValue = atob(decodedValue);
        }

        return decodedValue;
    }
}

export default new StorageManager();
