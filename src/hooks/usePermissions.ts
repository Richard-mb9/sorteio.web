interface IUsePermissions {
    hasPermission: (permission: string) => boolean;
    hasAnyPermission: (permissions: string[]) => boolean;
}

export default function usePermissions(): IUsePermissions {
    const hasPermission = (permission: string) => {
        void permission;
        return true;
    };

    const hasAnyPermission = (permissions: string[]) => {
        void permissions;
        return true;
    };

    return {
        hasPermission,
        hasAnyPermission,
    };
}
