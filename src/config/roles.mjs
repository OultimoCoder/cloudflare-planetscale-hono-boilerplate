const allRoles = {
  user: [
  ],
  admin: [
  ],
}

const roles = Object.keys(allRoles)
const roleRights = new Map(Object.entries(allRoles))

export {
  roles,
  roleRights,
}
