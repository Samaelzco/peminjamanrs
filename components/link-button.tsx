"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { Button } from "flowbite-react";

/** Tombol flowbite yang berupa <Link>, aman dipakai dari Server Component. */
export function LinkButton({
  href,
  ...props
}: { href: string } & Omit<ComponentProps<typeof Button>, "as" | "href">) {
  return <Button as={Link} href={href} {...props} />;
}
