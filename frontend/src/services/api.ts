type LoginResponse = {
  token?: string;
  user?: Record<string, unknown>;
  otp_required?: boolean;
  otp_setup_required?: boolean;
  otp_token?: string;
};

export async function getHealth(): Promise<void> {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error("health failed");
}

export async function login(
  username: string,
  password: string,
  roleHint?: "admin" | "user"
): Promise<LoginResponse> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, roleHint })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (data.locked_until) {
      throw new Error(`${data.message}（解锁时间：${data.locked_until}）`);
    }
    throw new Error(data.message || "login failed");
  }
  return res.json();
}

export async function otpSetup(otpToken: string): Promise<{ secret: string; otpauth_uri: string }> {
  const res = await fetch("/api/auth/otp/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ otp_token: otpToken })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "otp setup failed");
  }
  return res.json();
}

export async function otpVerify(otpToken: string, code: string): Promise<{ token: string }> {
  const res = await fetch("/api/auth/otp/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ otp_token: otpToken, code })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "otp verify failed");
  }
  return res.json();
}

export async function me(token: string): Promise<Record<string, unknown>> {
  const res = await fetch("/api/me", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "me failed");
  }
  return res.json();
}

export async function listUsers(token: string, params?: { q?: string; ou?: string; status?: string }) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.ou) qs.set("ou", params.ou);
  if (params?.status) qs.set("status", params.status);
  const res = await fetch(`/api/users?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "list users failed");
  }
  return res.json();
}

export async function createUser(token: string, payload: Record<string, unknown>) {
  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "create user failed");
  }
  return res.json();
}

export async function updateUser(token: string, username: string, payload: Record<string, unknown>) {
  const res = await fetch(`/api/users/${encodeURIComponent(username)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "update user failed");
  }
  return res.json();
}

export async function setUserStatus(token: string, username: string, enabled: boolean) {
  const res = await fetch(`/api/users/${encodeURIComponent(username)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ enabled })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "set status failed");
  }
  return res.json();
}

export async function resetUserPassword(token: string, username: string, newPassword: string) {
  const res = await fetch(`/api/users/${encodeURIComponent(username)}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ newPassword })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "reset password failed");
  }
  return res.json();
}

export async function deleteUser(token: string, username: string) {
  const res = await fetch(`/api/users/${encodeURIComponent(username)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "delete user failed");
  }
  return res.json();
}

export async function moveUser(token: string, username: string, targetOuDn: string) {
  const res = await fetch(`/api/users/${encodeURIComponent(username)}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ targetOuDn })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "move user failed");
  }
  return res.json();
}

export async function listOus(token: string) {
  const res = await fetch("/api/ous", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "list ous failed");
  }
  return res.json();
}

export async function createOu(token: string, payload: Record<string, unknown>) {
  const res = await fetch("/api/ous", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "create ou failed");
  }
  return res.json();
}

export async function updateOu(token: string, payload: Record<string, unknown>) {
  const res = await fetch("/api/ous", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "update ou failed");
  }
  return res.json();
}

export async function deleteOu(token: string, dn: string) {
  const res = await fetch("/api/ous", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ dn })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "delete ou failed");
  }
  return res.json();
}

export async function listAudit(
  token: string,
  params?: { actor?: string; action?: string; target?: string; limit?: number }
) {
  const qs = new URLSearchParams();
  if (params?.actor) qs.set("actor", params.actor);
  if (params?.action) qs.set("action", params.action);
  if (params?.target) qs.set("target", params.target);
  if (params?.limit) qs.set("limit", String(params.limit));
  const res = await fetch(`/api/audit?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "list audit failed");
  }
  return res.json();
}

export async function sendSmsCode(username: string, scene: "forgot" | "change") {
  const res = await fetch("/api/auth/sms/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, scene })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "send sms failed");
  }
  return res.json();
}

export async function forgotReset(username: string, code: string, newPassword: string) {
  const res = await fetch("/api/auth/forgot/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, code, newPassword })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "forgot reset failed");
  }
  return res.json();
}

export async function changePassword(token: string, oldPassword: string, newPassword: string, code: string) {
  const res = await fetch("/api/me/password", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ oldPassword, newPassword, code })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "change password failed");
  }
  return res.json();
}

export async function listSms(
  token: string,
  params?: { username?: string; scene?: string; status?: string; limit?: number }
) {
  const qs = new URLSearchParams();
  if (params?.username) qs.set("username", params.username);
  if (params?.scene) qs.set("scene", params.scene);
  if (params?.status) qs.set("status", params.status);
  if (params?.limit) qs.set("limit", String(params.limit));
  const res = await fetch(`/api/sms/list?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "list sms failed");
  }
  return res.json();
}

export async function retrySms(token: string) {
  const res = await fetch("/api/sms/retry", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "retry sms failed");
  }
  return res.json();
}

export async function listPasswordExpiry(token: string, params?: { username?: string; status?: string; limit?: number }) {
  const qs = new URLSearchParams();
  if (params?.username) qs.set("username", params.username);
  if (params?.status) qs.set("status", params.status);
  if (params?.limit) qs.set("limit", String(params.limit));
  const res = await fetch(`/api/password-expiry/list?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "list expiry failed");
  }
  return res.json();
}

export async function triggerPasswordExpiry(token: string) {
  const res = await fetch("/api/password-expiry/trigger", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "trigger expiry failed");
  }
  return res.json();
}

export async function listNotifications(token: string) {
  const res = await fetch("/api/notifications", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "list notifications failed");
  }
  return res.json();
}
