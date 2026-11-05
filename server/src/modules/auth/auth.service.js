import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../../config/env.js";
import { conflict, unauthorized } from "../../utils/http-error.js";
import * as users from "../users/users.repository.js";

export const hashPassword = (plain) => bcrypt.hash(plain, 10);

export function signSession(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: config.sessionTtlSeconds,
  });
}

export function verifySession(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

export function createAuthService({ pool }) {
  async function login(email, password) {
    const user = await users.findByEmail(pool, email);
    // Compare against a dummy hash when the user is unknown to keep timing similar.
    const hash = user?.passwordHash || "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.ZQ6E8zVJ0Q5s2xQ3d8b6y7x1yG2e";
    const ok = await bcrypt.compare(password, hash);
    if (!user || !ok) throw unauthorized("Email or password is incorrect.");
    const { passwordHash, ...safeUser } = user;
    return { user: safeUser, token: signSession(safeUser) };
  }

  async function createUser({ name, email, password, role }) {
    const user = await users.insert(pool, {
      name,
      email,
      role,
      passwordHash: await hashPassword(password),
    });
    if (!user) throw conflict("A team member with this email already exists.");
    return user;
  }

  return { login, createUser, findUser: (id) => users.findById(pool, id), listUsers: () => users.list(pool) };
}
