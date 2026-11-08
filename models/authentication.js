import { ForbiddenError, UnauthorizedError } from "../infra/errors.js";
import password from "./password.js";
import user from "./user.js";

// Hash calculado uma vez e usado quando o login não existe, para que o tempo
// de resposta não revele se um email/telefone está cadastrado.
let dummyHashPromise;
function getDummyHash() {
  if (!dummyHashPromise) dummyHashPromise = password.hash("senha-inexistente");
  return dummyHashPromise;
}

const INVALID = {
  message: "Email/telefone ou senha incorretos.",
  action: "Verifique os dados e tente novamente.",
};

// portal: "user" (portal do usuário) ou "staff" (portal do gestor).
async function authenticate({ login, password: plain, portal = "user" }) {
  const found = await user.findForLogin(login);
  const hashToCheck = found ? found.password_hash : await getDummyHash();
  const matches = await password.compare(plain ?? "", hashToCheck);

  if (!found || !matches) throw new UnauthorizedError(INVALID);
  if (!found.is_active) {
    throw new UnauthorizedError({
      message: "Esta conta está desativada.",
      action: "Procure um gestor do CampusConnect.",
    });
  }
  if (portal === "staff" && found.role === "user") {
    throw new ForbiddenError({
      message: "Acesso restrito a gestores e agentes autorizados.",
      action: "Use o portal do usuário para acessar sua conta.",
    });
  }
  return {
    id: found.id,
    role: found.role,
    name: found.name,
    email: found.email,
  };
}

const authentication = { authenticate };

export default authentication;
