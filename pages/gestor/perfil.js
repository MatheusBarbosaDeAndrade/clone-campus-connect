import AppShell from "components/AppShell.js";
import PrivacyCard from "components/PrivacyCard.js";
import ProfileForm from "components/ProfileForm.js";
import { PageHeader } from "components/ui.js";
import { withSession } from "lib/ssr.js";

export default function StaffProfile({ viewer, unreadCount }) {
  return (
    <AppShell
      title="Meu Perfil"
      viewer={viewer}
      unreadCount={unreadCount}
      width="narrow"
    >
      <PageHeader
        title="Meu Perfil"
        subtitle="Gerencie suas informações cadastrais e segurança da conta"
      />
      <ProfileForm viewer={viewer} logoutRedirect="/gestor/login" />
      <PrivacyCard viewer={viewer} />
    </AppShell>
  );
}

export const getServerSideProps = withSession(null, {
  roles: ["agent", "manager"],
  loginPath: "/gestor/login",
});
