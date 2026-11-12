/**
 * Per-user permission overrides on the Roles & Permissions page. Pure functions (tested in
 * scripts/verify-rbac-editor.ts). A user's access = the role's template, plus `granted`, minus `denied`.
 */

export interface Overrides {
  granted: string[];
  denied: string[];
}

/** Is this permission ON for the user? */
export function isOn(key: string, roleTemplate: readonly string[], o: Overrides): boolean {
  if (o.denied.includes(key)) return false;
  return o.granted.includes(key) || roleTemplate.includes(key);
}

/**
 * Flips one permission. Template ON → deny it (or undo the deny). Template OFF → grant it (or undo the grant).
 * An override that only repeats the template is never stored.
 */
export function togglePermission(key: string, roleTemplate: readonly string[], o: Overrides): Overrides {
  const inTemplate = roleTemplate.includes(key);
  const granted = o.granted.filter((k) => k !== key);
  const denied = o.denied.filter((k) => k !== key);
  const wasOn = isOn(key, roleTemplate, o);
  if (wasOn) {
    if (inTemplate) denied.push(key);
  } else if (!inTemplate) {
    granted.push(key);
  }
  return { granted, denied };
}

/** Turns every permission of a module ON. */
export function grantAll(keys: readonly string[], roleTemplate: readonly string[], o: Overrides): Overrides {
  const set = new Set(keys);
  return {
    granted: [...o.granted.filter((k) => !set.has(k)), ...keys.filter((k) => !roleTemplate.includes(k))],
    denied: o.denied.filter((k) => !set.has(k)),
  };
}

/** Back to the role template for these permissions. */
export function resetKeys(keys: readonly string[], o: Overrides): Overrides {
  const set = new Set(keys);
  return { granted: o.granted.filter((k) => !set.has(k)), denied: o.denied.filter((k) => !set.has(k)) };
}

/** After a role change, overrides that now only repeat the new template are dropped. */
export function normalize(roleTemplate: readonly string[], o: Overrides): Overrides {
  return {
    granted: [...new Set(o.granted)].filter((k) => !roleTemplate.includes(k)),
    denied: [...new Set(o.denied)].filter((k) => roleTemplate.includes(k)),
  };
}

export function effective(roleTemplate: readonly string[], o: Overrides): string[] {
  return [...new Set([...roleTemplate, ...o.granted])].filter((k) => !o.denied.includes(k));
}

/** What saving would change compared with the user's current access. */
export function diff(before: readonly string[], after: readonly string[]) {
  const b = new Set(before);
  const a = new Set(after);
  return { added: [...a].filter((k) => !b.has(k)), removed: [...b].filter((k) => !a.has(k)) };
}
