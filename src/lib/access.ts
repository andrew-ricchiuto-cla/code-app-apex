// Who gets the facilitator options on the landing page: users holding the
// ApexFacilitator security role (or System Administrator), directly or through
// a Dataverse team. Per-game console access is still the game's facilitator list.

import type { CurrentUser } from "./user";

export const FACILITATOR_ROLES = ["ApexFacilitator", "System Administrator"];

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when the signed-in user holds a facilitator role. Any lookup failure (for
 *  example, no read access to security roles) is treated as "not a facilitator". */
export async function hasFacilitatorRole(user: CurrentUser): Promise<boolean> {
  if (!GUID.test(user.objectId)) return false;
  const oid = user.objectId.toLowerCase();
  try {
    const { RolesService } = await import("@/generated/services/RolesService");
    const names = FACILITATOR_ROLES.map((n) => `name eq '${n}'`).join(" or ");
    const result = await RolesService.getAll({
      select: ["roleid", "name"],
      filter:
        `(${names}) and (` +
        `systemuserroles_association/any(u:u/azureactivedirectoryobjectid eq ${oid}) or ` +
        `teamroles_association/any(t:t/teammembership_association/any(u:u/azureactivedirectoryobjectid eq ${oid})))`,
      top: 1,
    });
    return (result.data ?? []).length > 0;
  } catch {
    return false;
  }
}
