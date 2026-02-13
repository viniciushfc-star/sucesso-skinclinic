import { setActiveOrg } from "../core/org.js"
import { getUserOrganizations } from "../services/organization.service.js"
import { clearRoleCache } from "../services/permissions.service.js"

clearRoleCache()

export async function init() {

  const orgs = await getUserOrganizations()
  const box = document.getElementById("orgList")

  box.innerHTML = ""

  orgs.forEach(o => {
    const btn = document.createElement("button")
    btn.innerText = o.name
    btn.className = "org-btn"

    btn.onclick = () => {
      setActiveOrg(o.id)
      location.hash = "dashboard"
    }

    box.appendChild(btn)
  })
}
