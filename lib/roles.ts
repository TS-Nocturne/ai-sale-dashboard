/** Shared role helpers (safe for middleware + server components). */

export const MANAGER_ROLES = ["admin", "manager"] as const
export const HANDOFF_ROLES = ["admin", "manager", "employee"] as const
export const EMPLOYEE_ROLE = "employee"

export function parseRoles(role: string | null | undefined): string[] {
    return (role ?? "user").split(",").map((r) => r.trim())
}

/** True when the user has employee but not manager/admin. */
export function isEmployeeOnly(roles: string[]): boolean {
    return (
        roles.includes(EMPLOYEE_ROLE) &&
        !roles.some((r) => (MANAGER_ROLES as readonly string[]).includes(r))
    )
}

export function hasHandoffAccess(roles: string[]): boolean {
    return roles.some((r) => (HANDOFF_ROLES as readonly string[]).includes(r))
}

export function hasManagerAccess(roles: string[]): boolean {
    return roles.some((r) => (MANAGER_ROLES as readonly string[]).includes(r))
}

export function topDashboardRole(roles: string[]): "admin" | "manager" | "user" | "employee" {
    if (roles.includes("admin")) return "admin"
    if (roles.includes("manager")) return "manager"
    if (roles.includes(EMPLOYEE_ROLE)) return "employee"
    return "user"
}

const EMPLOYEE_ALLOWED_PATHS = ["/dashboard/chat", "/profile"]

/** Routes an employee-only user may visit. */
export function employeeMayAccess(pathname: string): boolean {
    return EMPLOYEE_ALLOWED_PATHS.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`)
    )
}
