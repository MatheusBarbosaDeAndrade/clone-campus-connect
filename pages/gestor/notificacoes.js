import AppShell from "components/AppShell.js";
import NotificationList from "components/NotificationList.js";
import { withSession } from "lib/ssr.js";
import notification from "models/notification.js";

export default function StaffNotifications({
  viewer,
  unreadCount,
  now,
  notifications,
}) {
  return (
    <AppShell title="Notificações" viewer={viewer} unreadCount={unreadCount}>
      <NotificationList
        notifications={notifications}
        now={now}
        ticketBasePath="/gestor/chamados"
      />
    </AppShell>
  );
}

export const getServerSideProps = withSession(
  async (context, viewer) => ({
    notifications: await notification.listForUser(viewer.id),
  }),
  { roles: ["agent", "manager"], loginPath: "/gestor/login" },
);
