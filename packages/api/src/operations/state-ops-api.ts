import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserRole } from "../database.types";

type Client = SupabaseClient<Database>;

export type OperationAccess = "national" | "state";

export type OperationStaffMember = {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: UserRole;
  stateIds: string[];
};

/** National admin console. State rows do not narrow this role. */
export function isNationalAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
}

/** Admin portal: country-wide admins and state desks. */
export function isOperationsPortalRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "state_ops";
}

export async function listOperationStates(client: Client) {
  const { data, error } = await client
    .from("operation_states")
    .select("id, name, is_active, created_at")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listMyOperationStateNames(client: Client): Promise<string[]> {
  const { data: assignments, error } = await client
    .from("user_operation_states")
    .select("state_id");
  if (error) throw new Error(error.message);
  const ids = (assignments ?? []).map((row) => row.state_id);
  if (ids.length === 0) return [];
  const { data: states, error: stateError } = await client
    .from("operation_states")
    .select("id, name")
    .in("id", ids);
  if (stateError) throw new Error(stateError.message);
  return (states ?? []).map((state) => state.name).sort((a, b) => a.localeCompare(b));
}

export async function listOperationStaff(client: Client): Promise<OperationStaffMember[]> {
  const { data: users, error } = await client
    .from("users")
    .select("id, email, full_name, role")
    .in("role", ["admin", "state_ops"])
    .order("email");
  if (error) throw new Error(error.message);

  const { data: assignments, error: assignmentError } = await client
    .from("user_operation_states")
    .select("user_id, state_id");
  if (assignmentError) throw new Error(assignmentError.message);

  const statesByUser = new Map<string, string[]>();
  for (const row of assignments ?? []) {
    const list = statesByUser.get(row.user_id) ?? [];
    list.push(row.state_id);
    statesByUser.set(row.user_id, list);
  }

  return (users ?? []).map((user) => ({
    userId: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    stateIds: (statesByUser.get(user.id) ?? []).sort(),
  }));
}

/**
 * National access clears state rows. A state desk replaces that person's states.
 * Vendor, technician, and support accounts are left unchanged.
 */
export async function saveOperationStaffAssignment(
  client: Client,
  input: { email: string; access: OperationAccess; stateIds: string[] },
): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Enter the staff email.");

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw new Error(authError.message);
  const actorId = authData.user?.id;
  if (!actorId) throw new Error("Sign in again to assign a desk.");

  const { data: user, error: userError } = await client
    .from("users")
    .select("id, role")
    .ilike("email", email)
    .maybeSingle();
  if (userError) throw new Error(userError.message);
  if (!user) {
    throw new Error("No account uses that email yet. They need to sign in once, then you can assign the desk.");
  }
  if (user.role === "vendor" || user.role === "technician" || user.role === "support") {
    throw new Error("That email belongs to a partner, technician, or support account. Use a separate staff login.");
  }
  if (user.id === actorId && input.access === "state") {
    throw new Error("Another national admin has to move your own login onto a state desk.");
  }

  const stateIds = [...new Set(input.stateIds.map((id) => id.trim()).filter(Boolean))];
  if (input.access === "state" && stateIds.length === 0) {
    throw new Error("Choose at least one state.");
  }

  if (input.access === "national") {
    const { error: roleError } = await client.from("users").update({ role: "admin" }).eq("id", user.id);
    if (roleError) throw new Error(roleError.message);
    const { error: clearError } = await client.from("user_operation_states").delete().eq("user_id", user.id);
    if (clearError) throw new Error(clearError.message);
    return;
  }

  const { error: clearError } = await client.from("user_operation_states").delete().eq("user_id", user.id);
  if (clearError) throw new Error(clearError.message);
  const { error: insertError } = await client.from("user_operation_states").insert(
    stateIds.map((stateId) => ({
      user_id: user.id,
      state_id: stateId,
      created_by: actorId,
    })),
  );
  if (insertError) throw new Error(insertError.message);
  const { error: roleError } = await client.from("users").update({ role: "state_ops" }).eq("id", user.id);
  if (roleError) throw new Error(roleError.message);
}
