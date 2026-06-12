import type { NavSectionType } from "@/app/(main)/_components/sidebar/sidebar-data"
import { hasManagerAccess } from "@/lib/roles"

/** Filter sidebar sections by the user's roles (admin inherits manager sections via allowedRoles). */
export function filterSidebarSections(
    sections: NavSectionType[],
    userRoles: string[]
): NavSectionType[] {
    return sections.filter(
        (section) =>
            !section.allowedRoles ||
            section.allowedRoles.some((r) => userRoles.includes(r))
    )
}

export function canOpenSettings(userRoles: string[]): boolean {
    return hasManagerAccess(userRoles) || userRoles.includes("admin")
}
