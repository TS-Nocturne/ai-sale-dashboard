"use client"

import { createContext, useContext } from "react"

const UserRolesContext = createContext<string[]>(["user"])

export function UserRolesProvider({
    roles,
    children,
}: {
    roles: string[]
    children: React.ReactNode
}) {
    return (
        <UserRolesContext.Provider value={roles.length > 0 ? roles : ["user"]}>
            {children}
        </UserRolesContext.Provider>
    )
}

/** Roles from server session — reliable for sidebar / nav (client useSession may omit role). */
export function useUserRoles(): string[] {
    return useContext(UserRolesContext)
}
