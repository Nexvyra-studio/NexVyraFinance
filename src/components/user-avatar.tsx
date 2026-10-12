/* eslint-disable @next/next/no-img-element */
"use client";

import { UserRound } from "lucide-react";
import type { UserInfo } from "@/store/finance-store";
import { cx } from "./ui";

/** Foto do usuário (Google) ou a inicial do nome/e-mail */
export function UserAvatar({ user, size = 36, className }: { user: UserInfo | null; size?: number; className?: string }) {
  const initial = (user?.name || user?.email || "").trim().slice(0, 1).toUpperCase();
  return (
    <span
      className={cx("bg-brand grid shrink-0 place-items-center overflow-hidden rounded-full font-bold text-white", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {user?.photoURL ? (
        <img src={user.photoURL} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
      ) : initial ? (
        initial
      ) : (
        <UserRound size={Math.round(size * 0.55)} />
      )}
    </span>
  );
}
