import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BellOff } from "lucide-react";

type Notif = {
  id: string;
  title: string;
  body: string | null;
  read: boolean;
  link: string | null;
  created_at: string;
};

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotifRow({ n, dim }: { n: Notif; dim?: boolean }) {
  const inner = (
    <div
      className={`rounded-2xl bg-white border p-4 flex items-start gap-3 ${
        dim ? "border-nesema-sage/10 opacity-70" : "border-nesema-sage/20"
      }`}
    >
      <div
        className={`w-2 h-2 rounded-full mt-2 shrink-0 ${dim ? "bg-gray-300" : "bg-nesema-bark"}`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-nesema-t1">{n.title}</p>
        {n.body && <p className="text-xs text-nesema-t3 mt-0.5">{n.body}</p>}
        <p className="text-[11px] text-nesema-t3 mt-1">
          {fmtRelative(n.created_at)}
        </p>
      </div>
    </div>
  );

  return n.link ? (
    <a href={n.link} className="block">
      {inner}
    </a>
  ) : (
    inner
  );
}

export default async function NotificationsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: notifs } = (await supabase
    .from("notifications")
    .select("id, title, body, read, link, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)) as { data: Notif[] | null; error: unknown };

  const items = notifs ?? [];
  const unread = items.filter((n) => !n.read);
  const read = items.filter((n) => n.read);

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-3xl text-nesema-t1">Notifications</h1>
        {unread.length > 0 && (
          <span className="text-xs bg-nesema-bark text-white px-2.5 py-1 rounded-full font-medium">
            {unread.length} new
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-nesema-sage/40 p-10 text-center">
          <BellOff className="mx-auto mb-3 text-nesema-sage/50" size={36} />
          <p className="text-nesema-t1 font-medium mb-1">All clear</p>
          <p className="text-nesema-t3 text-sm">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {unread.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold tracking-widest text-nesema-t3 uppercase mb-3">
                New
              </h2>
              <div className="space-y-2">
                {unread.map((n) => (
                  <NotifRow key={n.id} n={n} />
                ))}
              </div>
            </section>
          )}
          {read.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold tracking-widest text-nesema-t3 uppercase mb-3">
                Earlier
              </h2>
              <div className="space-y-2">
                {read.map((n) => (
                  <NotifRow key={n.id} n={n} dim />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
