import crypto from "node:crypto";
import { promisify } from "node:util";

// Hash de senha com scrypt (nativo do Node, sem dependências externas).
// Formato armazenado: scrypt$N$r$p$salt$hash (base64).

const scrypt = promisify(crypto.scrypt);
const PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;

async function hash(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, PARAMS);
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

async function compare(password, stored) {
  if (typeof password !== "string" || typeof stored !== "string") return false;
  const [algorithm, N, r, p, saltB64, hashB64] = stored.split("$");
  if (algorithm !== "scrypt") return false;
  const expected = Buffer.from(hashB64, "base64");
  const derived = await scrypt(
    password,
    Buffer.from(saltB64, "base64"),
    expected.length,
    { N: Number(N), r: Number(r), p: Number(p) },
  );
  return crypto.timingSafeEqual(derived, expected);
}

const password = { hash, compare };

export default password;
