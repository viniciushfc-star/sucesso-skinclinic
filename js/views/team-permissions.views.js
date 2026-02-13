import { PERMISSIONS } 
from "../core/permissions.catalog.js";

import { getUserPermissionOverrides, saveUserPermissionOverride }
 from "../services/permissions.service.js";

import { ROLE_PERMISSIONS }
 from "../core/permissions.map.js";

import { audit } 
from "../services/audit.service.js";



export async function init(user) {
  const container = document.getElementById("view-team-permissions");
  if (!container) return;

  const overrides = await getUserPermissionOverrides(user.id);
  const overrideMap = Object.fromEntries(
    overrides.map(o => [o.permission, o.allowed])
  );

  const rolePerms = ROLE_PERMISSIONS[user.role] || [];

  container.innerHTML = `
    <h2>Permissões de ${user.name}</h2>
    <p>Cargo: ${user.job_title}</p>
    <p>Role base: ${user.role}</p>

    <ul>
      ${PERMISSIONS.map(p => {
        const inherited = rolePerms.includes(p.key);
        const overridden = p.key in overrideMap;

        let checked = overridden ? overrideMap[p.key] : inherited;

        return `
          <li>
            <label>
              <input
                type="checkbox"
                data-permission="${p.key}"
                ${checked ? "checked" : ""}
                ${!overridden && inherited ? "disabled" : ""}
              />
              ${p.label}
              ${overridden ? "(customizado)" : inherited ? "(herdado)" : ""}
            </label>
          </li>
        `;
      }).join("")}
    </ul>

    <button id="btnSavePerms">Salvar alterações</button>
  `;

  bindSave(user.id);
}

function bindSave(userId) {
  document.getElementById("btnSavePerms").onclick = async () => {
    const inputs = document.querySelectorAll("input[data-permission]");

    const changes = [];

    for (const input of inputs) {
      const permission = input.dataset.permission;
      const allowed = input.checked;

      await saveUserPermissionOverride({
        userId,
        permission,
        allowed
      });

      changes.push({ permission, allowed });
    }

    await audit({
      action: "team.permissions.update",
      tableName: "organization_user_permissions",
      recordId: userId,
      permissionUsed: "team:permissions",
      metadata: {
        updated_permissions: changes
      }
    });

    alert("Permissões atualizadas");
  };
}

