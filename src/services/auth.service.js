// src/services/auth.service.js
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { signToken, buildStaffPayload } from '../lib/jwt.js';
import { AppError } from '../middleware/errorHandler.js';

const BCRYPT_ROUNDS = 10;
const RESET_TOKEN_TTL_MIN = 30;

export const school = {
  name: 'St. Peters Maweni Girls Secondary School',
  short_name: 'Maweni Girls',
  address: 'P.O. Box 941, Suna Migori',
  phone: '+254 726533646',
  email: 'maweniggirls@gmail.com',
  motto: 'Knowledge is Power', 
};
function publicStaff(s) {
  return {
    id: s.id,
    email: s.email,
    full_name: s.full_name,
    role: s.role,
    device_code: s.device_code ?? null,
  };
}

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// ---------- Register ----------
export async function register({ email, password, full_name, role }) {
  const existing = await prisma.staff.findUnique({ where: { email } });
  if (existing) {
    throw new AppError('That email is already registered.', 409, 'EMAIL_TAKEN');
  }

  const password_hash = await hashPassword(password);

  const staff = await prisma.staff.create({
    data: { email, full_name, role, password_hash },
  });
 const token = signToken(buildStaffPayload(staff));
  return {
    token,
    staff: publicStaff(staff),
    school: { name: school.name, address: school.address, phone: school.phone },
  };
}

// ---------- Login ----------
export async function login({ email, password }) {
  const staff = await prisma.staff.findUnique({ where: { email } });
  if (!staff || !staff.is_active) {
    throw new AppError('Email or password is incorrect.', 401, 'BAD_CREDENTIALS');
  }

  const ok = await verifyPassword(password, staff.password_hash);
  if (!ok) {
    throw new AppError('Email or password is incorrect.', 401, 'BAD_CREDENTIALS');
  }
 const token = signToken(buildStaffPayload(staff));
  return {
    token,
    staff: publicStaff(staff),
    school: { name: school.name, address: school.address, phone: school.phone },
  };


}

// ---------- Forgot password ----------
export async function forgotPassword(email) {
  const staff = await prisma.staff.findUnique({ where: { email } });

  // Always return the same response so we don't leak which emails exist.
  const generic = {
    message: 'If that email is registered, a reset link has been sent.',
  };
  if (!staff) return generic;

  const raw = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60_000);

  await prisma.passwordReset.create({
    data: {
      staff_id: staff.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      used: false,
    },
  });

  // TODO: send `raw` to the user by email or SMS.
  // For dev, log the raw token so you can paste it into /reset-password.
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[auth] reset token for ${email}: ${raw}`);
  }

  return generic;
}

// ---------- Reset password ----------
export async function resetPassword({ token, password }) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const record = await prisma.passwordReset.findFirst({
    where: {
      token_hash: tokenHash,
      used: false,
      expires_at: { gt: new Date() },
    },
  });

  if (!record) {
    throw new AppError(
      'That reset link is not valid or has expired. Ask for a new one.',
      400,
      'BAD_RESET_TOKEN'
    );
  }

  const password_hash = await hashPassword(password);

  await prisma.$transaction([
    prisma.staff.update({
      where: { id: record.staff_id },
      data: { password_hash },
    }),
    prisma.passwordReset.update({
      where: { id: record.id },
      data: { used: true, used_at: new Date() },
    }),
  ]);

  return { message: 'Your password has been updated. Sign in with the new one.' };
}

// ---------- Me ----------
export async function me(staffId) {
  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff) throw new AppError('Account not found.', 404, 'NOT_FOUND');
  return { staff: publicStaff(staff) };
}

// ---------- Update profile ----------
export async function updateProfile(staffId, { full_name, email }) {
  const data = {};
  if (full_name) data.full_name = full_name;
  if (email) data.email = email;

  if (email) {
    const clash = await prisma.staff.findFirst({
      where: { email, NOT: { id: staffId } },
    });
    if (clash) {
      throw new AppError('That email is already in use.', 409, 'EMAIL_TAKEN');
    }
  }

  const staff = await prisma.staff.update({ where: { id: staffId }, data });
  return { staff: publicStaff(staff) };
}

// ---------- Change password ----------
export async function changePassword(staffId, { current_password, new_password }) {
  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff) throw new AppError('Account not found.', 404, 'NOT_FOUND');

  const ok = await verifyPassword(current_password, staff.password_hash);
  if (!ok) {
    throw new AppError('Your current password is not right.', 400, 'BAD_CURRENT');
  }

  const password_hash = await hashPassword(new_password);
  await prisma.staff.update({ where: { id: staffId }, data: { password_hash } });

  return { message: 'Your password has been updated.' };
}

// ---------- Register device ----------
export async function registerDevice(staffId, deviceCode) {
  const staff = await prisma.staff.update({
    where: { id: staffId },
    data: { device_code: deviceCode },
  });
  return { staff: publicStaff(staff) };
}