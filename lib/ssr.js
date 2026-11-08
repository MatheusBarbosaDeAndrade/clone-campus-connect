// Utilitários de getServerSideProps (somente servidor).
import { getSessionUser } from "infra/controller.js";
import { NotFoundError } from "infra/errors.js";
import notification from "models/notification.js";

export function homePathFor(role) {
  return role === "user" ? "/inicio" : "/gestor";
}

// Converte Date -> string ISO e remove undefined (exigência do Next).
export function serialize(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

// Protege uma página: exige sessão e (opcionalmente) papéis específicos.
// O `loader` recebe (context, viewer) e devolve as props da página.
export function withSession(loader, { roles, loginPath = "/login" } = {}) {
  return async function getServerSideProps(context) {
    const viewer = await getSessionUser(context.req);
    if (!viewer) {
      const next = encodeURIComponent(context.resolvedUrl);
      return {
        redirect: {
          destination: `${loginPath}?next=${next}`,
          permanent: false,
        },
      };
    }
    if (roles && !roles.includes(viewer.role)) {
      return {
        redirect: { destination: homePathFor(viewer.role), permanent: false },
      };
    }

    let props = {};
    if (loader) {
      try {
        const result = await loader(context, viewer);
        if (result?.redirect || result?.notFound) return result;
        props = result?.props ?? result ?? {};
      } catch (error) {
        if (
          error instanceof NotFoundError ||
          error?.name === "ValidationError"
        ) {
          return { notFound: true };
        }
        throw error;
      }
    }

    const unreadCount = await notification.countUnread(viewer.id);
    return {
      props: serialize({
        ...props,
        viewer: {
          id: viewer.id,
          name: viewer.name,
          email: viewer.email,
          phone: viewer.phone,
          role: viewer.role,
        },
        unreadCount,
        now: new Date().toISOString(),
      }),
    };
  };
}

// Páginas públicas de autenticação: se já houver sessão, vai para o início.
export function redirectIfAuthenticated() {
  return async function getServerSideProps(context) {
    const viewer = await getSessionUser(context.req);
    if (viewer) {
      return {
        redirect: { destination: homePathFor(viewer.role), permanent: false },
      };
    }
    return { props: {} };
  };
}
